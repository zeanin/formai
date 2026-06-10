import React, { useState, useRef, useEffect } from 'react';

export interface SettingsItem {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'json';
  options?: Array<{ label: string; value: any }>;
  defaultValue?: any;
}

export interface SchemaSettingsProps {
  schema: any; // Current node's ISchema
  settings: SettingsItem[];
  onUpdate: (patch: Record<string, any>) => void;
  onRemove?: () => void;
}

// Individual setting editor
const SettingEditor: React.FC<{
  item: SettingsItem;
  value: any;
  onChange: (val: any) => void;
}> = ({ item, value, onChange }) => {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 8px',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  switch (item.type) {
    case 'text':
      return (
        <input
          type="text"
          value={value ?? item.defaultValue ?? ''}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          value={value ?? item.defaultValue ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          style={inputStyle}
        />
      );
    case 'boolean':
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={value ?? item.defaultValue ?? false}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span style={{ fontSize: 13, color: '#333' }}>{value ? 'Yes' : 'No'}</span>
        </label>
      );
    case 'select':
      return (
        <select
          value={value ?? item.defaultValue ?? ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, background: '#fff' }}
        >
          <option value="">-- select --</option>
          {(item.options ?? []).map((opt) => (
            <option key={String(opt.value)} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case 'json':
      return (
        <textarea
          value={typeof value === 'object' ? JSON.stringify(value, null, 2) : (value ?? '')}
          rows={4}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
          style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
        />
      );
    default:
      return null;
  }
};

// Right-click or gear icon configuration panel (popover-style)
export const SchemaSettings: React.FC<SchemaSettingsProps> = ({
  schema,
  settings,
  onUpdate,
  onRemove,
}) => {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    settings.forEach((s) => {
      initial[s.key] = schema?.['x-component-props']?.[s.key] ?? s.defaultValue;
    });
    return initial;
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleChange = (key: string, val: any) => {
    const next = { ...values, [key]: val };
    setValues(next);
    onUpdate({ [key]: val });
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          padding: 0,
          border: '1px solid #d9d9d9',
          borderRadius: 4,
          background: '#fff',
          cursor: 'pointer',
          color: '#666',
          fontSize: 13,
        }}
      >
        ⚙
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 1050,
            marginTop: 4,
            width: 280,
            background: '#fff',
            border: '1px solid #e8e8e8',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid #f0f0f0',
              fontSize: 13,
              fontWeight: 600,
              color: '#333',
            }}
          >
            Component Settings
          </div>

          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {settings.map((item) => (
              <div key={item.key}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#666', fontWeight: 500 }}>
                  {item.label}
                </label>
                <SettingEditor
                  item={item}
                  value={values[item.key]}
                  onChange={(val) => handleChange(item.key, val)}
                />
              </div>
            ))}
          </div>

          {onRemove && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid #f0f0f0' }}>
              <button
                onClick={() => {
                  setOpen(false);
                  onRemove();
                }}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid #ff4d4f',
                  borderRadius: 4,
                  background: 'transparent',
                  color: '#ff4d4f',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Delete Component
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Toolbar that appears on hover over a designable node
export const DesignToolbar: React.FC<{
  uid: string;
  onSettings: () => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAIOptimize?: () => void;
}> = ({ onSettings, onRemove, onMoveUp, onMoveDown, onAIOptimize }) => {
  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    padding: 0,
    border: '1px solid #d9d9d9',
    borderRadius: 3,
    background: '#fff',
    cursor: 'pointer',
    color: '#555',
    fontSize: 12,
    transition: 'background 0.15s, border-color 0.15s',
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: '2px 4px',
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      {onMoveUp && (
        <button
          style={btnStyle}
          title="Move up"
          onClick={onMoveUp}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
        >
          ↑
        </button>
      )}
      {onMoveDown && (
        <button
          style={btnStyle}
          title="Move down"
          onClick={onMoveDown}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
        >
          ↓
        </button>
      )}
      <button
        style={btnStyle}
        title="Settings"
        onClick={onSettings}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
      >
        ⚙
      </button>
      {onAIOptimize && (
        <button
          style={{ ...btnStyle, color: '#1677ff', borderColor: '#1677ff' }}
          title="AI Optimize"
          onClick={onAIOptimize}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#e6f4ff')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
        >
          AI
        </button>
      )}
      <button
        style={{ ...btnStyle, color: '#ff4d4f', borderColor: '#ff4d4f' }}
        title="Remove"
        onClick={onRemove}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff1f0')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
      >
        ✕
      </button>
    </div>
  );
};
