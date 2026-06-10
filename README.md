# Formai

> **AI-Native, Schema-Driven No-Code Application Platform**

Formai is a next-generation platform for building full-stack enterprise applications dynamically. Driven by AI and dynamic runtime schemas, it enables developers and teams to define, deploy, and scale complex applications through natural language and visual composition—without rebuilding, compiling, or redeploying code.

![Formai System Creation](./docs/assets/formai_system_creation_ui.png)

---

## ⚡ Core Characteristics

* **AI-Native Architecture (A2X Engine):** Translates natural language prompts into database schemas, UI layouts, workflows, and mock data. Powered by a unified API layer supporting OpenAI, Anthropic, and other LLMs.
* **Schema-Driven UI (`@formai/schema-engine`):** Renders highly interactive React interfaces at runtime based on standardized JSON Schema configurations.
* **Dynamic Collection Management:** Modify, scale, and relate database tables on the fly. Real-time PostgreSQL schemas are synced automatically without service interruption.
* **Granular Plug-and-Play Extensibility:** Every enterprise feature (ACL, localized translation, audit logs, workflows, dashboards) is a modular plugin obeying a strict lifecycle (`load`, `install`, `upgrade`, `destroy`).

---

## 🛠 Tech Stack

* **Monorepo Management:** Turborepo + pnpm workspaces
* **Frontend:** React 18 + Vite + Vanilla CSS
* **Backend:** Node.js + Koa + `@formai/resourcer` (dynamic REST router)
* **Database & Cache:** PostgreSQL (via Sequelize ORM) + Redis
* **Auth & ACL:** JWT + Attribute-Based Access Control (ABAC)
* **Testing & Containerization:** Vitest + Docker / Docker Compose

---

## 🚀 Quick Start

### 1. Installation
Ensure you have Node.js >= 20, pnpm >= 9, and Docker installed.
```bash
git clone <repo-url> && cd FormAI
pnpm install
```

### 2. Configure
Copy the example environment file and configure your API keys (e.g., Database, OpenAI/Anthropic):
```bash
cp .env.example .env
```

### 3. Launch
Bring up the backing services and start the development environment:
```bash
pnpm docker:up   # Starts PostgreSQL & Redis
pnpm dev         # Launches server (Port 3000) & web app (Port 5173)
```

---

## 🧩 Key Architecture Concepts

### 1. Dynamic Database Collections
Define database schemas dynamically at runtime. The database engine maps definitions to physical tables.
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

### 2. JSON Schema-Driven Interfaces
Form components and page layouts are stored as JSON and dynamically resolved by the frontend.
```json
{
  "type": "void",
  "x-component": "Form",
  "properties": {
    "title": { "x-component": "Input", "x-decorator": "FormItem" }
  }
}
```

### 3. Modular Plugin Lifecycle
Extend platform capabilities with self-contained plugins that manage their own resources and migrations.
```typescript
import { Plugin } from '@formai/plugin';

export default class CustomPlugin extends Plugin {
  async load() {
    this.defineCollection({ name: 'custom_items', fields: [...] });
    this.registerResource({ name: 'custom_items', actions: { list, create } });
  }
}
```

---

## 🐳 Production Deployment

Use Docker Compose to launch the entire stack in production mode:
```bash
pnpm docker:up
# Build manually:
docker build -t formai .
```

---

## 📜 Development Policy

* **Language Policy:** All code, comments, database schemas, API responses, and user interface strings within this project must be written strictly in **English** to ensure international compatibility and codebase consistency.
