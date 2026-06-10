import React, { useEffect } from 'react';
import { ComponentRegistryContext, getComponentRegistry } from '@formai/schema-engine';
import { registerCoreComponents } from '../components';

export interface SchemaComponentProviderProps {
  children: React.ReactNode;
  /** Pass additional components to register beyond the core set */
  components?: Record<string, React.ComponentType<any>>;
}

export const SchemaComponentProvider: React.FC<SchemaComponentProviderProps> = ({
  children,
  components,
}) => {
  const registry = getComponentRegistry();

  useEffect(() => {
    // Register built-in core components
    registerCoreComponents();

    // Register any extra components passed in
    if (components) {
      for (const [name, component] of Object.entries(components)) {
        registry.register(name, { component });
      }
    }
  }, [registry, components]);

  return (
    <ComponentRegistryContext.Provider value={registry}>
      {children}
    </ComponentRegistryContext.Provider>
  );
};

export default SchemaComponentProvider;
