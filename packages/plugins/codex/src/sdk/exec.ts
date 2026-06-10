import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createRequire } from "node:module";
import net from "node:net";
import { URL } from "node:url";

import type { CodexConfigObject, CodexConfigValue, LlmProviderConfig } from "./codexOptions";
import { SandboxMode, ModelReasoningEffort, ApprovalMode, WebSearchMode } from "./threadOptions";

export type CodexExecArgs = {
  input: string;

  baseUrl?: string;
  apiKey?: string;
  threadId?: string | null;
  images?: string[];
  // --model
  model?: string;
  // --sandbox
  sandboxMode?: SandboxMode;
  // --cd
  workingDirectory?: string;
  // --add-dir
  additionalDirectories?: string[];
  // --skip-git-repo-check
  skipGitRepoCheck?: boolean;
  // --output-schema
  outputSchemaFile?: string;
  // --config model_reasoning_effort
  modelReasoningEffort?: ModelReasoningEffort;
  // AbortSignal to cancel the execution
  signal?: AbortSignal;
  // --config sandbox_workspace_write.network_access
  networkAccessEnabled?: boolean;
  // --config web_search
  webSearchMode?: WebSearchMode;
  // legacy --config features.web_search_request
  webSearchEnabled?: boolean;
  // --config approval_policy
  approvalPolicy?: ApprovalMode;
  /** Unified dynamic LLM provider parameters override */
  llmProvider?: LlmProviderConfig;
  /** Custom config overrides for this specific thread */
  config?: CodexConfigObject;
  /** Enable fast mode for faster inference */
  fastMode?: boolean;
};

const INTERNAL_ORIGINATOR_ENV = "CODEX_INTERNAL_ORIGINATOR_OVERRIDE";
const TYPESCRIPT_SDK_ORIGINATOR = "codex_sdk_ts";
const CODEX_NPM_NAME = "@openai/codex";

const PLATFORM_PACKAGE_BY_TARGET: Record<string, string> = {
  "x86_64-unknown-linux-musl": "@openai/codex-linux-x64",
  "aarch64-unknown-linux-musl": "@openai/codex-linux-arm64",
  "x86_64-apple-darwin": "@openai/codex-darwin-x64",
  "aarch64-apple-darwin": "@openai/codex-darwin-arm64",
  "x86_64-pc-windows-msvc": "@openai/codex-win32-x64",
  "aarch64-pc-windows-msvc": "@openai/codex-win32-arm64",
};

const moduleRequire = createRequire(import.meta.url);

type CodexPathResolution = {
  executablePath: string;
  pathDirs: string[];
};
export class CodexExec {
  private executablePath: string;
  private pathDirs: string[];
  private envOverride?: Record<string, string>;
  private configOverrides?: CodexConfigObject;
  private daemonUrl?: string;
  private socketPath?: string;

  constructor(
    executablePath: string | null = null,
    env?: Record<string, string>,
    configOverrides?: CodexConfigObject,
    daemonUrl?: string,
    socketPath?: string,
  ) {
    this.daemonUrl = daemonUrl;
    this.socketPath = socketPath;
    if (executablePath) {
      this.executablePath = executablePath;
      this.pathDirs = [];
    } else {
      const resolved = findCodexPath();
      this.executablePath = resolved.executablePath;
      this.pathDirs = resolved.pathDirs;
    }
    this.envOverride = env;
    this.configOverrides = configOverrides;
  }

  async *run(args: CodexExecArgs): AsyncGenerator<string> {
    const activeDaemonUrl = this.daemonUrl || process.env.CODEX_DAEMON_URL;
    if (activeDaemonUrl) {
      const isReachable = await checkDaemonReachable(activeDaemonUrl, this.socketPath);
      if (isReachable) {
        yield* this.runDaemon(activeDaemonUrl, args);
        return;
      }
      console.warn(`[Codex SDK] Codex daemon at ${activeDaemonUrl} is not reachable. Falling back to CLI execution.`);
    }

    const commandArgs: string[] = ["exec", "--experimental-json"];

    if (this.configOverrides) {
      for (const override of serializeConfigOverrides(this.configOverrides)) {
        commandArgs.push("--config", override);
      }
    }

    // Dynamic LLM Provider parameters translation overrides
    const provider = args.llmProvider?.provider as string | undefined;
    const model = args.llmProvider?.model || args.model;
    const baseUrl = args.llmProvider?.baseUrl || args.baseUrl;
    const apiKey = args.llmProvider?.apiKey || args.apiKey;
    const reasoningEffort = args.llmProvider?.reasoningEffort || args.modelReasoningEffort;

    if (baseUrl) {
      commandArgs.push(
        "--config",
        `openai_base_url=${toTomlValue(baseUrl, "openai_base_url")}`,
      );
    }

    if (model) {
      commandArgs.push("--model", model);
    }

    if (args.sandboxMode) {
      commandArgs.push("--sandbox", args.sandboxMode);
    }

    if (args.workingDirectory) {
      commandArgs.push("--cd", args.workingDirectory);
    }

    if (args.additionalDirectories?.length) {
      for (const dir of args.additionalDirectories) {
        commandArgs.push("--add-dir", dir);
      }
    }

    if (args.skipGitRepoCheck) {
      commandArgs.push("--skip-git-repo-check");
    }

    if (args.outputSchemaFile) {
      commandArgs.push("--output-schema", args.outputSchemaFile);
    }

    if (reasoningEffort) {
      commandArgs.push("--config", `model_reasoning_effort="${reasoningEffort}"`);
    }

    if (args.networkAccessEnabled !== undefined) {
      commandArgs.push(
        "--config",
        `sandbox_workspace_write.network_access=${args.networkAccessEnabled}`,
      );
    }

    if (args.webSearchMode) {
      commandArgs.push("--config", `web_search="${args.webSearchMode}"`);
    } else if (args.webSearchEnabled === true) {
      commandArgs.push("--config", `web_search="live"`);
    } else if (args.webSearchEnabled === false) {
      commandArgs.push("--config", `web_search="disabled"`);
    }

    if (args.approvalPolicy) {
      commandArgs.push("--config", `approval_policy="${args.approvalPolicy}"`);
    }

    if (args.threadId) {
      commandArgs.push("resume", args.threadId);
    }

    if (args.fastMode) {
      commandArgs.push("--config", 'service_tier="fast"', "--config", "features.fast_mode=true");
    }

    if (args.images?.length) {
      for (const image of args.images) {
        commandArgs.push("--image", image);
      }
    }

    const env: Record<string, string> = {};
    if (this.envOverride) {
      Object.assign(env, this.envOverride);
    } else {
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          env[key] = value;
        }
      }
    }
    if (!env[INTERNAL_ORIGINATOR_ENV]) {
      env[INTERNAL_ORIGINATOR_ENV] = TYPESCRIPT_SDK_ORIGINATOR;
    }
    
    // Dynamic routing of API keys based on provider
    if (apiKey) {
      if (provider === 'anthropic') {
        env.ANTHROPIC_API_KEY = apiKey;
      } else if (provider === 'aliyun' || provider === 'dashscope' || provider === 'qwen') {
        env.DASHSCOPE_API_KEY = apiKey;
        env.CODEX_API_KEY = apiKey;
        env.OPENAI_API_KEY = apiKey;
      } else {
        env.CODEX_API_KEY = apiKey;
        env.OPENAI_API_KEY = apiKey;
      }
    }

    if (this.pathDirs.length > 0) {
      prependPathDirs(env, this.pathDirs);
    }

    const child = spawn(this.executablePath, commandArgs, {
      env,
      signal: args.signal,
    });

    let spawnError: unknown | null = null;
    child.once("error", (err) => (spawnError = err));

    if (!child.stdin) {
      child.kill();
      throw new Error("Child process has no stdin");
    }
    child.stdin.write(args.input);
    child.stdin.end();

    if (!child.stdout) {
      child.kill();
      throw new Error("Child process has no stdout");
    }
    const stderrChunks: Buffer[] = [];

    if (child.stderr) {
      child.stderr.on("data", (data) => {
        stderrChunks.push(data);
      });
    }

    const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve) => {
        child.once("exit", (code, signal) => {
          resolve({ code, signal });
        });
      },
    );

    const rl = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        // `line` is a string (Node sets default encoding to utf8 for readline)
        yield line as string;
      }

      if (spawnError) throw spawnError;
      const { code, signal } = await exitPromise;
      if (code !== 0 || signal) {
        const stderrBuffer = Buffer.concat(stderrChunks);
        const detail = signal ? `signal ${signal}` : `code ${code ?? 1}`;
        throw new Error(`Codex Exec exited with ${detail}: ${stderrBuffer.toString("utf8")}`);
      }
    } finally {
      rl.close();
      child.removeAllListeners();
      try {
        if (!child.killed) child.kill();
      } catch {
        // ignore
      }
    }
  }

  private async *runDaemon(daemonUrl: string, args: CodexExecArgs): AsyncGenerator<string> {
    const queue: string[] = [];
    let pendingResolver: ((value: IteratorResult<string>) => void) | null = null;
    let isFinished = false;

    const emit = (event: unknown) => {
      const line = JSON.stringify(event);
      if (pendingResolver) {
        pendingResolver({ value: line, done: false });
        pendingResolver = null;
      } else {
        queue.push(line);
      }
    };

    const emitError = (msg: string) => {
      emit({ type: "error", message: msg });
      isFinished = true;
      if (pendingResolver) {
        pendingResolver({ done: true, value: undefined });
        pendingResolver = null;
      }
    };

    const emitDone = () => {
      isFinished = true;
      if (pendingResolver) {
        pendingResolver({ done: true, value: undefined });
        pendingResolver = null;
      }
    };

    let ws: WebSocket;
    try {
      ws = new globalThis.WebSocket(daemonUrl);
    } catch (e: any) {
      emitError(`Failed to create WebSocket to ${daemonUrl}: ${e.message}`);
      return;
    }

    const pendingRequests = new Map<number, { resolve: (res: any) => void; reject: (err: any) => void }>();
    let nextReqId = 1;

    const callRpc = (method: string, params: any): Promise<any> => {
      const id = nextReqId++;
      const payload = { jsonrpc: "2.0", method, params, id };
      const raw = JSON.stringify(payload);
      if (daemonUrl.includes("127.0.0.1:3005") || daemonUrl.includes("localhost:3005")) {
        console.log(`[FormAI-Codex WS Send] Request:\n${JSON.stringify(payload, null, 2)}`);
      }
      ws.send(raw);
      return new Promise((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });
      });
    };

    const notifyRpc = (method: string, params: any) => {
      const payload = { jsonrpc: "2.0", method, params };
      const raw = JSON.stringify(payload);
      if (daemonUrl.includes("127.0.0.1:3005") || daemonUrl.includes("localhost:3005")) {
        console.log(`[FormAI-Codex WS Send] Notification:\n${JSON.stringify(payload, null, 2)}`);
      }
      ws.send(raw);
    };

    const activeItems = new Map<string, any>();

    ws.onopen = async () => {
      try {
        await callRpc("initialize", {
          clientInfo: {
            name: "formai-plugin-codex",
            title: "FormAI Codex Client",
            version: "0.1.0",
          },
          capabilities: {},
        });

        notifyRpc("initialized", {});

        let outputSchemaVal: any = undefined;
        if (args.outputSchemaFile) {
          try {
            const { promises: fsPromises } = await import("node:fs");
            const schemaText = await fsPromises.readFile(args.outputSchemaFile, "utf8");
            outputSchemaVal = JSON.parse(schemaText);
          } catch (e) {
            // Ignore schema reading issues
          }
        }

        let activeThreadId = args.threadId;
        const llmProvider = args.llmProvider;

        // Perform dynamic API key login if a key is provided, so the daemon session is authenticated.
        if (llmProvider?.apiKey) {
          console.log("[Codex SDK] Authenticating daemon WebSocket connection with dynamic API key...");
          await callRpc("account/login/start", {
            type: "apiKey",
            apiKey: llmProvider.apiKey,
          });
        }

        const configOverrides: Record<string, any> = {};
        if (this.configOverrides) {
          Object.assign(configOverrides, this.configOverrides);
        }
        if (args.config) {
          Object.assign(configOverrides, args.config);
        }
        if (llmProvider) {
          if (llmProvider.baseUrl) {
            configOverrides["openai_base_url"] = llmProvider.baseUrl;
          }
          if (llmProvider.reasoningEffort) {
            configOverrides["model_reasoning_effort"] = llmProvider.reasoningEffort;
          }
          configOverrides["llm_provider"] = {
            provider: llmProvider.provider,
            model: llmProvider.model,
            baseUrl: llmProvider.baseUrl,
            apiKey: llmProvider.apiKey,
            reasoningEffort: llmProvider.reasoningEffort,
          };
        }

        if (activeThreadId) {
          await callRpc("thread/resume", {
            threadId: activeThreadId,
            model: llmProvider?.model || args.model,
            modelProvider: llmProvider?.provider,
            cwd: args.workingDirectory,
            approvalPolicy: args.approvalPolicy,
            sandbox: args.sandboxMode,
            config: configOverrides,
          });
        } else {
          const startRes = await callRpc("thread/start", {
            model: llmProvider?.model || args.model,
            modelProvider: llmProvider?.provider,
            cwd: args.workingDirectory,
            approvalPolicy: args.approvalPolicy,
            sandbox: args.sandboxMode,
            config: configOverrides,
          });
          activeThreadId = startRes.thread.id;
          emit({ type: "thread.started", thread_id: activeThreadId });
        }

        emit({ type: "turn.started" });

        const textInput: any = {
          type: "text",
          text: args.input || "",
          textElements: [],
        };
        const turnInput = [textInput];

        if (args.images && args.images.length > 0) {
          for (const imgPath of args.images) {
            turnInput.push({
              type: "localImage",
              path: imgPath,
            });
          }
        }

        await callRpc("turn/start", {
          threadId: activeThreadId,
          input: turnInput,
          model: llmProvider?.model || args.model,
          effort: llmProvider?.reasoningEffort || args.modelReasoningEffort,
          outputSchema: outputSchemaVal,
        });

      } catch (e: any) {
        emitError(`RPC Error: ${e.message}`);
        ws.close();
      }
    };

    ws.onmessage = (event) => {
      try {
        const rawMsg = event.data.toString();
        const data = JSON.parse(rawMsg);
        if (daemonUrl.includes("127.0.0.1:3005") || daemonUrl.includes("localhost:3005")) {
          console.log(`[FormAI-Codex WS Receive] Message:\n${JSON.stringify(data, null, 2)}`);
        }

        if (data.id !== undefined && data.id !== null) {
          const req = pendingRequests.get(data.id);
          if (req) {
            pendingRequests.delete(data.id);
            if (data.error) {
              req.reject(new Error(data.error.message || JSON.stringify(data.error)));
            } else {
              req.resolve(data.result);
            }
          }
          return;
        }

        if (data.method) {
          const method = data.method;
          const params = data.params || {};

          switch (method) {
            case "thread/started": {
              emit({ type: "thread.started", thread_id: params.thread?.id });
              break;
            }
            case "item/started": {
              const rawItem = params.item;
              if (rawItem) {
                const item = mapRpcItemToSdkItem(rawItem);
                activeItems.set(item.id, item);
                emit({ type: "item.started", item });
              }
              break;
            }
            case "item/agentMessage/delta": {
              const item = activeItems.get(params.itemId);
              if (item && item.type === "agent_message") {
                item.text = (item.text || "") + (params.delta || "");
                emit({ type: "item.updated", item });
              }
              break;
            }
            case "item/commandExecution/outputDelta":
            case "item/commandExecution/output": {
              const item = activeItems.get(params.itemId);
              if (item && item.type === "command_execution") {
                item.aggregated_output = (item.aggregated_output || "") + (params.delta || "");
                emit({ type: "item.updated", item });
              }
              break;
            }
            case "item/completed": {
              const rawItem = params.item;
              if (rawItem) {
                const item = mapRpcItemToSdkItem(rawItem);
                activeItems.delete(item.id);
                emit({ type: "item.completed", item });
              }
              break;
            }
            case "turn/completed": {
              const usage = {
                input_tokens: params.turn?.usage?.inputTokens || 0,
                cached_input_tokens: params.turn?.usage?.cachedInputTokens || 0,
                output_tokens: params.turn?.usage?.outputTokens || 0,
                reasoning_output_tokens: params.turn?.usage?.reasoningOutputTokens || 0,
              };
              if (params.turn?.status === "failed") {
                emit({
                  type: "turn.failed",
                  error: { message: params.turn?.error?.message || "Turn failed" },
                });
              } else {
                emit({ type: "turn.completed", usage });
              }
              ws.close();
              break;
            }
            case "turn/failed": {
              emit({
                type: "turn.failed",
                error: { message: params.error?.message || "Turn failed" },
              });
              ws.close();
              break;
            }
          }
        }
      } catch (e: any) {
        emitError(`Error processing message: ${e.message}`);
      }
    };

    ws.onerror = (err) => {
      emitError(`WebSocket connection error to ${daemonUrl}`);
    };

    ws.onclose = () => {
      emitDone();
    };

    try {
      while (!isFinished || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          yield await new Promise<string>((resolve) => {
            pendingResolver = (res) => {
              if (res.done) {
                // Done
              } else {
                resolve(res.value);
              }
            };
          });
        }
      }
    } finally {
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
        ws.close();
      }
    }
  }
}

function mapRpcItemToSdkItem(rawItem: any): any {
  const item: any = {
    id: rawItem.id,
  };

  const rawType = rawItem.type;
  let type = rawType;
  if (rawType === "agentMessage") type = "agent_message";
  else if (rawType === "commandExecution") type = "command_execution";
  else if (rawType === "fileChange") type = "file_change";
  else if (rawType === "mcpToolCall") type = "mcp_tool_call";
  else if (rawType === "collabToolCall") type = "collab_tool_call";
  else if (rawType === "webSearch") type = "web_search";
  else if (rawType === "todoList") type = "todo_list";

  item.type = type;

  if (type === "agent_message") {
    item.text = rawItem.text || "";
  } else if (type === "reasoning") {
    item.text = rawItem.text || "";
  } else if (type === "command_execution") {
    item.command = rawItem.command || "";
    item.aggregated_output = rawItem.aggregatedOutput || "";
    item.exit_code = rawItem.exitCode;
    item.status = rawItem.status === "inProgress" ? "in_progress" : rawItem.status;
  } else if (type === "file_change") {
    item.changes = (rawItem.changes || []).map((c: any) => ({
      path: c.path,
      kind: c.kind,
    }));
    item.status = rawItem.status;
  } else if (type === "mcp_tool_call") {
    item.server = rawItem.server;
    item.tool = rawItem.tool;
    item.arguments = rawItem.arguments;
    item.result = rawItem.result;
    item.error = rawItem.error;
    item.status = rawItem.status;
  } else if (type === "web_search") {
    item.query = rawItem.query;
  } else if (type === "todo_list") {
    item.items = (rawItem.items || []).map((i: any) => ({
      text: i.text,
      completed: i.completed,
    }));
  } else if (type === "error") {
    item.message = rawItem.message;
  }

  return item;
}

function serializeConfigOverrides(configOverrides: CodexConfigObject): string[] {
  const overrides: string[] = [];
  flattenConfigOverrides(configOverrides, "", overrides);
  return overrides;
}

function flattenConfigOverrides(
  value: CodexConfigValue,
  prefix: string,
  overrides: string[],
): void {
  if (!isPlainObject(value)) {
    if (prefix) {
      overrides.push(`${prefix}=${toTomlValue(value, prefix)}`);
      return;
    } else {
      throw new Error("Codex config overrides must be a plain object");
    }
  }

  const entries = Object.entries(value);
  if (!prefix && entries.length === 0) {
    return;
  }

  if (prefix && entries.length === 0) {
    overrides.push(`${prefix}={}`);
    return;
  }

  for (const [key, child] of entries) {
    if (!key) {
      throw new Error("Codex config override keys must be non-empty strings");
    }
    if (child === undefined) {
      continue;
    }
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(child)) {
      flattenConfigOverrides(child, path, overrides);
    } else {
      overrides.push(`${path}=${toTomlValue(child, path)}`);
    }
  }
}

function toTomlValue(value: CodexConfigValue, path: string): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  } else if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Codex config override at ${path} must be a finite number`);
    }
    return `${value}`;
  } else if (typeof value === "boolean") {
    return value ? "true" : "false";
  } else if (Array.isArray(value)) {
    const rendered = value.map((item, index) => toTomlValue(item, `${path}[${index}]`));
    return `[${rendered.join(", ")}]`;
  } else if (isPlainObject(value)) {
    const parts: string[] = [];
    for (const [key, child] of Object.entries(value)) {
      if (!key) {
        throw new Error("Codex config override keys must be non-empty strings");
      }
      if (child === undefined) {
        continue;
      }
      parts.push(`${formatTomlKey(key)} = ${toTomlValue(child, `${path}.${key}`)}`);
    }
    return `{${parts.join(", ")}}`;
  } else if (value === null) {
    throw new Error(`Codex config override at ${path} cannot be null`);
  } else {
    const typeName = typeof value;
    throw new Error(`Unsupported Codex config override value at ${path}: ${typeName}`);
  }
}

const TOML_BARE_KEY = /^[A-Za-z0-9_-]+$/;
function formatTomlKey(key: string): string {
  return TOML_BARE_KEY.test(key) ? key : JSON.stringify(key);
}

function isPlainObject(value: unknown): value is CodexConfigObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findCodexPath(): CodexPathResolution {
  const { platform, arch } = process;

  let targetTriple = null;
  switch (platform) {
    case "linux":
    case "android":
      switch (arch) {
        case "x64":
          targetTriple = "x86_64-unknown-linux-musl";
          break;
        case "arm64":
          targetTriple = "aarch64-unknown-linux-musl";
          break;
        default:
          break;
      }
      break;
    case "darwin":
      switch (arch) {
        case "x64":
          targetTriple = "x86_64-apple-darwin";
          break;
        case "arm64":
          targetTriple = "aarch64-apple-darwin";
          break;
        default:
          break;
      }
      break;
    case "win32":
      switch (arch) {
        case "x64":
          targetTriple = "x86_64-pc-windows-msvc";
          break;
        case "arm64":
          targetTriple = "aarch64-pc-windows-msvc";
          break;
        default:
          break;
      }
      break;
    default:
      break;
  }

  if (!targetTriple) {
    throw new Error(`Unsupported platform: ${platform} (${arch})`);
  }

  const platformPackage = PLATFORM_PACKAGE_BY_TARGET[targetTriple];
  if (!platformPackage) {
    throw new Error(`Unsupported target triple: ${targetTriple}`);
  }

  let vendorRoot: string;
  try {
    const codexPackageJsonPath = moduleRequire.resolve(`${CODEX_NPM_NAME}/package.json`);
    const codexRequire = createRequire(codexPackageJsonPath);
    const platformPackageJsonPath = codexRequire.resolve(`${platformPackage}/package.json`);
    vendorRoot = path.join(path.dirname(platformPackageJsonPath), "vendor");
  } catch {
    // Elegant fallback: if the local workspace/monorepo doesn't resolve `@openai/codex`,
    // check if `codex` command is globally available on the system PATH.
    console.warn(`[Codex SDK] Local ${CODEX_NPM_NAME} binaries not found. Falling back to system global 'codex' command.`);
    return {
      executablePath: "codex",
      pathDirs: []
    };
  }

  const codexBinaryName = process.platform === "win32" ? "codex.exe" : "codex";
  const nativePackage = resolveNativePackage(vendorRoot, targetTriple, codexBinaryName);
  if (!nativePackage) {
    console.warn(`[Codex SDK] Local native package not found for ${targetTriple}. Falling back to system global 'codex' command.`);
    return {
      executablePath: "codex",
      pathDirs: []
    };
  }

  return nativePackage;

}

export function resolveNativePackage(
  vendorRoot: string,
  targetTriple: string,
  codexBinaryName: string,
): CodexPathResolution | null {
  const packageRoot = path.join(vendorRoot, targetTriple);
  const packageBinaryPath = path.join(packageRoot, "bin", codexBinaryName);
  if (isFile(packageBinaryPath) && isFile(path.join(packageRoot, "codex-package.json"))) {
    return {
      executablePath: packageBinaryPath,
      pathDirs: existingDirs(path.join(packageRoot, "codex-path")),
    };
  }

  const legacyBinaryPath = path.join(packageRoot, "codex", codexBinaryName);
  if (isFile(legacyBinaryPath)) {
    return {
      executablePath: legacyBinaryPath,
      pathDirs: existingDirs(path.join(packageRoot, "path")),
    };
  }

  return null;
}

function existingDirs(...dirs: string[]): string[] {
  return dirs.filter(isDirectory);
}

export function prependPathDirs(
  env: Record<string, string>,
  pathDirs: string[],
  platform: NodeJS.Platform = process.platform,
): void {
  const pathKey = pathEnvKey(env, platform);
  if (platform === "win32") {
    for (const key of Object.keys(env)) {
      if (key.toLowerCase() === "path" && key !== pathKey) {
        delete env[key];
      }
    }
  }

  const existingEntries = (env[pathKey] ?? "")
    .split(path.delimiter)
    .filter((entry) => entry.length > 0 && !pathDirs.includes(entry));
  env[pathKey] = [...pathDirs, ...existingEntries].join(path.delimiter);
}

function pathEnvKey(env: Record<string, string>, platform: NodeJS.Platform): string {
  if (platform !== "win32") {
    return "PATH";
  }

  const matchingKeys = Object.keys(env).filter((key) => key.toLowerCase() === "path");
  return matchingKeys.includes("Path") ? "Path" : (matchingKeys.at(-1) ?? "PATH");
}

function isFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isDirectory(filePath: string): boolean {
  try {
    return statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

async function checkDaemonReachable(daemonUrl: string, socketPath?: string): Promise<boolean> {
  if (socketPath) {
    return new Promise((resolve) => {
      const socket = net.connect(socketPath);
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => {
        resolve(false);
      });
    });
  }

  try {
    const parsed = new URL(daemonUrl);
    const host = parsed.hostname || "127.0.0.1";
    const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === "wss:" ? 443 : 80);

    return new Promise((resolve) => {
      const socket = net.connect({ host, port, timeout: 500 });
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.on("error", () => {
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}
