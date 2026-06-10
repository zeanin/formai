import { useContext, createContext } from 'react';
import { ComponentRegistry, getComponentRegistry } from '../registry';

export const ComponentRegistryContext = createContext<ComponentRegistry | null>(null);

export function useComponentRegistry(): ComponentRegistry {
  const registry = useContext(ComponentRegistryContext);
  return registry || getComponentRegistry();
}
