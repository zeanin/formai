import React from 'react';
import { getComponentRegistry } from '@formai/schema-engine';
import { registerCoreComponents } from '../components';

export interface ApplicationOptions {
  /** Base URL for API requests */
  apiBaseURL?: string;
  /** Whether to auto-register core components */
  registerCoreComponents?: boolean;
}

/**
 * ClientApplication - the main entry point for configuring a Formai frontend app.
 *
 * Usage:
 * ```ts
 * const app = new ClientApplication({ apiBaseURL: 'http://localhost:3000' });
 * app.use(MyCustomProvider);
 * app.addComponent('MyComponent', MyComponent);
 * const Root = app.getRootComponent();
 * ```
 */
export class ClientApplication {
  private _providers: React.ComponentType<any>[] = [];
  private _components: Record<string, React.ComponentType<any>> = {};
  private _options: ApplicationOptions;

  constructor(options: ApplicationOptions = {}) {
    this._options = {
      registerCoreComponents: true,
      ...options,
    };
  }

  get providers(): React.ComponentType<any>[] {
    return [...this._providers];
  }

  get components(): Record<string, React.ComponentType<any>> {
    return { ...this._components };
  }

  /**
   * Add a React context provider to the application's provider chain.
   */
  use(provider: React.ComponentType<any>): this {
    this._providers.push(provider);
    return this;
  }

  /**
   * Register a component by name in the global component registry.
   */
  addComponent(name: string, component: React.ComponentType<any>): this {
    this._components[name] = component;
    const registry = getComponentRegistry();
    registry.register(name, { component });
    return this;
  }

  /**
   * Initialize the application (register core components, etc.)
   * Called automatically by getRootComponent().
   */
  init(): void {
    if (this._options.registerCoreComponents !== false) {
      registerCoreComponents();
    }

    // Register any custom components
    const registry = getComponentRegistry();
    for (const [name, component] of Object.entries(this._components)) {
      registry.register(name, { component });
    }
  }

  /**
   * Returns the root React component that wraps the entire application
   * with all registered providers.
   */
  getRootComponent(): React.ComponentType<{ children?: React.ReactNode }> {
    this.init();

    const providers = [...this._providers];

    const RootComponent: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
      return providers.reduceRight(
        (acc, Provider) => React.createElement(Provider, {}, acc),
        children as React.ReactElement,
      );
    };

    RootComponent.displayName = 'FormaiApp';
    return RootComponent;
  }
}

export default ClientApplication;
