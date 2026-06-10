# Formai

**AI-Native No-Code Application Platform**

Formai is a next-generation, AI-driven enterprise application builder that enables teams to create full-stack applications through natural language and visual design — without writing code.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | Node.js + Koa |
| Database ORM | Sequelize (via `@formai/database`) |
| API layer | Custom resourcer (`@formai/resourcer`) |
| Auth | JWT + bcrypt (`@formai/auth`) |
| ACL | Attribute-based access control (`@formai/acl`) |
| Frontend | React 18 + Vite |
| Schema engine | `@formai/schema-engine` |
| AI integration | OpenAI / Anthropic (`@formai/ai`) |
| Build tooling | Turborepo + pnpm workspaces |
| Testing | Vitest |
| Containerization | Docker + Docker Compose |

---

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm i -g pnpm`)
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)

### 1. Clone and install

```bash
git clone <repo-url>
cd formai  # this rebuild/ directory
pnpm install
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env and set DB credentials, JWT_SECRET, API keys, etc.
```

### 3. Start infrastructure (Docker)

```bash
pnpm docker:up
# Starts postgres + redis
```

### 4. Run in development mode

```bash
# All packages in watch mode
pnpm dev

# Or individually:
pnpm dev:server   # API server on :3000
pnpm dev:web      # Frontend on :5173
```

### 5. Verify

```bash
curl http://localhost:3000/api/health
# {"status":"ok","version":"0.1.0","uptime":5}
```

---

## Project Structure

```
rebuild/
├── apps/
│   ├── server/          # Express/Koa server entry point
│   │   └── src/
│   │       ├── index.ts      # Main entry — starts the server
│   │       ├── app.ts        # Application factory — registers all plugins
│   │       └── config.ts     # Config from environment variables
│   └── web/             # React frontend (Vite)
│       └── src/
│           ├── App.tsx       # Root component with AI bar + layout
│           └── main.tsx      # React mount
│
├── packages/
│   ├── core/
│   │   ├── server/      # @formai/server — Application class, middleware
│   │   ├── database/    # @formai/database — Sequelize wrapper
│   │   ├── resourcer/   # @formai/resourcer — REST resourcer
│   │   ├── auth/        # @formai/auth — JWT utilities
│   │   ├── acl/         # @formai/acl — Permission engine
│   │   ├── ai/          # @formai/ai — AI provider abstraction
│   │   ├── client/      # @formai/client — React client SDK
│   │   ├── schema-engine/ # @formai/schema-engine — UI schema renderer
│   │   ├── plugin/      # @formai/plugin — Plugin base class
│   │   ├── sdk/         # @formai/sdk — HTTP client
│   │   └── shared/      # @formai/shared — Shared types
│   │
│   └── plugins/
│       ├── collection-manager/  # Dynamic collection management
│       ├── users/               # User auth & profiles
│       ├── acl/                 # ACL plugin
│       ├── ui-schema-storage/   # Persist UI schemas
│       ├── file-manager/        # File upload/storage
│       ├── system-settings/     # Global system config
│       ├── localization/        # i18n support
│       ├── notification/        # Notification system
│       ├── workflow/            # Workflow automation
│       ├── data-visualization/  # Charts & dashboards
│       ├── import-export/       # Data import/export
│       ├── backup-restore/      # Database backups
│       ├── audit-log/           # Audit trail
│       ├── api-doc/             # Auto API docs
│       └── theme-editor/        # UI theme customization
│
├── docker-compose.yml   # Postgres + Redis + App
├── Dockerfile           # Multi-stage production build
├── .env.example         # Environment variable template
└── turbo.json           # Turborepo pipeline config
```

---

## Development Commands

```bash
# Install all dependencies
pnpm install

# Start all in dev mode (watch)
pnpm dev

# Start server only
pnpm dev:server

# Start web only
pnpm dev:web

# Build all packages
pnpm build

# Run all tests
pnpm test

# Lint all packages
pnpm lint

# Clean all build artifacts
pnpm clean

# Run DB migration
pnpm db:migrate
```

---

## Docker Deployment

### One-click deploy (all services)

```bash
pnpm docker:up
# Starts: postgres, redis, and the app on port 3000
```

### Stop all services

```bash
pnpm docker:down
```

### Build and run manually

```bash
docker build -t formai .
docker run -p 3000:3000 \
  -e DB_HOST=localhost \
  -e DB_USER=formai \
  -e DB_PASSWORD=formai \
  -e DB_NAME=formai \
  -e JWT_SECRET=your-secret \
  formai
```

---

## Core Concepts

### Collections

Collections are dynamic database tables defined at runtime. The `collection-manager` plugin stores collection/field definitions in meta-tables and syncs them to the actual database schema.

```typescript
app.collection({
  name: 'products',
  fields: [
    { name: 'title', type: 'string' },
    { name: 'price', type: 'decimal' },
    { name: 'stock', type: 'integer' },
  ],
});
```

### Schema Engine

The schema engine (`@formai/schema-engine`) renders UI from JSON schema definitions stored in the database. Components are registered globally and resolved at runtime.

```json
{
  "type": "void",
  "x-component": "Form",
  "properties": {
    "title": { "x-component": "Input", "x-decorator": "FormItem" }
  }
}
```

### A2X Engine (AI-to-X)

The AI layer (`@formai/ai`) abstracts over multiple LLM providers (OpenAI, Anthropic) and exposes a unified interface for generating collections, UI schemas, workflows, and data through natural language.

### Plugins

Every capability is a plugin. Plugins follow a simple 4-hook lifecycle:

- `load()` — Register collections, routes, middleware
- `install()` — First-time install (seed data, create tables)
- `upgrade()` — Run version migrations
- `destroy()` — Cleanup

```typescript
import { Plugin } from '@formai/plugin';

export default class MyPlugin extends Plugin {
  async load() {
    this.defineCollection({ name: 'my_items', fields: [...] });
    this.registerResource({ name: 'my_items', actions: { list, get, create } });
  }
}
```

---

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions.

Key variables:

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `PORT` | 3000 | HTTP server port |
| `JWT_SECRET` | (required) | JWT signing secret |
| `OPENAI_API_KEY` | — | OpenAI API key for AI features |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `REDIS_URL` | redis://localhost:6379 | Redis connection URL |

---

## Development Rules

- **Language Policy**: All code, comments, database schemas, API responses, and user interface strings within this project must be written strictly in **English**. This ensures international compatibility, codebase consistency, and seamless translation for global developers.

