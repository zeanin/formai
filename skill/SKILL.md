---
name: formai-custom-skill-template
description: >-
  Standard template and guideline for creating custom AI skills in the FormAI project.
  Adapts the general structure to FormAI's TS Monorepo, Schema Engine, and A2X context.
---

# FormAI Custom Skill Guideline

This document defines the standard folder structure and development guidelines for custom AI skills within the FormAI platform.

## Skill Folder Structure

Every skill MUST follow this structure:

```text
skill/  
├── SKILL.md            # Main instructions and prompt guide for the AI Agent
├── references/         # Technical specifications, API reference, and ACL rules
├── scripts/            # Executable script files (TypeScript/JavaScript)
├── examples/           # Input/output schemas, collection definitions, and UI schemas
└── assets/             # Raw assets, boilerplate templates, and mock data
```

---

## Component Details

### 1. `SKILL.md` (Main Instructions)
*   **YAML Frontmatter**: Must define `name` (lowercase-kebab) and `description` (short summary).
*   **Overview**: Context of when the skill is applicable.
*   **Quick Start**: Simplest invocation example.
*   **Development Rules**:
    *   Strictly adhere to the **English Only** policy for all generated code, schemas, and UI strings.
    *   Specify safety/security level: indicates if a dynamic validation or user confirmation (Dynamic Safeguard) is required.

### 2. `references/` (Specs & Standards)
*   Keep detailed API specs here to avoid bloat in `SKILL.md`.
*   Document Security & ACL rules (table-level / field-level filters).
*   Add coding standards specific to the target packages (e.g. `@formai/database` vs `@formai/resourcer`).

### 3. `scripts/` (Executables)
*   Prefer **TypeScript** scripts run via `tsx` or TS runners within the `pnpm workspace` instead of raw Python or Bash.
*   Provide arguments explicitly (e.g. using `commander` or `yargs`).

### 4. `examples/` (Data Templates)
*   **collections/**: JSON files showcasing schema database tables (Collections).
*   **ui-schemas/**: JSON files demonstrating component schemas compatible with `@formai/schema-engine`.
*   **tests/**: Test cases written using the **Vitest** verification framework.

### 5. `assets/` (Boilerplate Templates)
*   Contains boilerplate/template files used by generation scripts to create new packages/plugins or Koa routes.
