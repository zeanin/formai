import { createContext, useContext } from 'react';
import { ISchema } from '@formai/shared';

export interface DesignableContextValue {
  designable: boolean;
  setDesignable: (val: boolean) => void;
  /** Merge a partial schema patch into the node with the given uid */
  onPatch?: (uid: string, patch: Partial<ISchema>) => void;
  /** Remove the node with the given uid from its parent */
  onRemove?: (uid: string) => void;
  /** Insert a new schema node relative to the given uid */
  onInsert?: (uid: string, position: 'before' | 'after' | 'child', schema: ISchema) => void;
  /** Notify the page that a specific block has been selected for AI editing */
  onSelectBlock?: (uid: string, schema: ISchema) => void;
  /** Keep track of the currently hovered visual block ID */
  hoveredUid?: string | null;
  /** Function to update the hovered visual block ID */
  setHoveredUid?: (uid: string | null) => void;
  /** Reorder blocks by moving the target uid up or down */
  onMove?: (uid: string, direction: 'up' | 'down') => void;
}

export const DesignableContext = createContext<DesignableContextValue>({
  designable: false,
  setDesignable: () => {},
});

export function useDesignable(): DesignableContextValue {
  return useContext(DesignableContext);
}
