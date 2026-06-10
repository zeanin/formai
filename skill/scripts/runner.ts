import { execSync } from 'child_process';
import path from 'path';

// Helper script runner to execute pnpm commands from the root directory.
// This ensures that TS scripts run inside the correct package workspace.

function runCommand(packageName: string, scriptPath: string, args: string[]) {
  const rootDir = path.resolve(__dirname, '../../');
  const fullArgs = args.join(' ');
  const command = `pnpm --filter ${packageName} exec tsx ${scriptPath} ${fullArgs}`;
  
  console.log(`[FormAI Skill Runner] Executing: ${command}`);
  try {
    execSync(command, { cwd: rootDir, stdio: 'inherit' });
  } catch (error) {
    console.error(`[FormAI Skill Runner] Command execution failed:`, error);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: npx tsx runner.ts <package-name> <script-path> [args...]');
  process.exit(1);
}

const [packageName, scriptPath, ...restArgs] = args;
runCommand(packageName, scriptPath, restArgs);
