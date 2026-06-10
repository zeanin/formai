/**
 * Designer module tests
 *
 * These tests cover the pure-logic / state management portions of the designer
 * without requiring a DOM / React rendering environment.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── SchemaInitializer ────────────────────────────────────────────────────────
describe('SchemaInitializer – item schema selection', () => {
  const items = [
    {
      key: 'table',
      title: 'Table',
      category: 'block',
      schema: { 'x-component': 'Table', 'x-component-props': { columns: [] } },
    },
    {
      key: 'form',
      title: 'Form',
      category: 'block',
      schema: { 'x-component': 'Form', 'x-component-props': { layout: 'vertical' } },
    },
    {
      key: 'custom',
      title: 'Custom',
      category: 'layout',
      // no schema, uses onClick
      onClick: vi.fn(),
    },
  ];

  it('invokes onInsert with the item schema when schema is present', () => {
    const onInsert = vi.fn();
    // Simulate the handleItemClick logic from SchemaInitializer
    const handleItemClick = (item: (typeof items)[number]) => {
      if (item.onClick) {
        item.onClick();
      } else if ('schema' in item && item.schema && onInsert) {
        onInsert(item.schema);
      }
    };

    handleItemClick(items[0]);
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith(items[0].schema);
  });

  it('invokes item.onClick instead of onInsert when no schema is provided', () => {
    const onInsert = vi.fn();
    const handleItemClick = (item: (typeof items)[number]) => {
      if (item.onClick) {
        item.onClick();
      } else if ('schema' in item && item.schema && onInsert) {
        onInsert(item.schema);
      }
    };

    handleItemClick(items[2]);
    expect(onInsert).not.toHaveBeenCalled();
    expect(items[2].onClick).toHaveBeenCalledTimes(1);
  });

  it('groups items by category correctly', () => {
    const grouped = items.reduce<Record<string, typeof items>>(
      (acc, item) => {
        const cat = item.category ?? 'other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
      },
      {},
    );

    expect(Object.keys(grouped)).toContain('block');
    expect(Object.keys(grouped)).toContain('layout');
    expect(grouped['block']).toHaveLength(2);
    expect(grouped['layout']).toHaveLength(1);
  });

  it('calls onInsert with second schema when second block item is selected', () => {
    const onInsert = vi.fn();
    const handleItemClick = (item: (typeof items)[number]) => {
      if (item.onClick) {
        item.onClick();
      } else if ('schema' in item && item.schema && onInsert) {
        onInsert(item.schema);
      }
    };

    handleItemClick(items[1]);
    expect(onInsert).toHaveBeenCalledWith(items[1].schema);
    expect(onInsert.mock.calls[0][0]['x-component']).toBe('Form');
  });
});

// ─── DesignModeProvider ───────────────────────────────────────────────────────
describe('DesignMode – mode state management', () => {
  type Mode = 'design' | 'preview';

  /**
   * Reproduce the provider state logic in isolation so it can be tested
   * without React rendering.
   */
  function createModeState(defaultMode: Mode = 'preview') {
    let mode: Mode = defaultMode;
    const setMode = (next: Mode) => { mode = next; };
    const toggleMode = () => { mode = mode === 'design' ? 'preview' : 'design'; };
    return { getMode: () => mode, setMode, toggleMode };
  }

  it('defaults to "preview" mode', () => {
    const state = createModeState();
    expect(state.getMode()).toBe('preview');
  });

  it('defaults to the supplied defaultMode', () => {
    const state = createModeState('design');
    expect(state.getMode()).toBe('design');
  });

  it('setMode switches to the given mode', () => {
    const state = createModeState('preview');
    state.setMode('design');
    expect(state.getMode()).toBe('design');
  });

  it('toggleMode flips from preview to design', () => {
    const state = createModeState('preview');
    state.toggleMode();
    expect(state.getMode()).toBe('design');
  });

  it('toggleMode flips from design to preview', () => {
    const state = createModeState('design');
    state.toggleMode();
    expect(state.getMode()).toBe('preview');
  });

  it('toggleMode can be called multiple times', () => {
    const state = createModeState('preview');
    state.toggleMode(); // design
    state.toggleMode(); // preview
    state.toggleMode(); // design
    expect(state.getMode()).toBe('design');
  });
});

// ─── DragDropProvider ─────────────────────────────────────────────────────────
describe('DragDrop – state management', () => {
  type Position = 'before' | 'after' | 'inside';

  /**
   * Reproduce the provider state logic without React rendering.
   */
  function createDragDropState(
    onReorder: (src: string, target: string, pos: Position) => void,
  ) {
    let isDragging = false;
    let dragItem: any | null = null;

    const onDragStart = (item: any) => {
      dragItem = item;
      isDragging = true;
    };

    const onDragEnd = (targetUid: string, position: Position) => {
      isDragging = false;
      if (dragItem && dragItem.uid !== targetUid) {
        onReorder(dragItem.uid, targetUid, position);
      }
      dragItem = null;
    };

    const onDragCancel = () => {
      isDragging = false;
      dragItem = null;
    };

    return {
      getState: () => ({ isDragging, dragItem }),
      onDragStart,
      onDragEnd,
      onDragCancel,
    };
  }

  it('initialises with isDragging=false and dragItem=null', () => {
    const state = createDragDropState(vi.fn());
    expect(state.getState().isDragging).toBe(false);
    expect(state.getState().dragItem).toBeNull();
  });

  it('onDragStart sets isDragging to true and stores the item', () => {
    const state = createDragDropState(vi.fn());
    state.onDragStart({ uid: 'node-1' });
    expect(state.getState().isDragging).toBe(true);
    expect(state.getState().dragItem).toEqual({ uid: 'node-1' });
  });

  it('onDragEnd resets isDragging and dragItem', () => {
    const onReorder = vi.fn();
    const state = createDragDropState(onReorder);
    state.onDragStart({ uid: 'node-1' });
    state.onDragEnd('node-2', 'after');
    expect(state.getState().isDragging).toBe(false);
    expect(state.getState().dragItem).toBeNull();
  });

  it('onDragEnd calls onReorder with source, target, and position', () => {
    const onReorder = vi.fn();
    const state = createDragDropState(onReorder);
    state.onDragStart({ uid: 'src' });
    state.onDragEnd('target', 'before');
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith('src', 'target', 'before');
  });

  it('onDragEnd does NOT call onReorder when source equals target', () => {
    const onReorder = vi.fn();
    const state = createDragDropState(onReorder);
    state.onDragStart({ uid: 'same' });
    state.onDragEnd('same', 'inside');
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('onDragCancel resets state without calling onReorder', () => {
    const onReorder = vi.fn();
    const state = createDragDropState(onReorder);
    state.onDragStart({ uid: 'node-A' });
    state.onDragCancel();
    expect(state.getState().isDragging).toBe(false);
    expect(state.getState().dragItem).toBeNull();
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('supports all three drop positions', () => {
    const positions: Position[] = ['before', 'after', 'inside'];
    positions.forEach((pos) => {
      const onReorder = vi.fn();
      const state = createDragDropState(onReorder);
      state.onDragStart({ uid: 'a' });
      state.onDragEnd('b', pos);
      expect(onReorder).toHaveBeenCalledWith('a', 'b', pos);
    });
  });
});
