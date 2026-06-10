import React, { useState, useCallback, useRef } from 'react';
import { ISchema } from '@formai/shared';
import { useDesignable } from '../hooks/useDesignable';

export interface DesignableNodeProps {
  uid: string;
  schema: ISchema;
  componentName?: string;
  children: React.ReactNode;
}

/**
 * DesignableNode — wraps a rendered schema component in design mode.
 *
 * When design mode is active (designable=true from DesignableContext):
 * - Shows a dashed blue border on hover
 * - Renders a floating toolbar (move up/down, AI, settings, remove)
 * - Clicking the AI button notifies SchemaPage to open the AI design panel
 *   for this specific block
 */
export const DesignableNode: React.FC<DesignableNodeProps> = ({
  uid,
  schema,
  componentName,
  children,
}) => {
  const { designable, onRemove, onSelectBlock, hoveredUid, setHoveredUid, onMove } = useDesignable();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hovered = hoveredUid === uid;

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm(`Remove this block (${componentName || uid})?`)) {
        onRemove?.(uid);
      }
    },
    [uid, componentName, onRemove],
  );

  const handleAI = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectBlock?.(uid, schema);
    },
    [uid, schema, onSelectBlock],
  );

  const handleSettingsToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSettingsOpen((v) => !v);
  }, []);

  if (!designable) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      data-design-uid={uid}
      onMouseOver={(e) => {
        e.stopPropagation();
        setHoveredUid?.(uid);
      }}
      onMouseLeave={(e) => {
        e.stopPropagation();
        if (hoveredUid === uid) {
          setHoveredUid?.(null);
        }
      }}
      style={{
        position: 'relative',
        outline: hovered ? '2px dashed #4096ff' : '2px dashed transparent',
        outlineOffset: 2,
        borderRadius: 4,
        transition: 'outline-color 0.15s',
      }}
    >
      {/* Hover toolbar */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            top: -1,
            right: -1,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: '0 4px 0 6px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            padding: '2px 4px',
            userSelect: 'none',
          }}
          onMouseOver={(e) => {
            e.stopPropagation();
            setHoveredUid?.(uid);
          }}
        >
          {/* Component label */}
          <span
            style={{
              fontSize: 10,
              color: '#4096ff',
              fontWeight: 600,
              padding: '0 4px',
              letterSpacing: '0.02em',
            }}
          >
            {componentName || 'Block'}
          </span>

          <div style={{ width: 1, height: 14, background: '#f0f0f0' }} />

          {/* AI Optimize button */}
          <ToolbarButton
            title="AI Design Assistant"
            color="#722ed1"
            hoverBg="#f9f0ff"
            onClick={handleAI}
            icon="✦"
          />

          {/* Move Up button */}
          <ToolbarButton
            title="Move Up"
            color="#1677ff"
            hoverBg="#e6f4ff"
            onClick={(e) => {
              e.stopPropagation();
              onMove?.(uid, 'up');
            }}
            icon="↑"
          />

          {/* Move Down button */}
          <ToolbarButton
            title="Move Down"
            color="#1677ff"
            hoverBg="#e6f4ff"
            onClick={(e) => {
              e.stopPropagation();
              onMove?.(uid, 'down');
            }}
            icon="↓"
          />

          {/* Settings button */}
          <ToolbarButton
            title="Settings"
            color="#555"
            hoverBg="#f5f5f5"
            onClick={handleSettingsToggle}
            icon="⚙"
            active={settingsOpen}
          />

          {/* Remove button */}
          <ToolbarButton
            title="Remove block"
            color="#ff4d4f"
            hoverBg="#fff1f0"
            onClick={handleRemove}
            icon="✕"
          />
        </div>
      )}

      {/* Inline settings popover */}
      {settingsOpen && (
        <InlineSettingsPanel
          uid={uid}
          schema={schema}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Actual component content */}
      {children}
    </div>
  );
};

// ─── Toolbar button helper ────────────────────────────────────────────────────

interface ToolbarButtonProps {
  title: string;
  icon: string;
  color: string;
  hoverBg: string;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  title,
  icon,
  color,
  hoverBg,
  onClick,
  active,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        padding: 0,
        border: 'none',
        borderRadius: 3,
        background: active ? hoverBg : isHovered ? hoverBg : 'transparent',
        color,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        transition: 'background 0.12s',
        lineHeight: 1,
      }}
    >
      {icon}
    </button>
  );
};

// ─── Inline Settings Panel ────────────────────────────────────────────────────

interface InlineSettingsPanelProps {
  uid: string;
  schema: ISchema;
  onClose: () => void;
}

const InlineSettingsPanel: React.FC<InlineSettingsPanelProps> = ({
  uid,
  schema,
  onClose,
}) => {
  const { onPatch } = useDesignable();

  const isTable = schema['x-component'] === 'Table';
  const isForm = schema['x-component'] === 'Form';
  const isField = schema['x-decorator'] === 'FormItem';
  const isGrid = schema['x-component'] === 'Grid';
  const isGridCol = schema['x-component'] === 'Grid.Col' || schema['x-component'] === 'Grid.Column';

  // 1. Generic title / label
  const [titleValue, setTitleValue] = useState<string>(
    (schema['x-component-props'] as any)?.title || schema.title || '',
  );

  // 2. Table-specific state (columns list)
  const [columnsList, setColumnsList] = useState<any[]>(() => {
    if (isTable) {
      return (schema['x-component-props'] as any)?.columns || [];
    }
    return [];
  });

  // 3. Form-specific state (fields list)
  const [fieldsList, setFieldsList] = useState<any[]>(() => {
    if (isForm && schema.properties) {
      return Object.entries(schema.properties)
        .filter(([key]) => key !== 'actions')
        .map(([key, child]: [string, any]) => {
          const validator = child['x-validator'];
          const isReq = Array.isArray(validator) 
            ? !!(validator[0] as any)?.required 
            : !!(validator as any)?.required;
          return {
            key,
            title: child.title || key,
            component: child['x-component'] || 'Input',
            type: child.type || 'string',
            required: isReq,
          };
        });
    }
    return [];
  });

  // 4. Field-specific state
  const [fieldType, setFieldType] = useState<string>(schema['x-component'] || 'Input');
  const [fieldRequired, setFieldRequired] = useState<boolean>(() => {
    if (isField) {
      const validator = schema['x-validator'];
      if (Array.isArray(validator)) {
        return !!(validator[0] as any)?.required;
      }
      return !!(validator as any)?.required;
    }
    return false;
  });

  // 5. Grid-specific state (columns count)
  const [gridCols, setGridCols] = useState<number>(() => {
    if (isGrid) {
      return (schema['x-component-props'] as any)?.cols || 2;
    }
    return 2;
  });

  // 6. GridCol-specific state (span control 1-24)
  const [gridSpan, setGridSpan] = useState<number>(() => {
    if (isGridCol) {
      return (schema['x-component-props'] as any)?.span || 12;
    }
    return 12;
  });

  const handleApply = () => {
    const patch: any = {};

    if (isTable) {
      patch['x-component-props'] = {
        ...(schema['x-component-props'] as any),
        title: titleValue || undefined,
        columns: columnsList,
      };
    } else if (isForm) {
      // Re-create schema properties based on visual list
      const properties: Record<string, any> = {};
      fieldsList.forEach((f) => {
        properties[f.key] = {
          type: f.type || 'string',
          'x-uid': `field_${f.key}_${Math.random().toString(36).slice(2, 6)}`,
          title: f.title,
          'x-decorator': 'FormItem',
          'x-component': f.component,
          'x-component-props': f.component === 'AmountInput' ? { precision: 2, currency: 'CNY' } : {},
          'x-validator': f.required ? [{ required: true, message: `${f.title} is required` }] : undefined,
        };
      });
      // Keep action bar
      if (schema.properties?.actions) {
        properties['actions'] = schema.properties.actions;
      }
      patch.properties = properties;
    } else if (isField) {
      patch.title = titleValue;
      patch['x-component'] = fieldType;
      patch['x-validator'] = fieldRequired
        ? [{ required: true, message: `${titleValue} is required` }]
        : undefined;
      patch['x-component-props'] = {
        ...(schema['x-component-props'] as any),
        title: titleValue || undefined,
      };
    } else if (isGrid) {
      patch['x-component-props'] = {
        ...(schema['x-component-props'] as any),
        cols: gridCols,
      };
    } else if (isGridCol) {
      patch['x-component-props'] = {
        ...(schema['x-component-props'] as any),
        span: gridSpan,
      };
    } else {
      patch['x-component-props'] = {
        ...(schema['x-component-props'] as any),
        title: titleValue || undefined,
      };
    }

    onPatch?.(uid, patch);
    onClose();
  };

  const handleAddColumn = () => {
    setColumnsList((prev) => [
      ...prev,
      {
        title: 'New Column',
        dataIndex: `col_${Date.now().toString(36).slice(-4)}`,
        key: `col_${Date.now().toString(36).slice(-4)}`,
      },
    ]);
  };

  const handleRemoveColumn = (index: number) => {
    setColumnsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleColumnChange = (index: number, field: string, val: any) => {
    setColumnsList((prev) =>
      prev.map((col, i) => (i === index ? { ...col, [field]: val } : col)),
    );
  };

  const handleAddField = () => {
    const key = `field_${Date.now().toString(36).slice(-4)}`;
    setFieldsList((prev) => [
      ...prev,
      {
        key,
        title: 'New Field',
        component: 'Input',
        type: 'string',
        required: false,
      },
    ]);
  };

  const handleRemoveField = (key: string) => {
    setFieldsList((prev) => prev.filter((f) => f.key !== key));
  };

  const handleFieldChange = (key: string, field: string, val: any) => {
    setFieldsList((prev) =>
      prev.map((f) => (f.key === key ? { ...f, [field]: val } : f)),
    );
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    color: '#888',
    marginBottom: 3,
    fontWeight: 600,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 8px',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    background: '#fff',
    height: 24,
    padding: '2px 4px',
  };

  return (
    <>
      {/* Semi-transparent Backdrop Overlay with blur effect */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 1999,
        }}
      />

      {/* Visual Block Designer Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2000,
          width: 360,
          background: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
          overflow: 'hidden',
          textAlign: 'left',
        }}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #f5f5f5',
          background: '#fafafa',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
          ⚙ Visual Block Designer
        </span>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 16,
            color: '#999',
            padding: 0,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Settings fields */}
      <div
        style={{
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxHeight: 320,
          overflowY: 'auto',
        }}
      >
        {/* Component info */}
        <div>
          <label style={labelStyle}>Component Block</label>
          <code
            style={{
              display: 'block',
              fontSize: 12,
              padding: '3px 6px',
              background: '#f5f5f5',
              borderRadius: 4,
              color: '#1677ff',
              fontWeight: 600,
            }}
          >
            {schema['x-component'] || 'unknown'}
          </code>
        </div>

        {/* Title override */}
        {!isForm && (
          <div>
            <label style={labelStyle}>Title / Label</label>
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              placeholder="e.g. Orders Table"
              style={inputStyle}
            />
          </div>
        )}

        {/* ─── Table Columns Manager ─── */}
        {isTable && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <label style={labelStyle}>Table Columns</label>
              <button
                onClick={handleAddColumn}
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 3,
                  border: '1px solid #1677ff',
                  background: '#e6f4ff',
                  color: '#1677ff',
                  cursor: 'pointer',
                }}
              >
                + Add
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {columnsList.map((col, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: 6,
                    background: '#fafafa',
                    border: '1px solid #e8e8e8',
                    borderRadius: 4,
                  }}
                >
                  <input
                    type="text"
                    value={col.title}
                    onChange={(e) => handleColumnChange(index, 'title', e.target.value)}
                    placeholder="Title"
                    style={{ ...inputStyle, width: '40%', fontSize: 11, padding: '2px 4px' }}
                  />
                  <input
                    type="text"
                    value={col.dataIndex}
                    onChange={(e) => handleColumnChange(index, 'dataIndex', e.target.value)}
                    placeholder="Field"
                    style={{ ...inputStyle, width: '30%', fontSize: 11, padding: '2px 4px' }}
                  />
                  <select
                    value={col.render || ''}
                    onChange={(e) => handleColumnChange(index, 'render', e.target.value || undefined)}
                    style={{ ...selectStyle, width: '30%', fontSize: 11 }}
                  >
                    <option value="">Standard</option>
                    <option value="Amount">Currency</option>
                    <option value="DateTime">DateTime</option>
                    <option value="Badge">Badge</option>
                  </select>
                  <button
                    onClick={() => handleRemoveColumn(index)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#ff4d4f',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 'bold',
                    }}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Form Fields Manager ─── */}
        {isForm && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <label style={labelStyle}>Form Fields</label>
              <button
                onClick={handleAddField}
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 3,
                  border: '1px solid #1677ff',
                  background: '#e6f4ff',
                  color: '#1677ff',
                  cursor: 'pointer',
                }}
              >
                + Add Field
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fieldsList.map((field) => (
                <div
                  key={field.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: 6,
                    background: '#fafafa',
                    border: '1px solid #e8e8e8',
                    borderRadius: 4,
                  }}
                >
                  <input
                    type="text"
                    value={field.title}
                    onChange={(e) => handleFieldChange(field.key, 'title', e.target.value)}
                    placeholder="Label"
                    style={{ ...inputStyle, width: '40%', fontSize: 11, padding: '2px 4px' }}
                  />
                  <select
                    value={field.component}
                    onChange={(e) => handleFieldChange(field.key, 'component', e.target.value)}
                    style={{ ...selectStyle, width: '35%', fontSize: 11 }}
                  >
                    <option value="Input">Input</option>
                    <option value="AmountInput">AmountInput</option>
                    <option value="DatePicker">DatePicker</option>
                    <option value="Select">Select</option>
                    <option value="Switch">Switch</option>
                  </select>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 10,
                      gap: 2,
                      width: '20%',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => handleFieldChange(field.key, 'required', e.target.checked)}
                    />
                    Req
                  </label>
                  <button
                    onClick={() => handleRemoveField(field.key)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#ff4d4f',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 'bold',
                    }}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Form Field Detail Editor ─── */}
        {isField && (
          <>
            <div>
              <label style={labelStyle}>Widget Component</label>
              <select
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value)}
                style={selectStyle}
              >
                <option value="Input">Input</option>
                <option value="AmountInput">Monetary Input</option>
                <option value="DatePicker">DatePicker</option>
                <option value="Select">Select Dropdown</option>
                <option value="Switch">Toggle Switch</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#333',
                  cursor: 'pointer',
                  marginTop: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={fieldRequired}
                  onChange={(e) => setFieldRequired(e.target.checked)}
                />
                Required Field (Validate empty input)
              </label>
            </div>
          </>
        )}

        {/* ─── Grid Block Layout Editor ─── */}
        {isGrid && (
          <div>
            <label style={labelStyle}>Columns Count</label>
            <select
              value={gridCols}
              onChange={(e) => setGridCols(parseInt(e.target.value))}
              style={selectStyle}
            >
              <option value={1}>1 Column (Full Width)</option>
              <option value={2}>2 Columns</option>
              <option value={3}>3 Columns</option>
              <option value={4}>4 Columns</option>
            </select>
          </div>
        )}

        {/* ─── Grid Column Size Editor ─── */}
        {isGridCol && (
          <div>
            <label style={labelStyle}>Column Span Width (1-24)</label>
            <select
              value={gridSpan}
              onChange={(e) => setGridSpan(parseInt(e.target.value))}
              style={selectStyle}
            >
              {[1, 2, 3, 4, 6, 8, 12, 16, 18, 20, 24].map((spanVal) => (
                <option key={spanVal} value={spanVal}>
                  {spanVal} / 24 ({Math.round((spanVal / 24) * 100)}%)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid #f5f5f5',
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          onClick={handleApply}
          style={{
            flex: 1,
            padding: '5px 0',
            border: 'none',
            borderRadius: 4,
            background: 'linear-gradient(135deg, #1677ff, #722ed1)',
            color: '#fff',
            fontSize: 12,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Save Changes
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '5px 10px',
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            background: '#fff',
            fontSize: 12,
            cursor: 'pointer',
            color: '#666',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
    </>
  );
};
