import React from 'react';

export interface ComponentRegistration {
  component: React.ComponentType<any>;
  title?: string;
  category?: 'layout' | 'block' | 'input' | 'display' | 'action' | 'navigation';
  description?: string;
  defaultProps?: Record<string, any>;
  /** For AI: describe what this component does and its props */
  aiDescription?: string;
  propsSchema?: Record<string, any>;
}

export class ComponentRegistry {
  private components: Map<string, ComponentRegistration> = new Map();

  register(name: string, registration: ComponentRegistration): void {
    this.components.set(name, registration);
  }

  get(name: string): ComponentRegistration | undefined {
    return this.components.get(name);
  }

  has(name: string): boolean {
    return this.components.has(name);
  }

  remove(name: string): void {
    this.components.delete(name);
  }

  getAll(): Map<string, ComponentRegistration> {
    return new Map(this.components);
  }

  getByCategory(category: string): ComponentRegistration[] {
    const result: ComponentRegistration[] = [];
    for (const registration of this.components.values()) {
      if (registration.category === category) {
        result.push(registration);
      }
    }
    return result;
  }

  /**
   * Returns a summary of all registered components for AI context generation.
   */
  toAIContext(): Array<{ name: string; category: string; description: string; props: any }> {
    const result: Array<{ name: string; category: string; description: string; props: any }> = [];
    for (const [name, reg] of this.components.entries()) {
      result.push({
        name,
        category: reg.category || 'unknown',
        description: reg.aiDescription || reg.description || '',
        props: reg.propsSchema || {},
      });
    }
    return result;
  }
}

// Global singleton
let globalRegistry: ComponentRegistry | null = null;

export function getComponentRegistry(): ComponentRegistry {
  if (!globalRegistry) {
    globalRegistry = new ComponentRegistry();
  }
  return globalRegistry;
}

export function registerComponent(name: string, registration: ComponentRegistration): void {
  getComponentRegistry().register(name, registration);
}
