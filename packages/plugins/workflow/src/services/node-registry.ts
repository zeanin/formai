import type { NodeHandler } from '../nodes/base';

/**
 * Registry of available node types.
 * All node handlers are registered here by the plugin at startup.
 */
export class NodeRegistry {
  private handlers = new Map<string, NodeHandler>();

  /** Register a node handler. */
  register(handler: NodeHandler): void {
    this.handlers.set(handler.type, handler);
  }

  /** Get a handler by type. */
  get(type: string): NodeHandler | undefined {
    return this.handlers.get(type);
  }

  /** Check whether a type is registered. */
  has(type: string): boolean {
    return this.handlers.has(type);
  }

  /** List all registered types. */
  list(): string[] {
    return Array.from(this.handlers.keys());
  }
}
