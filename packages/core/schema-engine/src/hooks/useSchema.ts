import { useState, useCallback } from 'react';
import { ISchema } from '@formai/shared';
import { Schema } from '../schema';

export function useSchema(initialSchema: ISchema) {
  const [schema, setSchema] = useState<ISchema>(initialSchema);

  const updateNode = useCallback((targetUid: string, patch: Partial<ISchema>) => {
    setSchema((prev) => Schema.update(prev, targetUid, patch));
  }, []);

  const insertNode = useCallback((targetUid: string, newNode: ISchema) => {
    setSchema((prev) => Schema.insertAfter(prev, targetUid, newNode));
  }, []);

  const removeNode = useCallback((targetUid: string) => {
    setSchema((prev) => Schema.remove(prev, targetUid));
  }, []);

  return { schema, setSchema, updateNode, insertNode, removeNode };
}
