import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const COPIED_SHARED_FILES = ["config.json", "config.toml", "instructions.md"] as const;
const SYMLINKED_SHARED_FILES = ["auth.json"] as const;

function nonEmpty(value: string | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function pathExists(candidate: string): Promise<boolean> {
  return fs.access(candidate).then(() => true).catch(() => false);
}

export function resolveSharedCodexHomeDir(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = nonEmpty(env.CODEX_HOME);
  return fromEnv ? path.resolve(fromEnv) : path.join(os.homedir(), ".codex");
}

export function resolveManagedCodexHomeDir(appId: string, threadName: string): string {
  return path.join(os.homedir(), ".formai", "apps", appId, "codex-home", threadName);
}

async function ensureParentDir(target: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
}

async function isExpectedSymlink(target: string, source: string): Promise<boolean> {
  const existing = await fs.lstat(target).catch(() => null);
  if (!existing?.isSymbolicLink()) return false;

  const linkedPath = await fs.readlink(target).catch(() => null);
  if (!linkedPath) return false;

  return path.resolve(path.dirname(target), linkedPath) === path.resolve(source);
}

async function createExpectedSymlink(target: string, source: string): Promise<void> {
  try {
    await fs.symlink(source, target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST" && await isExpectedSymlink(target, source)) return;
    throw error;
  }
}

async function ensureSymlink(target: string, source: string): Promise<void> {
  const existing = await fs.lstat(target).catch(() => null);
  if (!existing) {
    await ensureParentDir(target);
    await createExpectedSymlink(target, source);
    return;
  }

  if (!existing.isSymbolicLink()) {
    return;
  }

  if (await isExpectedSymlink(target, source)) return;

  await fs.unlink(target);
  await createExpectedSymlink(target, source);
}

async function ensureCopiedFile(target: string, source: string): Promise<void> {
  const existing = await fs.lstat(target).catch(() => null);
  if (existing) return;
  await ensureParentDir(target);
  await fs.copyFile(source, target);
}

export async function writeApiKeyAuthJson(home: string, apiKey: string, providerName?: string): Promise<void> {
  await fs.mkdir(home, { recursive: true });
  const target = path.join(home, "auth.json");
  await fs.rm(target, { force: true });
  const credentials: Record<string, string> = {};
  if (providerName?.toLowerCase() === "anthropic") {
    credentials.ANTHROPIC_API_KEY = apiKey;
  } else if (providerName?.toLowerCase() === "aliyun" || providerName?.toLowerCase() === "dashscope" || providerName?.toLowerCase() === "qwen") {
    credentials.DASHSCOPE_API_KEY = apiKey;
    credentials.OPENAI_API_KEY = apiKey;
  } else {
    credentials.OPENAI_API_KEY = apiKey;
  }
  await fs.writeFile(target, JSON.stringify(credentials), { mode: 0o600 });
}

export async function prepareManagedCodexHome(
  appId: string,
  threadName: string,
  options: { apiKey?: string | null; provider?: string | null; mcpBridgePort?: number | null; mcpScriptPath?: string | null } = {},
): Promise<string> {
  const targetHome = resolveManagedCodexHomeDir(appId, threadName);
  const apiKey = nonEmpty(options.apiKey ?? undefined);

  const sourceHome = resolveSharedCodexHomeDir();
  const seedFromShared = path.resolve(sourceHome) !== path.resolve(targetHome);

  await fs.mkdir(targetHome, { recursive: true });

  if (!apiKey && seedFromShared) {
    const authPath = path.join(targetHome, "auth.json");
    const existing = await fs.lstat(authPath).catch(() => null);
    if (existing && !existing.isSymbolicLink()) {
      await fs.rm(authPath, { force: true });
    }
  }

  if (seedFromShared) {
    for (const name of SYMLINKED_SHARED_FILES) {
      const source = path.join(sourceHome, name);
      if (!(await pathExists(source))) continue;
      await ensureSymlink(path.join(targetHome, name), source);
    }

    for (const name of COPIED_SHARED_FILES) {
      const source = path.join(sourceHome, name);
      if (!(await pathExists(source))) continue;
      await ensureCopiedFile(path.join(targetHome, name), source);
    }
  }

  if (apiKey) {
    await writeApiKeyAuthJson(targetHome, apiKey, options.provider || undefined);
  }

  // Inject MCP configuration dynamically to config.toml of that thread
  const mcpBridgePort = options.mcpBridgePort || 3006;
  const mcpScriptPath = options.mcpScriptPath;
  if (mcpScriptPath) {
    const targetConfigToml = path.join(targetHome, "config.toml");
    let content = "";
    if (await pathExists(targetConfigToml)) {
      content = await fs.readFile(targetConfigToml, "utf8");
    }
    // Remove existing formai-copilot-engine block to avoid duplication
    content = content.replace(/\[mcp_servers\.formai-copilot-engine\][\s\S]*?(?=\n\[|$)/g, "").trim();
    // Append mcp_servers table block
    content += `\n\n[mcp_servers.formai-copilot-engine]\ncommand = "node"\nargs = [${JSON.stringify(mcpScriptPath)}]\nenv = { FORMAI_MCP_PORT = "${mcpBridgePort}" }\n`;
    await fs.writeFile(targetConfigToml, content, "utf8");
  }

  return targetHome;
}
