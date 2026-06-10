import type { ToolDefinition } from '@formai/shared';

export type ToolHandler = (args: any) => Promise<any>;

interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export class ToolRegistry {
  private tools: Map<string, ToolEntry> = new Map();

  register(name: string, definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(name, { definition, handler });
  }

  get(name: string): ToolEntry | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((entry) => entry.definition);
  }

  async execute(name: string, args: any): Promise<any> {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new Error(`Tool "${name}" not found in registry`);
    }
    return entry.handler(args);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }
}
