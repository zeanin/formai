import React, { useState, useRef, useEffect } from 'react';

export interface InitializerItem {
  key: string;
  title: string;
  icon?: React.ReactNode;
  category?: string;
  schema?: any; // ISchema to insert
  onClick?: () => void;
}

export interface SchemaInitializerProps {
  items: InitializerItem[];
  title?: string;
  icon?: React.ReactNode;
  onInsert?: (schema: any) => void;
  style?: React.CSSProperties;
}

const CATEGORY_LABELS: Record<string, string> = {
  layout: 'Layout',
  block: 'Data Blocks',
  field: 'Form Fields',
  action: 'Actions',
};

// Dropdown button that shows available blocks/fields to add
export const SchemaInitializer: React.FC<SchemaInitializerProps> = ({
  items,
  title = 'Add',
  icon,
  onInsert,
  style,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Group items by category
  const grouped = items.reduce<Record<string, InitializerItem[]>>((acc, item) => {
    const cat = item.category ?? 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const handleItemClick = (item: InitializerItem) => {
    setOpen(false);
    if (item.onClick) {
      item.onClick();
    } else if (item.schema && onInsert) {
      onInsert(item.schema);
    }
  };

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-block', ...style }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 12px',
          border: '1px dashed #d9d9d9',
          borderRadius: 4,
          background: 'transparent',
          cursor: 'pointer',
          color: '#666',
          fontSize: 13,
          transition: 'border-color 0.2s, color 0.2s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#1677ff';
          (e.currentTarget as HTMLButtonElement).style.color = '#1677ff';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#d9d9d9';
          (e.currentTarget as HTMLButtonElement).style.color = '#666';
        }}
      >
        {icon ?? <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>}
        <span>{title}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 1000,
            marginTop: 4,
            minWidth: 200,
            background: '#fff',
            border: '1px solid #e8e8e8',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <div
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#999',
                  background: '#fafafa',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </div>
              {catItems.map((item) => (
                <div
                  key={item.key}
                  onClick={() => handleItemClick(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#333',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background = '#f5f5f5')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background = 'transparent')
                  }
                >
                  {item.icon && <span style={{ fontSize: 14, color: '#666' }}>{item.icon}</span>}
                  <span>{item.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Block schemas
const BLOCK_SCHEMAS: InitializerItem[] = [
  {
    key: 'table',
    title: 'Table',
    category: 'block',
    schema: { 'x-component': 'Table', 'x-component-props': { columns: [], dataSource: [] } },
  },
  {
    key: 'form',
    title: 'Form',
    category: 'block',
    schema: { 'x-component': 'Form', 'x-component-props': { layout: 'vertical' }, properties: {} },
  },
  {
    key: 'details',
    title: 'Details',
    category: 'block',
    schema: { 'x-component': 'Details', 'x-component-props': { fields: [] } },
  },
  {
    key: 'calendar',
    title: 'Calendar',
    category: 'block',
    schema: { 'x-component': 'Calendar', 'x-component-props': {} },
  },
  {
    key: 'kanban',
    title: 'Kanban',
    category: 'block',
    schema: { 'x-component': 'Kanban', 'x-component-props': {} },
  },
  {
    key: 'chart',
    title: 'Chart',
    category: 'block',
    schema: { 'x-component': 'Chart', 'x-component-props': {} },
  },
];

// Pre-configured block initializer
export const BlockInitializer: React.FC<{ onInsert: (schema: any) => void }> = ({ onInsert }) => (
  <SchemaInitializer
    items={BLOCK_SCHEMAS}
    title="Add block"
    onInsert={onInsert}
  />
);

// Field type schemas
const FIELD_TYPE_SCHEMAS: InitializerItem[] = [
  {
    key: 'input',
    title: 'Input',
    category: 'field',
    schema: { 'x-component': 'FormItem', 'x-component-props': { label: 'Input' }, properties: { input: { 'x-component': 'Input' } } },
  },
  {
    key: 'select',
    title: 'Select',
    category: 'field',
    schema: { 'x-component': 'FormItem', 'x-component-props': { label: 'Select' }, properties: { select: { 'x-component': 'Select', 'x-component-props': { options: [] } } } },
  },
  {
    key: 'date',
    title: 'Date Picker',
    category: 'field',
    schema: { 'x-component': 'FormItem', 'x-component-props': { label: 'Date' }, properties: { date: { 'x-component': 'DatePicker' } } },
  },
  {
    key: 'checkbox',
    title: 'Checkbox',
    category: 'field',
    schema: { 'x-component': 'FormItem', 'x-component-props': { label: 'Checkbox' }, properties: { checkbox: { 'x-component': 'Checkbox' } } },
  },
  {
    key: 'switch',
    title: 'Switch',
    category: 'field',
    schema: { 'x-component': 'FormItem', 'x-component-props': { label: 'Switch' }, properties: { toggle: { 'x-component': 'Switch' } } },
  },
  {
    key: 'upload',
    title: 'Upload',
    category: 'field',
    schema: { 'x-component': 'FormItem', 'x-component-props': { label: 'Upload' }, properties: { file: { 'x-component': 'Upload' } } },
  },
];

// Pre-configured field initializer - shows collection fields or generic field types
export const FieldInitializer: React.FC<{
  onInsert: (schema: any) => void;
  fields?: any[];
}> = ({ onInsert, fields }) => {
  const items: InitializerItem[] = fields
    ? fields.map((f) => ({
        key: f.name,
        title: f.title ?? f.name,
        category: 'field',
        schema: {
          'x-component': 'FormItem',
          'x-component-props': { label: f.title ?? f.name },
          properties: { [f.name]: { 'x-component': f.component ?? 'Input', 'x-component-props': f.props ?? {} } },
        },
      }))
    : FIELD_TYPE_SCHEMAS;

  return <SchemaInitializer items={items} title="Add field" onInsert={onInsert} />;
};
