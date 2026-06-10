import React, { useState, createContext, useContext, useCallback } from 'react';

export interface DesignModeContextValue {
  mode: 'design' | 'preview';
  setMode: (mode: 'design' | 'preview') => void;
  toggleMode: () => void;
}

export const DesignModeContext = createContext<DesignModeContextValue>({
  mode: 'preview',
  setMode: () => {},
  toggleMode: () => {},
});

export const useDesignMode = () => useContext(DesignModeContext);

export const DesignModeProvider: React.FC<{
  children: React.ReactNode;
  defaultMode?: 'design' | 'preview';
}> = ({ children, defaultMode = 'preview' }) => {
  const [mode, setModeState] = useState<'design' | 'preview'>(defaultMode);

  const setMode = useCallback((next: 'design' | 'preview') => {
    setModeState(next);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => (current === 'design' ? 'preview' : 'design'));
  }, []);

  return (
    <DesignModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </DesignModeContext.Provider>
  );
};

// Toggle button - switches between design and preview modes
export const DesignModeToggle: React.FC = () => {
  const { mode, toggleMode } = useDesignMode();
  const isDesign = mode === 'design';

  return (
    <button
      onClick={toggleMode}
      title={isDesign ? 'Switch to Preview' : 'Switch to Design'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        border: `1px solid ${isDesign ? '#1677ff' : '#d9d9d9'}`,
        borderRadius: 6,
        background: isDesign ? '#e6f4ff' : '#fff',
        color: isDesign ? '#1677ff' : '#555',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
        transition: 'all 0.2s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '1';
      }}
    >
      {isDesign ? (
        <>
          <span style={{ fontSize: 14 }}>👁</span>
          <span>Preview</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: 14 }}>✏️</span>
          <span>Design</span>
        </>
      )}
    </button>
  );
};
