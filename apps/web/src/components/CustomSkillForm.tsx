import React, { useState } from 'react';
import {
  Modal, Form, Input, Select, Switch, Space, Tag, Tooltip,
  Typography, Divider, Button, Alert, Collapse, message,
} from 'antd';
import {
  ThunderboltOutlined,
  InfoCircleOutlined,
  GlobalOutlined,
  CodeOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;
const { TextArea } = Input;

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

// ─── Handler type meta ────────────────────────────────────────────────────────

const HANDLER_TYPES = [
  {
    value: 'webhook',
    label: 'Webhook',
    icon: <GlobalOutlined />,
    description: 'Call an external HTTP interface (POST/GET)',
  },
  {
    value: 'script',
    label: 'Script',
    icon: <CodeOutlined />,
    description: 'Execute server-side JavaScript script',
  },
  {
    value: 'builtin',
    label: 'Built-in Function',
    icon: <ThunderboltOutlined />,
    description: 'Call platform built-in actions (e.g., send emails, notifications, etc.)',
  },
];

// ─── JSON Schema input field editor ──────────────────────────────────────────

interface SchemaField {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

function InputSchemaEditor({
  fields,
  onChange,
}: {
  fields: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
}) {
  const addField = () => {
    onChange([...fields, { name: '', type: 'string', description: '', required: false }]);
  };

  const removeField = (i: number) => {
    onChange(fields.filter((_, idx) => idx !== i));
  };

  const updateField = (i: number, updates: Partial<SchemaField>) => {
    onChange(fields.map((f, idx) => idx === i ? { ...f, ...updates } : f));
  };

  return (
    <div>
      {fields.map((f, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 8,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <Input
            size="small"
            placeholder="Parameter Name"
            value={f.name}
            onChange={(e) => updateField(i, { name: e.target.value })}
            style={{ width: 120 }}
          />
          <Select
            size="small"
            value={f.type}
            onChange={(v) => updateField(i, { type: v })}
            style={{ width: 90 }}
            options={[
              { value: 'string',  label: 'string' },
              { value: 'number',  label: 'number' },
              { value: 'boolean', label: 'boolean' },
              { value: 'object',  label: 'object' },
              { value: 'array',   label: 'array' },
            ]}
          />
          <Input
            size="small"
            placeholder="Description (read by AI)"
            value={f.description}
            onChange={(e) => updateField(i, { description: e.target.value })}
            style={{ flex: 1, minWidth: 120 }}
          />
          <Tooltip title="Required Parameter">
            <Switch
              size="small"
              checked={f.required}
              onChange={(v) => updateField(i, { required: v })}
              checkedChildren="Req"
              unCheckedChildren="Opt"
            />
          </Tooltip>
          <Button
            size="small"
            danger
            onClick={() => removeField(i)}
            style={{ padding: '0 6px' }}
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        size="small"
        icon={<PlusOutlined />}
        onClick={addField}
        type="dashed"
        style={{ width: '100%', marginTop: 4 }}
      >
        Add Parameter
      </Button>
    </div>
  );
}

// ─── CustomSkillForm ──────────────────────────────────────────────────────────

interface CustomSkillFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Preset collection context */
  collectionName?: string;
  appId?: string;
}

/**
 * CustomSkillForm
 * Form dialog for creating custom AI Skills (non-automatically generated CRUD Skills).
 *
 * Supports:
 * - Webhook Handler: Invokes external HTTP API
 * - Script Handler: Executes server-side script (sandbox)
 * - Custom input Schema (parameter format when invoked by AI)
 * - requiresConfirm switch
 * - rolesAllowed permission whitelist
 */
export function CustomSkillForm({
  open,
  onClose,
  onSuccess,
  collectionName,
  appId,
}: CustomSkillFormProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [handlerType, setHandlerType] = useState<string>('webhook');
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      // Build inputSchema
      const inputSchema = {
        type: 'object',
        properties: Object.fromEntries(
          schemaFields.map((f) => [
            f.name,
            { type: f.type, description: f.description },
          ]),
        ),
        required: schemaFields.filter((f) => f.required).map((f) => f.name),
      };

      // Build handler config
      let handler: Record<string, any> = { type: handlerType };
      if (handlerType === 'webhook') {
        handler = {
          type: 'webhook',
          url: values.webhookUrl,
          method: values.webhookMethod || 'POST',
          headers: values.webhookHeaders ? JSON.parse(values.webhookHeaders) : {},
        };
      } else if (handlerType === 'script') {
        handler = {
          type: 'script',
          code: values.scriptCode,
        };
      } else if (handlerType === 'builtin') {
        handler = {
          type: 'builtin',
          action: values.builtinAction,
        };
      }

      const skillPayload = {
        name: values.name,
        title: values.title,
        description: values.description,
        resourceType: collectionName ? 'collection' : 'app',
        resourceName: collectionName || appId || 'global',
        appId: appId || null,
        skillType: 'custom',
        enabled: values.enabled ?? true,
        requiresConfirm: values.requiresConfirm ?? false,
        rolesAllowed: values.rolesAllowed || [],
        inputSchema,
        handler,
        options: {},
      };

      await apiFetch('/api/resource_skills', {
        method: 'POST',
        body: JSON.stringify({ values: skillPayload }),
      });

      message.success(`Skill "${values.title}" created successfully`);
      form.resetFields();
      setSchemaFields([]);
      setHandlerType('webhook');
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(`Creation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedHandlerMeta = HANDLER_TYPES.find((h) => h.value === handlerType);

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#1677ff' }} />
          <span>Create Custom AI Skill</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Create"
      confirmLoading={loading}
      width={680}
      destroyOnClose
    >
      <Alert
        message="Skills are functional units callable by AI. A good name and description allow AI to accurately select and invoke the correct Skill during conversations."
        type="info"
        showIcon
        style={{ marginBottom: 16, fontSize: 12 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          enabled: true,
          requiresConfirm: false,
          webhookMethod: 'POST',
        }}
      >
        {/* Basic info */}
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item
            label="Skill Identifier"
            name="name"
            style={{ flex: 1 }}
            rules={[
              { required: true, message: 'Please enter the identifier' },
              { pattern: /^[a-z][a-z0-9_]*$/, message: 'snake_case format' },
            ]}
            tooltip="Unique identifier, used internally, snake_case format"
          >
            <Input placeholder={collectionName ? `${collectionName}_my_skill` : 'my_custom_skill'} />
          </Form.Item>
          <Form.Item
            label="Display Title"
            name="title"
            style={{ flex: 1 }}
            rules={[{ required: true, message: 'Please enter the display title' }]}
          >
            <Input placeholder="e.g. Query Active Users" />
          </Form.Item>
        </div>

        <Form.Item
          label={
            <Space size={4}>
              <span>AI Description</span>
              <Tooltip title="This description is read by AI to decide when to call this Skill. The more precise the description, the more accurate the AI routing.">
                <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
              </Tooltip>
            </Space>
          }
          name="description"
          rules={[{ required: true, message: 'Please enter description (read by AI)' }]}
        >
          <TextArea
            rows={3}
            placeholder="e.g. Call this Skill when the user wants to query the list of active users within the last 30 days. Returns user ID, name, and last login time."
          />
        </Form.Item>

        <Divider orientation="left" plain style={{ fontSize: 12 }}>Handler Type</Divider>

        {/* Handler type selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {HANDLER_TYPES.map((h) => (
            <div
              key={h.value}
              onClick={() => setHandlerType(h.value)}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: `1px solid ${handlerType === h.value ? '#1677ff' : '#d9d9d9'}`,
                borderRadius: 8,
                cursor: 'pointer',
                background: handlerType === h.value ? '#e6f4ff' : '#fff',
                transition: 'all 0.15s',
              }}
            >
              <Space size={6}>
                <span style={{ color: handlerType === h.value ? '#1677ff' : '#8c8c8c' }}>{h.icon}</span>
                <Text strong style={{ fontSize: 13, color: handlerType === h.value ? '#1677ff' : undefined }}>
                  {h.label}
                </Text>
              </Space>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>{h.description}</div>
            </div>
          ))}
        </div>

        {/* Handler config */}
        {handlerType === 'webhook' && (
          <div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item name="webhookMethod" label="Method" style={{ width: 90 }}>
                <Select options={[
                  { value: 'GET',    label: 'GET' },
                  { value: 'POST',   label: 'POST' },
                  { value: 'PUT',    label: 'PUT' },
                  { value: 'DELETE', label: 'DELETE' },
                ]} />
              </Form.Item>
              <Form.Item
                name="webhookUrl"
                label="URL"
                style={{ flex: 1 }}
                rules={[{ required: true, message: 'Please enter Webhook URL' }, { type: 'url', message: 'Please enter a valid URL' }]}
              >
                <Input placeholder="https://your-api.example.com/hook" />
              </Form.Item>
            </div>
            <Form.Item
              name="webhookHeaders"
              label={<span>Request Headers <Text type="secondary" style={{ fontSize: 11 }}>(JSON format, optional)</Text></span>}
            >
              <TextArea
                rows={2}
                placeholder={'{"Authorization": "Bearer token", "X-Source": "formai"}'}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </Form.Item>
          </div>
        )}

        {handlerType === 'script' && (
          <Form.Item
            name="scriptCode"
            label={
              <Space size={4}>
                <span>Script Code</span>
                <Tag style={{ fontSize: 10 }}>JavaScript</Tag>
              </Space>
            }
            rules={[{ required: true, message: 'Please enter script code' }]}
          >
            <TextArea
              rows={8}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
              placeholder={`// Accessible to args (parameters passed by AI) and db (database operation object)
// The return value will be sent back to AI as the Skill execution output
async function execute({ args, db }) {
  const repo = db.getRepository('orders');
  const result = await repo.find({
    filter: { status: args.status || 'pending' },
    pageSize: args.limit || 10,
  });
  return result;
}`}
            />
          </Form.Item>
        )}

        {handlerType === 'builtin' && (
          <Form.Item
            name="builtinAction"
            label="Built-in Action"
            rules={[{ required: true }]}
          >
            <Select
              placeholder="Select Built-in Action"
              options={[
                { value: 'send_email',        label: 'Send Email' },
                { value: 'send_notification', label: 'Send Notification' },
                { value: 'trigger_workflow',  label: 'Trigger Workflow' },
                { value: 'export_csv',        label: 'Export CSV' },
              ]}
            />
          </Form.Item>
        )}

        <Divider orientation="left" plain style={{ fontSize: 12 }}>Input Parameter Schema</Divider>

        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            <InfoCircleOutlined /> Define parameters that AI needs to provide when calling this Skill. AI will automatically populate these parameters based on user intent.
          </Text>
          <InputSchemaEditor fields={schemaFields} onChange={setSchemaFields} />
        </div>

        <Divider orientation="left" plain style={{ fontSize: 12 }}>Permissions & Security</Divider>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            label={
              <Space size={4}>
                <span>Role Whitelist</span>
                <Tooltip title="Leave empty to allow all roles to invoke">
                  <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
                </Tooltip>
              </Space>
            }
            name="rolesAllowed"
            style={{ flex: 1 }}
          >
            <Select
              mode="tags"
              placeholder="Enter role names, e.g., admin, member (empty = everyone)"
              options={[
                { value: 'root',      label: 'root' },
                { value: 'admin',     label: 'admin' },
                { value: 'developer', label: 'developer' },
                { value: 'member',    label: 'member' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Execution Confirmation" name="requiresConfirm" valuePropName="checked">
            <Switch
              checkedChildren="Yes"
              unCheckedChildren="No"
            />
          </Form.Item>

          <Form.Item label="Enable Immediately" name="enabled" valuePropName="checked">
            <Switch
              defaultChecked
              checkedChildren="Yes"
              unCheckedChildren="No"
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
