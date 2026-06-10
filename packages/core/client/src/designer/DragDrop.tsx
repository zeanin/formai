import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface DragDropContextValue {
  isDragging: boolean;
  dragItem: any | null;
  onDragStart: (item: any) => void;
  onDragEnd: (targetUid: string, position: 'before' | 'after' | 'inside') => void;
  onDragCancel: () => void;
}

export const DragDropContext = createContext<DragDropContextValue>({
  isDragging: false,
  dragItem: null,
  onDragStart: () => {},
  onDragEnd: () => {},
  onDragCancel: () => {},
});

export const useDragDrop = () => useContext(DragDropContext);

export const DragDropProvider: React.FC<{
  onReorder: (sourceUid: string, targetUid: string, position: 'before' | 'after' | 'inside') => void;
  children: React.ReactNode;
}> = ({ onReorder, children }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragItem, setDragItem] = useState<any | null>(null);
  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;

  const handleDragStart = useCallback((item: any) => {
    setDragItem(item);
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    (targetUid: string, position: 'before' | 'after' | 'inside') => {
      setIsDragging(false);
      if (dragItem && dragItem.uid !== targetUid) {
        reorderRef.current(dragItem.uid, targetUid, position);
      }
      setDragItem(null);
    },
    [dragItem],
  );

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    setDragItem(null);
  }, []);

  return (
    <DragDropContext.Provider
      value={{
        isDragging,
        dragItem,
        onDragStart: handleDragStart,
        onDragEnd: handleDragEnd,
        onDragCancel: handleDragCancel,
      }}
    >
      {children}
    </DragDropContext.Provider>
  );
};

// Wrapper to make a schema node draggable via HTML5 drag API
export const Draggable: React.FC<{
  uid: string;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ uid, children, disabled }) => {
  const { onDragStart, onDragCancel } = useDragDrop();

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', uid);
        onDragStart({ uid });
      }}
      onDragEnd={(e) => {
        if (e.dataTransfer.dropEffect === 'none') {
          onDragCancel();
        }
      }}
      style={{ cursor: 'grab', position: 'relative' }}
    >
      {/* Drag handle indicator */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: -16,
          transform: 'translateY(-50%)',
          width: 12,
          height: 20,
          cursor: 'grab',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 2,
          opacity: 0,
          transition: 'opacity 0.15s',
        }}
        className="drag-handle"
      >
        <div style={{ width: 8, height: 1, background: '#999', borderRadius: 1 }} />
        <div style={{ width: 8, height: 1, background: '#999', borderRadius: 1 }} />
        <div style={{ width: 8, height: 1, background: '#999', borderRadius: 1 }} />
      </div>
      {children}
    </div>
  );
};

// Drop zone indicator - shows where a dragged item will land
export const DropZone: React.FC<{
  uid: string;
  position: 'before' | 'after' | 'inside';
  children?: React.ReactNode;
}> = ({ uid, position, children }) => {
  const { isDragging, dragItem, onDragEnd } = useDragDrop();
  const [isOver, setIsOver] = useState(false);

  if (!isDragging || !dragItem || dragItem.uid === uid) {
    return <>{children}</>;
  }

  const isHorizontal = position === 'before' || position === 'after';

  return (
    <div
      style={{ position: 'relative' }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        onDragEnd(uid, position);
      }}
    >
      {/* Drop indicator line */}
      {isOver && (
        <div
          style={{
            position: 'absolute',
            zIndex: 100,
            ...(isHorizontal
              ? {
                  left: 0,
                  right: 0,
                  height: 2,
                  background: '#1677ff',
                  borderRadius: 1,
                  ...(position === 'before' ? { top: 0 } : { bottom: 0 }),
                }
              : {
                  inset: 0,
                  border: '2px dashed #1677ff',
                  borderRadius: 4,
                  background: 'rgba(22, 119, 255, 0.04)',
                  pointerEvents: 'none',
                }),
          }}
        />
      )}
      {children}
    </div>
  );
};
