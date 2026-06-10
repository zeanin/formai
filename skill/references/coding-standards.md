# FormAI Code & Language Standards for Skills

## 1. Language Policy
All generated code, comments, database schemas, API responses, and user interface strings within FormAI MUST be written strictly in **English**. 

## 2. Monorepo Integration
- Script commands should use pnpm workspaces syntax:
  ```bash
  pnpm --filter <package-name> exec tsx scripts/your-script.ts
  ```
- Avoid hardcoding absolute paths. Use relative path resolution based on `process.cwd()` or `__dirname` to ensure it works across different host setups.

## 3. Package Dependencies
- Core database functionality should always be imported from `@formai/database`.
- Core REST options and routing are managed via `@formai/resourcer`.
- Frontend component layouts are governed by `@formai/schema-engine`.
