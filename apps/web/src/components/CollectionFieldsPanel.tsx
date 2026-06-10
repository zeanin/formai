import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Typography, Modal, Form, Input, Select,
  Popconfirm, message, Tooltip, InputNumber, Switch, Divider, Empty,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  LinkOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  LockOutlined,
} from '@ant-design/icons';

const { Text } = Typography;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('formai_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as any),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.errors?.[0]?.message ?? `HTTP ${res.status}`);
  return json;
}

// ─── Field type metadata ──────────────────────────────────────────────────────

type FieldType =
  | 'string' | 'text' | 'integer' | 'float' | 'double' | 'decimal'
  | 'boolean' | 'date' | 'datetime' | 'json' | 'jsonb' | 'uuid'
  | 'array' | 'password' | 'enum' | 'virtual'
  | 'belongsTo' | 'hasOne' | 'hasMany' | 'belongsToMany';

const SCALAR_TYPES: FieldType[] = [
  'string', 'text', 'integer', 'float', 'double', 'decimal',
  'boolean', 'date', 'datetime', 'json', 'jsonb', 'uuid',
  'array', 'password', 'enum', 'virtual',
];

const RELATION_TYPES: FieldType[] = [
  'belongsTo', 'hasOne', 'hasMany', 'belongsToMany',
];

const FIELD_TYPE_META: Record<string, { color: string; icon?: React.ReactNode; group: 'scalar' | 'relation' }> = {
  string:        { color: 'blue',    group: 'scalar' },
  text:          { color: 'blue',    group: 'scalar' },
  integer:       { color: 'geekblue', group: 'scalar' },
  float:         { color: 'geekblue', group: 'scalar' },
  double:        { color: 'geekblue', group: 'scalar' },
  decimal:       { color: 'geekblue', group: 'scalar' },
  boolean:       { color: 'orange',  group: 'scalar' },
  date:          { color: 'purple',  group: 'scalar' },
  datetime:      { color: 'purple',  group: 'scalar' },
  json:          { color: 'cyan',    group: 'scalar' },
  jsonb:         { color: 'cyan',    group: 'scalar' },
  uuid:          { color: 'default', group: 'scalar' },
  array:         { color: 'cyan',    group: 'scalar' },
  password:      { color: 'red',     group: 'scalar' },
  enum:          { color: 'gold',    group: 'scalar' },
  virtual:       { color: 'default', group: 'scalar' },
  belongsTo:     { color: 'green',   group: 'relation' },
  hasOne:        { color: 'green',   group: 'relation' },
  hasMany:       { color: 'lime',    group: 'relation' },
  belongsToMany: { color: 'lime',    group: 'relation' },
};

// System fields that exist in every collection (auto-created by DB)
const SYSTEM_FIELD_NAMES = new Set([
  'id', 'createdAt', 'updatedAt', 'deletedAt',
  'created_at', 'updated_at', 'deleted_at',
  'isDeleted', 'is_deleted', 'deleted'
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldTypeBadge({ type }: { type: string }) {
  const meta = FIELD_TYPE_META[type] || { color: 'default', group: 'scalar' };
  const isRelation = meta.group === 'relation';
  return (
    <Tag
      color={meta.color}
      icon={isRelation ? <LinkOutlined /> : undefined}
      style={{ fontSize: 11, margin: 0 }}
    >
      {type}
    </Tag>
  );
}

// ─── Add / Edit Field Modal ───────────────────────────────────────────────────

interface FieldFormModalProps {
  open: boolean;
  collectionName: string;
  /** If set, we're editing an existing field */
  editingField?: any;
  onClose: () => void;
  onSuccess: () => void;
}

function FieldFormModal({ open, collectionName, editingField, onClose, onSuccess }: FieldFormModalProps) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [fieldType, setFieldType] = useState<FieldType>('string');
  const isEdit = !!editingField;

  useEffect(() => {
    if (open) {
      if (editingField) {
        form.setFieldsValue({
          name: editingField.name,
          type: editingField.type,
          allowNull: editingField.options?.allowNull ?? true,
          unique: editingField.options?.unique ?? false,
          index: editingField.options?.index ?? false,
          defaultValue: editingField.options?.defaultValue,
          comment: editingField.options?.comment,
          length: editingField.options?.length,
          precision: editingField.options?.precision,
          scale: editingField.options?.scale,
          values: editingField.options?.values?.join(', '),
          target: editingField.options?.target,
          foreignKey: editingField.options?.foreignKey,
          through: editingField.options?.through,
        });
        setFieldType(editingField.type);
      } else {
        form.resetFields();
        setFieldType('string');
      }
    }
  }, [open, editingField, form]);

  const handleFinish = async (values: any) => {
    setSaving(true);
    try {
      const options: any = {};
      if (values.allowNull !== undefined) options.allowNull = values.allowNull;
      if (values.unique) options.unique = true;
      if (values.index) options.index = true;
      if (values.defaultValue !== undefined && values.defaultValue !== '') {
        options.defaultValue = values.defaultValue;
      }
      if (values.comment) options.comment = values.comment;
      if (values.length) options.length = values.length;
      if (values.precision) options.precision = values.precision;
      if (values.scale) options.scale = values.scale;
      if (values.type === 'enum' && values.values) {
        options.values = values.values.split(',').map((v: string) => v.trim()).filter(Boolean);
      }
      if (values.target) options.target = values.target;
      if (values.foreignKey) options.foreignKey = values.foreignKey;
      if (values.through) options.through = values.through;

      if (isEdit) {
        await apiFetch(`/api/fields/${editingField.id}`, {
          method: 'PUT',
          body: JSON.stringify({ values: { type: values.type, options } }),
        });
        message.success(`Field "${editingField.name}" updated`);
      } else {
        await apiFetch('/api/fields', {
          method: 'POST',
          body: JSON.stringify({
            values: {
              collectionName,
              name: values.name,
              type: values.type,
              options,
            },
          }),
        });
        message.success(`Field "${values.name}" added`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isRelation = RELATION_TYPES.includes(fieldType);
  const needsTarget = ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(fieldType);
  const needsThrough = fieldType === 'belongsToMany';
  const needsLength = fieldType === 'string';
  const needsDecimalOpts = ['decimal', 'float', 'double'].includes(fieldType);
  const needsEnumValues = fieldType === 'enum';

  return (
    <Modal
      title={
        <Space>
          {isEdit ? <EditOutlined /> : <PlusOutlined />}
          {isEdit ? `Edit field: ${editingField?.name}` : 'Add Field'}
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            on <Text code style={{ fontSize: 12 }}>{collectionName}</Text>
          </Text>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={isEdit ? 'Save Changes' : 'Add Field'}
      confirmLoading={saving}
      width={560}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ allowNull: true, unique: false, index: false }}
        style={{ marginTop: 8 }}
      >
        {/* Name — read-only in edit mode */}
        <Form.Item
          label="Field Name"
          name="name"
          rules={[
            { required: true, message: 'Required' },
            { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: 'Start with a letter, use letters/numbers/underscores' },
          ]}
        >
          <Input
            placeholder="e.g. totalAmount"
            disabled={isEdit}
            prefix={isEdit ? <LockOutlined style={{ color: '#bbb' }} /> : undefined}
          />
        </Form.Item>

        {/* Type */}
        <Form.Item label="Field Type" name="type" rules={[{ required: true }]}>
          <Select
            showSearch
            onChange={(v) => setFieldType(v as FieldType)}
            optionLabelProp="label"
          >
            <Select.OptGroup label="Scalar Fields">
              {SCALAR_TYPES.map((t) => (
                <Select.Option key={t} value={t} label={t}>
                  <Space>
                    <FieldTypeBadge type={t} />
                  </Space>
                </Select.Option>
              ))}
            </Select.OptGroup>
            <Select.OptGroup label="Relations">
              {RELATION_TYPES.map((t) => (
                <Select.Option key={t} value={t} label={t}>
                  <Space>
                    <FieldTypeBadge type={t} />
                  </Space>
                </Select.Option>
              ))}
            </Select.OptGroup>
          </Select>
        </Form.Item>

        {/* Type-specific options */}
        {needsLength && (
          <Form.Item label="Max Length" name="length" extra="Leave empty for VARCHAR(255)">
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
        )}

        {needsDecimalOpts && (
          <Space.Compact style={{ width: '100%', marginBottom: 24 }}>
            <Form.Item label="Precision" name="precision" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber min={1} max={65} style={{ width: '100%' }} placeholder="e.g. 10" />
            </Form.Item>
            <Form.Item label="Scale" name="scale" style={{ flex: 1, marginBottom: 0, marginLeft: 8 }}>
              <InputNumber min={0} max={30} style={{ width: '100%' }} placeholder="e.g. 2" />
            </Form.Item>
          </Space.Compact>
        )}

        {needsEnumValues && (
          <Form.Item
            label="Enum Values"
            name="values"
            rules={[{ required: true, message: 'Add at least one value' }]}
            extra="Comma-separated values, e.g. pending, processing, shipped, delivered"
          >
            <Input placeholder="value1, value2, value3" />
          </Form.Item>
        )}

        {/* Relation-specific */}
        {needsTarget && (
          <Form.Item
            label="Target Collection"
            name="target"
            rules={[{ required: true, message: 'Required for relations' }]}
            extra="The name of the related collection"
          >
            <Input placeholder="e.g. customers" />
          </Form.Item>
        )}
        {needsTarget && (
          <Form.Item label="Foreign Key" name="foreignKey" extra="Leave empty to use convention">
            <Input placeholder="e.g. customerId" />
          </Form.Item>
        )}
        {needsThrough && (
          <Form.Item
            label="Through (Join Table)"
            name="through"
            rules={[{ required: true, message: 'Required for many-to-many' }]}
            extra="The join table name"
          >
            <Input placeholder="e.g. order_products" />
          </Form.Item>
        )}

        {/* Scalar field options */}
        {!isRelation && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <Space wrap size={24}>
              <Form.Item label="Allow Null" name="allowNull" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch size="small" />
              </Form.Item>
              <Form.Item label="Unique" name="unique" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch size="small" />
              </Form.Item>
              <Form.Item label="Index" name="index" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch size="small" />
              </Form.Item>
            </Space>

            <Form.Item label="Default Value" name="defaultValue" style={{ marginTop: 16 }}>
              <Input placeholder="Leave empty for no default" />
            </Form.Item>

            <Form.Item
              label={
                <Space size={4}>
                  Comment
                  <Tooltip title="Stored as a SQL column comment, useful for AI context">
                    <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 11 }} />
                  </Tooltip>
                </Space>
              }
              name="comment"
            >
              <Input.TextArea rows={2} placeholder="e.g. Total order amount in USD" />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}

// ─── CollectionFieldsPanel ────────────────────────────────────────────────────

interface CollectionFieldsPanelProps {
  collectionName: string;
  isAdmin?: boolean;
}

export function CollectionFieldsPanel({ collectionName, isAdmin = false }: CollectionFieldsPanelProps) {
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>(
        `/api/fields?filter[collectionName]=${collectionName}&pageSize=200`,
      );
      setFields(res?.data ?? []);
    } catch (err: any) {
      message.error(`Failed to load fields: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [collectionName]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (field: any) => {
    try {
      await apiFetch(`/api/fields/${field.id}`, { method: 'DELETE' });
      message.success(`Field "${field.name}" removed`);
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  // Combine system fields (virtual display) with real fields from API
  const systemRows = [
    { id: '__id', name: 'id', type: 'integer', _system: true, options: { primaryKey: true, autoIncrement: true } },
    { id: '__createdAt', name: 'createdAt', type: 'datetime', _system: true, options: {} },
    { id: '__updatedAt', name: 'updatedAt', type: 'datetime', _system: true, options: {} },
  ];

  const userFields = fields.filter((f) => !SYSTEM_FIELD_NAMES.has(f.name));
  const allRows = [...systemRows, ...userFields];

  const columns = [
    {
      title: 'Field Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <Space size={6}>
          {record._system && (
            <Tooltip title="System field — auto-managed">
              <KeyOutlined style={{ color: '#faad14', fontSize: 12 }} />
            </Tooltip>
          )}
          <Text code style={{ fontSize: 12 }}>{name}</Text>
          {record._system && <Tag style={{ fontSize: 10, padding: '0 4px' }}>system</Tag>}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (type: string) => <FieldTypeBadge type={type} />,
    },
    {
      title: 'Options',
      key: 'options',
      render: (_: any, record: any) => {
        if (record._system) {
          const tags = [];
          if (record.options?.primaryKey) tags.push(<Tag key="pk" color="gold" style={{ fontSize: 10, padding: '0 4px' }}>PK</Tag>);
          if (record.options?.autoIncrement) tags.push(<Tag key="ai" style={{ fontSize: 10, padding: '0 4px' }}>Auto</Tag>);
          return <Space size={4}>{tags}</Space>;
        }
        const opts = record.options || {};
        const tags: React.ReactNode[] = [];
        if (opts.unique) tags.push(<Tag key="u" color="orange" style={{ fontSize: 10, padding: '0 4px' }}>UNIQUE</Tag>);
        if (opts.index) tags.push(<Tag key="i" style={{ fontSize: 10, padding: '0 4px' }}>INDEX</Tag>);
        if (opts.allowNull === false) tags.push(<Tag key="nn" color="red" style={{ fontSize: 10, padding: '0 4px' }}>NOT NULL</Tag>);
        if (opts.values?.length) tags.push(
          <Tooltip key="enum" title={opts.values.join(', ')}>
            <Tag color="gold" style={{ fontSize: 10, padding: '0 4px' }}>
              {opts.values.slice(0, 2).join(' | ')}{opts.values.length > 2 ? ' ...' : ''}
            </Tag>
          </Tooltip>
        );
        if (opts.target) tags.push(
          <Tag key="rel" color="green" style={{ fontSize: 10, padding: '0 4px' }}>
            <LinkOutlined /> {opts.target}
          </Tag>
        );
        if (opts.defaultValue !== undefined && opts.defaultValue !== null && opts.defaultValue !== '') {
          tags.push(
            <Tooltip key="dv" title={`Default: ${opts.defaultValue}`}>
              <Tag style={{ fontSize: 10, padding: '0 4px' }}>default</Tag>
            </Tooltip>
          );
        }
        return tags.length > 0
          ? <Space size={4}>{tags}</Space>
          : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
      },
    },
    {
      title: 'Comment',
      key: 'comment',
      render: (_: any, record: any) => {
        const comment = record.options?.comment;
        return comment
          ? <Text type="secondary" style={{ fontSize: 11 }}>{comment}</Text>
          : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, record: any) => {
        if (record._system || !isAdmin) return null;
        return (
          <Space size={4}>
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => setEditingField(record)}
              style={{ padding: '0 4px', fontSize: 11 }}
            />
            <Popconfirm
              title={`Remove field "${record.name}"?`}
              description="This will drop the column from the database table."
              onConfirm={() => handleDelete(record)}
              okType="danger"
              okText="Remove"
            >
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                style={{ padding: '0 4px', fontSize: 11 }}
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Space size={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {userFields.length} user-defined field{userFields.length !== 1 ? 's' : ''} · 3 system fields
          </Text>
        </Space>
        <Space size={6}>
          {isAdmin && (
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddOpen(true)}
            >
              Add Field
            </Button>
          )}
          <Button size="small" icon={<ReloadOutlined />} onClick={load}>
            Refresh
          </Button>
        </Space>
      </div>

      <Table
        dataSource={allRows}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
        rowClassName={(record) => record._system ? '' : ''}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size={2}>
                  <Text type="secondary" style={{ fontSize: 12 }}>No user-defined fields yet</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {isAdmin ? 'Click "Add Field" to define the schema for this collection.' : 'No fields have been defined for this collection.'}
                  </Text>
                </Space>
              }
            />
          ),
        }}
      />

      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          <InfoCircleOutlined style={{ marginRight: 4 }} />
          Adding or removing fields will immediately ALTER the database table. System fields (id, createdAt, updatedAt) cannot be edited.
        </Text>
      </div>

      {/* Add field modal */}
      <FieldFormModal
        open={addOpen}
        collectionName={collectionName}
        onClose={() => setAddOpen(false)}
        onSuccess={load}
      />

      {/* Edit field modal */}
      <FieldFormModal
        open={!!editingField}
        collectionName={collectionName}
        editingField={editingField}
        onClose={() => setEditingField(null)}
        onSuccess={load}
      />
    </div>
  );
}
