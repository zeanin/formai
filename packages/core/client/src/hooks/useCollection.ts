import { createContext, useContext } from 'react';

export interface CollectionField {
  name: string;
  type: string;
  title?: string;
  required?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  interface?: string;
  uiSchema?: Record<string, any>;
}

export interface Collection {
  name: string;
  title?: string;
  fields: CollectionField[];
  primaryKey?: string;
}

export const CollectionContext = createContext<Collection | null>(null);

export function useCollection(): Collection | null {
  return useContext(CollectionContext);
}

export function useCollectionField(fieldName: string): CollectionField | undefined {
  const collection = useCollection();
  return collection?.fields.find((f) => f.name === fieldName);
}

export default useCollection;
