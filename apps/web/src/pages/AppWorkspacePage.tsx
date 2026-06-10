import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Table, Button, Space, Tag, Typography, Modal, Form, Input, Select,
  Popconfirm, message, Empty, Tabs, Tooltip, Badge, Card, Row, Col,
  Statistic, Switch, Spin, Breadcrumb, Collapse, Alert, Avatar,
  Drawer, Progress,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, DatabaseOutlined,
  AppstoreOutlined, ThunderboltOutlined, TeamOutlined,
  MenuOutlined, ReloadOutlined, ArrowLeftOutlined,
  SettingOutlined, PlayCircleOutlined, DashboardOutlined,
  RobotOutlined, LockOutlined, EditOutlined, BookOutlined,
  SaveOutlined, SyncOutlined, EyeOutlined, SendOutlined,
  UserOutlined, ExclamationCircleOutlined, LoadingOutlined,
  ScheduleOutlined, CheckOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useDesignMode, KnowledgeWiki } from '@formai/client';
import { AppMenuDesigner } from '../components/AppMenuDesigner';
import { CollectionSkillsPanel } from '../components/CollectionSkillsPanel';
import { CollectionFieldsPanel } from '../components/CollectionFieldsPanel';
import { WorkflowDiagram } from '../components/WorkflowDiagram';
import {
  RuntimeAIAssistant,
  RuntimeAIAssistantTrigger,
} from '../components/RuntimeAIAssistant';

const { Title, Text, Paragraph } = Typography;
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

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft: { color: 'orange', label: 'Draft' },
  published: { color: 'green', label: 'Published' },
  archived: { color: 'default', label: 'Archived' },
};

// ─── App-scoped Collections Tab ──────────────────────────────────────────────

const CONFIGURE_ROLES = new Set(['root', 'admin', 'developer']);

function AppCollectionsTab({ appId, currentRole }: { appId: string; currentRole?: string | null }) {
  const isAdmin = CONFIGURE_ROLES.has(currentRole || '');
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>(`/api/collections?pageSize=100&appId=${appId}`);
      setCollections(res?.data ?? []);
    } catch (err: any) { message.error(err.message); }
    finally { setLoading(false); }
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (values: any) => {
    setSubmitting(true);
    try {
      let fields: any[] = [];
      if (values.aiGenerate) {
        const aiRes = await apiFetch<any>('/api/ai/a2data/fields', {
          method: 'POST',
          body: JSON.stringify({
            collectionName: values.name,
            description: values.options?.description || '',
          }),
        });
        fields = aiRes?.data ?? [];
        message.success(`✨ AI auto-generated ${fields.length} recommended fields!`);
      }
      const { aiGenerate, ...submitValues } = values;
      await apiFetch('/api/collections', {
        method: 'POST',
        body: JSON.stringify({ values: { ...submitValues, fields, appId } }),
      });
      message.success('Collection created');
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch (err: any) { message.error(err.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (name: string) => {
    try {
      await apiFetch(`/api/collections/${name}`, { method: 'DELETE' });
      message.success('Deleted');
      load();
    } catch (err: any) { message.error(err.message); }
  };

  const columns = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (v: string) => <Text code>{v}</Text>,
    },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    {
      title: 'Scope', dataIndex: 'appId', key: 'appId',
      render: (v: string) => v
        ? <Tag color="blue">{v}</Tag>
        : <Tag>Shared</Tag>,
    },
    {
      title: 'Actions', key: 'actions', render: (_: any, r: any) => (
        <Popconfirm title="Delete this collection?" description="Drops the table." onConfirm={() => handleDelete(r.name)} okType="danger">
          <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
        </Popconfirm>
      ),
    },
  ];

  // Expandable row: shows Fields + AI Skills tabs for the collection
  const expandedRowRender = (record: any) => {
    const expandTabs = [
      {
        key: 'fields',
        label: (
          <Space size={4}>
            <DatabaseOutlined />
            Fields
          </Space>
        ),
        children: (
          <div style={{ padding: '8px 0 4px 0' }}>
            <CollectionFieldsPanel
              collectionName={record.name}
              isAdmin={isAdmin}
            />
          </div>
        ),
      },
      {
        key: 'skills',
        label: (
          <Space size={4}>
            <RobotOutlined />
            AI Skills
            <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>Runtime</Tag>
          </Space>
        ),
        children: (
          <div style={{ padding: '8px 0 4px 0' }}>
            <CollectionSkillsPanel
              collectionName={record.name}
              appId={appId}
              isAdmin={isAdmin}
            />
          </div>
        ),
      },
    ];
    return (
      <div style={{ padding: '4px 0 4px 0' }}>
        <Tabs
          size="small"
          defaultActiveKey="fields"
          items={expandTabs}
          style={{ marginTop: -4 }}
        />
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Space size={8}>
          <Text type="secondary">
            Data models owned by this app.
          </Text>
          <Tag icon={<DatabaseOutlined />} color="blue" style={{ fontSize: 11 }}>
            Expand row to manage Fields &amp; AI Skills
          </Tag>
        </Space>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Add Collection
        </Button>
      </div>
      <Table
        dataSource={collections}
        columns={columns}
        rowKey="name"
        loading={loading}
        size="small"
        expandable={{
          expandedRowRender,
          expandRowByClick: false,
          rowExpandable: () => true,
        }}
        locale={{
          emptyText: <Empty description="No collections yet. Add one to define your data model." image={Empty.PRESENTED_IMAGE_SIMPLE} />,
        }}
      />
      <Modal title="Add Collection" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Create" confirmLoading={submitting}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Name" name="name" rules={[{ required: true }, { pattern: /^[a-z][a-z0-9_]*$/, message: 'snake_case' }]}>
            <Input placeholder="e.g. orders" />
          </Form.Item>
          <Form.Item label="Title" name="title"><Input placeholder="e.g. Orders" /></Form.Item>
          <Form.Item label="Description" name={['options', 'description']} extra="Helps AI suggest recommended columns"><Input.TextArea rows={2} placeholder="Describe the purpose of this table (e.g. storing customer support tickets)" /></Form.Item>
          <Form.Item name="aiGenerate" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="✨ AI Auto-generate Fields" unCheckedChildren="Manual Creation" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── App-scoped UI Schemas Tab ───────────────────────────────────────────────

function AppSchemasTab({ appId }: { appId: string }) {
  const navigate = useNavigate();
  const { setMode } = useDesignMode();
  const [schemas, setSchemas] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, menusRes] = await Promise.all([
        apiFetch<any>(`/api/uiSchemas?pageSize=100&appId=${appId}`),
        apiFetch<any>(`/api/apps/${appId}/menus`).catch(() => ({ data: [] })),
      ]);
      setSchemas(res?.data ?? []);
      setMenus(menusRes?.data ?? []);
    } catch {
      setSchemas([]);
      setMenus([]);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (values: any) => {
    setSubmitting(true);
    try {
      let schema: any = {
        type: 'object',
        'x-component': 'Page',
        'x-component-props': {
          title: values.title || values.uid,
        },
        properties: {},
      };

      if (values.aiGenerate) {
        const aiRes = await apiFetch<any>('/api/ai/a2ui', {
          method: 'POST',
          body: JSON.stringify({
            prompt: `Create a page layout for "${values.title}". Description: ${values.description || ''}`,
            mode: 'create',
          }),
        });
        if (aiRes?.data) {
          schema = aiRes.data;
          message.success('✨ AI auto-generated recommended page layout and components!');
        }
      }

      const { aiGenerate, description, ...submitValues } = values;
      await apiFetch('/api/uiSchemas', {
        method: 'POST',
        body: JSON.stringify({
          values: {
            ...submitValues,
            appId,
            schema,
          },
        }),
      });
      message.success('UI Schema created');
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (uid: string) => {
    try {
      await apiFetch(`/api/uiSchemas/${uid}`, { method: 'DELETE' });
      message.success('UI Schema deleted');
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: 'UID', dataIndex: 'uid', key: 'uid', render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (v: string) => v ? <Tag>{v}</Tag> : <Tag>page</Tag> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: any) => {
        const matchedMenu = menus.find((m) => m.schemaUid === r.uid);

        return (
          <Space size={8}>
            {matchedMenu ? (
              <Button
                size="small"
                type="primary"
                ghost
                icon={<EditOutlined />}
                onClick={() => {
                  setMode('design');
                  navigate(`/apps/${appId}/${matchedMenu.path || matchedMenu.id}`);
                }}
              >
                Design Layout
              </Button>
            ) : (
              <Tooltip title="This page schema is not linked to any sidebar menu yet. Link it in 'Menus' to design it.">
                <Button size="small" type="primary" ghost disabled icon={<EditOutlined />}>
                  Design Layout
                </Button>
              </Tooltip>
            )}
            <Popconfirm title="Delete this page schema?" description="This will delete the schema and its children." onConfirm={() => handleDelete(r.uid)} okType="danger">
              <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text type="secondary">UI pages and blocks owned by this app. Generate them with AI or create manually.</Text>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Add Schema
        </Button>
      </div>
      <Table dataSource={schemas} columns={columns} rowKey="uid" loading={loading} size="small"
        locale={{ emptyText: <Empty description="No UI schemas yet. Use AI to generate pages or add manually." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
      <Modal title="Add UI Schema" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Create" confirmLoading={submitting}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="UID"
            name="uid"
            rules={[
              { required: true, message: 'Please input the UID!' },
              { pattern: /^[a-zA-Z0-9-_]+$/, message: 'Alphanumeric, hyphens, and underscores only' }
            ]}
          >
            <Input placeholder="e.g. customer-management" />
          </Form.Item>
          <Form.Item label="Title" name="title" rules={[{ required: true, message: 'Please input the Title!' }]}>
            <Input placeholder="e.g. Customer Management" />
          </Form.Item>
          <Form.Item label="Description" name="description" extra="Helps AI generate recommended layout blocks">
            <Input.TextArea placeholder="Describe the page layout (e.g. A sales customer list page with search filters, metrics summary cards, and an add form)" rows={2} />
          </Form.Item>
          <Form.Item name="aiGenerate" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="✨ AI Auto-generate Page Elements" unCheckedChildren="Blank Page" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}


// ─── App-scoped Workflows Tab ────────────────────────────────────────────────

function AppWorkflowsTab({ appId }: { appId: string }) {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  // Flowchart Modal States
  const [selectedWorkflow, setSelectedWorkflow] = useState<any | null>(null);
  const [flowchartOpen, setFlowchartOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>(`/api/workflows?pageSize=100&appId=${appId}`);
      setWorkflows(res?.data ?? []);
    } catch (err: any) { message.error(err.message); }
    finally { setLoading(false); }
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (values: any) => {
    setSubmitting(true);
    try {
      let triggerType = values.triggerType || 'manual';
      let triggerConfig = {};
      let nodes: any[] = [];

      if (values.aiGenerate) {
        const aiRes = await apiFetch<any>('/api/ai/a2flow', {
          method: 'POST',
          body: JSON.stringify({
            prompt: `Create a workflow titled "${values.title}". Description: ${values.description || ''}`,
          }),
        });
        if (aiRes?.data) {
          triggerType = aiRes.data.triggerType || triggerType;
          triggerConfig = aiRes.data.triggerConfig || triggerConfig;
          nodes = aiRes.data.nodes || [];
          message.success(`✨ AI auto-generated trigger type "${triggerType}" and ${nodes.length} workflow steps!`);
        }
      }

      const { aiGenerate, description, ...submitValues } = values;
      await apiFetch('/api/workflows', {
        method: 'POST',
        body: JSON.stringify({
          values: {
            ...submitValues,
            triggerType,
            triggerConfig,
            nodes,
            appId,
            description: description || null,
            enabled: false,
          },
        }),
      });
      message.success('Workflow created');
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch (err: any) { message.error(err.message); }
    finally { setSubmitting(false); }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await apiFetch(`/api/workflows/${id}`, { method: 'PUT', body: JSON.stringify({ values: { enabled } }) });
      load();
    } catch (err: any) { message.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/workflows/${id}`, { method: 'DELETE' });
      message.success('Deleted');
      load();
    } catch (err: any) { message.error(err.message); }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, r: any) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, fontWeight: 500 }}
          onClick={() => {
            setSelectedWorkflow(r);
            setFlowchartOpen(true);
          }}
        >
          {v}
        </Button>
      )
    },
    {
      title: 'Trigger', dataIndex: 'triggerType', key: 'triggerType',
      render: (v: string) => <Tag>{v || 'manual'}</Tag>,
    },
    {
      title: 'Status', dataIndex: 'enabled', key: 'enabled',
      render: (v: boolean, r: any) => (
        <Switch checked={v} size="small" checkedChildren="On" unCheckedChildren="Off"
          onChange={(val) => handleToggle(r.id, val)} />
      ),
    },
    {
      title: 'Actions', key: 'actions', render: (_: any, r: any) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedWorkflow(r);
              setFlowchartOpen(true);
            }}
          >
            Flowchart
          </Button>
          <Button size="small" icon={<PlayCircleOutlined />}
            onClick={() => apiFetch(`/api/workflows/${r.id}/trigger`, { method: 'POST', body: '{}' })
              .then(() => message.success('Triggered'))}>
            Run
          </Button>
          <Popconfirm title="Delete?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text type="secondary">Automations scoped to this app's data and events.</Text>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Add Workflow
        </Button>
      </div>
      <Table dataSource={workflows} columns={columns} rowKey="id" loading={loading} size="small"
        locale={{ emptyText: <Empty description="No workflows yet. Add automation for this app." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
      <Modal title="Add Workflow" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Create" confirmLoading={submitting}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Title" name="title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Trigger Type" name="triggerType" initialValue="manual">
            <Select options={[
              { value: 'manual', label: 'Manual' },
              { value: 'collection', label: 'Collection Event' },
              { value: 'schedule', label: 'Scheduled' },
            ]} />
          </Form.Item>
          <Form.Item label="Description" name="description" extra="Helps AI auto-generate trigger and nodes steps">
            <Input.TextArea placeholder="Describe the workflow automation (e.g. When a support ticket is created, check priority, and pause for approval if High)" rows={2} />
          </Form.Item>
          <Form.Item name="aiGenerate" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="✨ AI Auto-generate Workflow Steps" unCheckedChildren="Empty Workflow" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Visual Flowchart & AI Designer Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#161b26' }}>⚡ Immersive Visual Flowchart &amp; AI Copilot</span>
            <Tag color="purple">FormAI Builder</Tag>
          </div>
        }
        open={flowchartOpen}
        onCancel={() => {
          setFlowchartOpen(false);
          setSelectedWorkflow(null);
        }}
        footer={null}
        width={1200}
        centered
        destroyOnClose
        styles={{ body: { padding: 0 } }}
      >
        {selectedWorkflow && (
          <WorkflowDiagram
            workflow={selectedWorkflow}
            appId={appId}
            onClose={() => {
              setFlowchartOpen(false);
              setSelectedWorkflow(null);
            }}
            onSaveSuccess={() => {
              load(); // reload workflow list to reflect changes
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// ─── App Roles Tab (reuse existing logic) ────────────────────────────────────

function AppRolesPanel({ appId }: { appId: string }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>(`/api/apps/${appId}/roles`);
      setRoles(res?.data ?? []);
    } catch (err: any) { message.error(err.message); }
    finally { setLoading(false); }
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values: any) => {
    try {
      await apiFetch(`/api/apps/${appId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ values }),
      });
      message.success('Role created');
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch (err: any) { message.error(err.message); }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v: string) => <Text code>{v}</Text> },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    {
      title: 'Permissions', dataIndex: 'permissions', key: 'permissions',
      render: (perms: string[]) => (
        <Space wrap>
          {perms?.slice(0, 3).map((p) => <Tag key={p} style={{ fontSize: 11 }}>{p}</Tag>)}
          {perms?.length > 3 && <Tag>+{perms.length - 3}</Tag>}
          {(!perms || perms.length === 0) && <Text type="secondary">None</Text>}
        </Space>
      ),
    },
    { title: 'Default', dataIndex: 'isDefault', key: 'isDefault', render: (v: boolean) => v ? <Tag color="blue">Default</Tag> : null },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text type="secondary">Define who can access this app and which menus they see.</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New Role</Button>
      </div>
      <Table dataSource={roles} columns={columns} rowKey="id" loading={loading} size="small" />
      <Modal title="Create Role" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Create">
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}><Input placeholder="e.g. manager" /></Form.Item>
          <Form.Item label="Title" name="title" rules={[{ required: true }]}><Input placeholder="e.g. Manager" /></Form.Item>
          <Form.Item label="Default Role" name="isDefault" valuePropName="checked">
            <Select options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} defaultValue={false} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── App Jobs Tab ────────────────────────────────────────────────────────────
function AppJobsTab({ appId }: { appId: string }) {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>(undefined);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load app workflows
  const loadWorkflows = useCallback(async () => {
    setLoadingWorkflows(true);
    try {
      const res = await apiFetch<any>(`/api/workflows?pageSize=100&appId=${appId}`);
      const wfs = res?.data ?? [];
      setWorkflows(wfs);
      if (wfs.length > 0) {
        setSelectedWorkflowId(wfs[0].id);
      } else {
        setSelectedWorkflowId(undefined);
        setExecutions([]);
      }
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoadingWorkflows(false);
    }
  }, [appId]);

  // Load executions for selected workflow
  const loadExecutions = useCallback(async (workflowId: string) => {
    setLoadingExecutions(true);
    try {
      const res = await apiFetch<any>(`/api/executions?workflowId=${workflowId}&pageSize=50`);
      setExecutions(res?.data ?? []);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoadingExecutions(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  useEffect(() => {
    if (selectedWorkflowId) {
      loadExecutions(selectedWorkflowId);
    } else {
      setExecutions([]);
    }
  }, [selectedWorkflowId, loadExecutions]);

  // View detail
  const handleViewDetail = async (executionId: string) => {
    setLoadingDetail(true);
    setDetailOpen(true);
    try {
      const res = await apiFetch<any>(`/api/executions/${executionId}`);
      setSelectedExecution(res);
    } catch (err: any) {
      message.error(err.message);
      setDetailOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Resume manual node
  const handleResume = async (executionId: string, nodeId: string, approved: boolean) => {
    try {
      await apiFetch(`/api/executions/${executionId}/resume`, {
        method: 'POST',
        body: JSON.stringify({ values: { nodeId, approved } }),
      });
      message.success(approved ? 'Task Approved Successfully' : 'Task Rejected Successfully');
      // Reload detail
      const res = await apiFetch<any>(`/api/executions/${executionId}`);
      setSelectedExecution(res);
      // Reload executions list
      if (selectedWorkflowId) loadExecutions(selectedWorkflowId);
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const getStatusTag = (status: string) => {
    const config: Record<string, { color: string; label: string }> = {
      started: { color: 'blue', label: 'Running' },
      resolved: { color: 'green', label: 'Resolved' },
      rejected: { color: 'orange', label: 'Rejected' },
      cancelled: { color: 'default', label: 'Cancelled' },
      error: { color: 'red', label: 'Error' },
    };
    const c = config[status] || { color: 'default', label: status };
    return <Tag color={c.color}>{c.label}</Tag>;
  };

  const executionColumns = [
    {
      title: 'Execution ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <Text code copyable>{id}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => getStatusTag(v),
    },
    {
      title: 'Trigger Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: any) => (
        <Button size="small" type="link" onClick={() => handleViewDetail(r.id)}>
          View Steps
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Text type="secondary">Monitor workflow execution runs and audit steps.</Text>
          <Select
            placeholder="Select Workflow"
            style={{ width: 280 }}
            value={selectedWorkflowId}
            onChange={(val) => setSelectedWorkflowId(val)}
            loading={loadingWorkflows}
            options={workflows.map((wf) => ({ value: wf.id, label: wf.title }))}
          />
        </Space>
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={() => selectedWorkflowId && loadExecutions(selectedWorkflowId)}
          disabled={!selectedWorkflowId || loadingExecutions}
        >
          Refresh
        </Button>
      </div>

      <Table
        dataSource={executions}
        columns={executionColumns}
        rowKey="id"
        loading={loadingExecutions}
        size="small"
        locale={{
          emptyText: (
            <Empty
              description={
                selectedWorkflowId
                  ? 'No execution runs for this workflow yet. Triggers will generate jobs here.'
                  : 'Please select a workflow to view executions.'
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
      />

      <Modal
        title={
          <Space>
            <span>Execution Details</span>
            {selectedExecution && getStatusTag(selectedExecution.status)}
          </Space>
        }
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setSelectedExecution(null);
        }}
        footer={null}
        width={700}
      >
        {loadingDetail ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        ) : selectedExecution ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Text type="secondary">Execution ID: </Text>
              <Text code>{selectedExecution.id}</Text>
            </div>
            <div>
              <Text type="secondary">Trigger Context: </Text>
              <pre style={{ background: '#fafafa', padding: 8, borderRadius: 6, fontSize: 11, overflowX: 'auto', maxHeight: 150 }}>
                {JSON.stringify(selectedExecution.context, null, 2)}
              </pre>
            </div>
            
            <div>
              <Title level={5} style={{ margin: '8px 0' }}>Executed Steps (Jobs)</Title>
              {(!selectedExecution.jobs || selectedExecution.jobs.length === 0) ? (
                <Empty description="No jobs executed in this run yet." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedExecution.jobs.map((job: any) => {
                    const stepStatusConfig: Record<string, { color: string; label: string }> = {
                      pending: { color: 'blue', label: 'Pending' },
                      resolved: { color: 'green', label: 'Resolved' },
                      rejected: { color: 'orange', label: 'Rejected' },
                      cancelled: { color: 'default', label: 'Cancelled' },
                      error: { color: 'red', label: 'Error' },
                    };
                    const sc = stepStatusConfig[job.status] || { color: 'default', label: job.status };

                    return (
                      <Card
                        key={job.id}
                        size="small"
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                            <Text strong style={{ flex: 1 }}>Step: {job.nodeId}</Text>
                            <Tag color={sc.color}>{sc.label}</Tag>
                          </div>
                        }
                        style={{ border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8 }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {job.result && (
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>Result Payload: </Text>
                              <pre style={{ background: '#f5f5f5', padding: 6, borderRadius: 4, fontSize: 11, overflowX: 'auto', marginBottom: 0 }}>
                                {JSON.stringify(job.result, null, 2)}
                              </pre>
                            </div>
                          )}
                          {job.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                              <Button
                                size="small"
                                type="primary"
                                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                onClick={() => handleResume(selectedExecution.id, job.nodeId, true)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                danger
                                onClick={() => handleResume(selectedExecution.id, job.nodeId, false)}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <Empty description="No details available" />
        )}
      </Modal>
    </div>
  );
}

// ─── Beautiful Minimalist Markdown Parser ─────────────────────────────────────
function MarkdownPreview({ content }: { content: string }) {
  if (!content) return <div style={{ color: '#8c8c8c', fontStyle: 'italic', padding: 12 }}>No blueprint document created. Use AI Copilot on the right to design one!</div>;

  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const parseInlineStyles = (text: string) => {
    return <span dangerouslySetInnerHTML={{ 
      __html: text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.*?)`/g, '<code style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #c41d7f;">$1</code>')
    }} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, lineHeight: '1.7', color: '#262626', fontSize: 13 }}>
      {lines.map((line, idx) => {
        // Handle Code Blocks
        if (line.trim().startsWith('```')) {
          if (inCodeBlock) {
            inCodeBlock = false;
            const code = codeLines.join('\n');
            codeLines = [];
            return (
              <pre key={idx} style={{ background: '#fafafa', padding: '12px 16px', borderRadius: 8, overflowX: 'auto', border: '1px solid rgba(0,0,0,0.05)', fontFamily: 'monospace', fontSize: 12, margin: '8px 0', color: '#595959' }}>
                <code>{code}</code>
              </pre>
            );
          } else {
            inCodeBlock = true;
            return null;
          }
        }
        if (inCodeBlock) {
          codeLines.push(line);
          return null;
        }

        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: 4 }} />;

        // Handle Titles/Headers
        if (trimmed.startsWith('# ')) {
          return <Title level={3} key={idx} style={{ marginTop: 16, marginBottom: 8, borderBottom: '1px solid #f0f0f0', paddingBottom: 6, fontWeight: 700 }}>{trimmed.slice(2)}</Title>;
        }
        if (trimmed.startsWith('## ')) {
          return <Title level={4} key={idx} style={{ marginTop: 14, marginBottom: 6, color: '#1f1f1f', fontWeight: 600 }}>{trimmed.slice(3)}</Title>;
        }
        if (trimmed.startsWith('### ')) {
          return <Title level={5} key={idx} style={{ marginTop: 12, marginBottom: 4, color: '#434343', fontWeight: 600 }}>{trimmed.slice(4)}</Title>;
        }

        // Handle Github Alerts
        if (trimmed.startsWith('> [!NOTE]') || trimmed.startsWith('> [!IMPORTANT]') || trimmed.startsWith('> [!WARNING]')) {
          return null;
        }
        if (trimmed.startsWith('> ')) {
          const content = trimmed.slice(2);
          return (
            <div key={idx} style={{ borderLeft: '4px solid #1677ff', background: '#f0f5ff', padding: '10px 14px', borderRadius: '0 8px 8px 0', margin: '6px 0', fontStyle: 'italic', color: '#595959' }}>
              {parseInlineStyles(content)}
            </div>
          );
        }

        // Handle Unordered Lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} style={{ display: 'flex', gap: 6, paddingLeft: 12, fontSize: 13, margin: '2px 0' }}>
              <span style={{ color: '#1677ff' }}>•</span>
              <span>{parseInlineStyles(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Regular paragraph
        return <div key={idx} style={{ margin: '3px 0' }}>{parseInlineStyles(line)}</div>;
      })}
    </div>
  );
}

// ─── Wiki Tab with Sync Button ────────────────────────────────────────────────

function WikiTabContent({ app, appId }: { app: any; appId: string }) {
  const [syncing, setSyncing] = useState(false);
  const [wikiKey, setWikiKey] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();

  const handleSyncWiki = async () => {
    setSyncing(true);
    try {
      const res = await apiFetch<any>(`/api/apps/${appId}/wiki/sync`, {
        method: 'POST',
        body: '{}',
      });
      if (res?.data?.success) {
        messageApi.success(res.data.message || 'Business domain wiki generated successfully!');
        setWikiKey((k) => k + 1); // force KnowledgeWiki to re-fetch
      } else {
        messageApi.error('AI generation returned an unexpected response.');
      }
    } catch (err: any) {
      messageApi.error(`AI generation failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ padding: '8px 0 16px 0' }}>
      {contextHolder}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text type="secondary">
          Obsidian-Style Business Domain Knowledge Base — maps domain concepts and their relationships using a graph map.
        </Text>
        <Button
          icon={<RobotOutlined />}
          loading={syncing}
          onClick={handleSyncWiki}
          style={{
            background: 'linear-gradient(135deg, #1677ff 0%, #1d39c4 100%)',
            border: 'none',
            color: '#fff',
            borderRadius: 8,
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(22,119,255,0.25)',
          }}
        >
          AI Generate Business Wiki
        </Button>
      </div>
      <KnowledgeWiki
        key={wikiKey}
        collection={`app_${app.name}_memory_nodes`}
        style={{ height: 'calc(100vh - 290px)', minHeight: 600 }}
      />
    </div>
  );
}

// ─── Main AppWorkspacePage ───────────────────────────────────────────────────

export function AppWorkspacePage() {
  const { appId, tabKey } = useParams<{ appId: string; tabKey?: string }>();
  const activeTab = tabKey || 'overview';
  const navigate = useNavigate();
  const [app, setApp] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editForm] = Form.useForm();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  // App Blueprint Markdown states
  const [blueprintText, setBlueprintText] = useState('');
  const [isEditingBlueprint, setIsEditingBlueprint] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);
  const [initAiTriggered, setInitAiTriggered] = useState(false);

  // Dedicated Compiler Monitoring states
  const [compilerDrawerOpen, setCompilerDrawerOpen] = useState(false);
  const [compilationLogs, setCompilationLogs] = useState<string[]>([]);
  const [compilationStatus, setCompilationStatus] = useState<'idle' | 'pending' | 'processing' | 'completed' | 'failed'>('idle');
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [resettingQueue, setResettingQueue] = useState(false);

  const handleResetQueue = async () => {
    setResettingQueue(true);
    try {
      await apiFetch(`/api/apps/${appId}/compilation/reset`, { method: 'POST', body: '{}' });
      message.success('Compilation queue reset successfully!');
      setCompilationStatus('idle');
      setActiveTaskId(null);
      setUpdatingApp(false);
      load();
    } catch (err: any) {
      message.error(`Reset failed: ${err.message}`);
    } finally {
      setResettingQueue(false);
    }
  };

  const agentStates = useMemo(() => {
    const states = {
      db: 'pending',
      ui: 'pending',
      flow: 'pending',
      lead: 'pending'
    };

    if (!compilationLogs || compilationLogs.length === 0) return states;

    let hasDb = false;
    let hasUi = false;
    let hasFlow = false;
    let hasLead = false;

    for (const line of compilationLogs) {
      const lower = line.toLowerCase();
      
      // DB Architect
      if (lower.includes('db architect')) {
        hasDb = true;
        states.db = 'active';
      }
      if (lower.includes('successfully synchronized database schema') || lower.includes('provisioning custom business skills')) {
        states.db = 'completed';
      }

      // UI Engineer
      if (lower.includes('ui engineer')) {
        hasUi = true;
        states.ui = 'active';
        if (states.db === 'active') states.db = 'completed';
      }
      if (lower.includes('creating default admin role') || lower.includes('finalizing setup') || lower.includes('security roles')) {
        states.ui = 'completed';
      }

      // Workflow Specialist
      if (lower.includes('workflow specialist') || lower.includes('workflows')) {
        hasFlow = true;
        states.flow = 'active';
        if (states.db === 'active') states.db = 'completed';
        if (states.ui === 'active') states.ui = 'completed';
      }
      if (lower.includes('trigger for workflow') || lower.includes('dynamically registering')) {
        states.flow = 'active';
      }

      // Lead Release Manager
      if (lower.includes('lead release manager') || lower.includes('deploying specialized multi-agent team') || lower.includes('starting parallel compilation')) {
        hasLead = true;
        states.lead = 'active';
      }
      if (lower.includes('integrity checks passed')) {
        states.lead = 'completed';
      }

      // Success finalizer
      if (lower.includes('complete application modules created successfully') || lower.includes('compiled successfully')) {
        states.db = 'completed';
        states.ui = 'completed';
        states.flow = 'completed';
        states.lead = 'completed';
      }
    }

    // Fallback statuses based on other active steps
    if (states.db === 'active' || states.ui === 'active' || states.flow === 'active') {
      states.lead = 'completed';
    }
    
    return states;
  }, [compilationLogs]);

  const formatConsoleLog = (line: string) => {
    if (line.includes('[🗃️ DB Architect]')) {
      return <div key={line} style={{ color: '#69b1ff', margin: '4px 0', fontFamily: 'Courier New, monospace' }}>{line}</div>;
    }
    if (line.includes('[🎨 UI Engineer]')) {
      return <div key={line} style={{ color: '#ff85c0', margin: '4px 0', fontFamily: 'Courier New, monospace' }}>{line}</div>;
    }
    if (line.includes('[⚡ Workflow Specialist]')) {
      return <div key={line} style={{ color: '#ffd666', margin: '4px 0', fontFamily: 'Courier New, monospace' }}>{line}</div>;
    }
    if (line.includes('Lead Release Manager') || line.includes('[Lead Release Manager]')) {
      return <div key={line} style={{ color: '#b7eb8f', margin: '4px 0', fontFamily: 'Courier New, monospace' }}>{line}</div>;
    }
    if (line.includes('❌') || line.includes('Error') || line.includes('failed')) {
      return <div key={line} style={{ color: '#ff7875', margin: '4px 0', fontFamily: 'Courier New, monospace', fontWeight: 'bold' }}>{line}</div>;
    }
    return <div key={line} style={{ color: '#e8e8e8', margin: '4px 0', fontFamily: 'Courier New, monospace' }}>{line}</div>;
  };

  // Integrated AI Workspace Copilot Chat states
  const [copilotMessages, setCopilotMessages] = useState<any[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I am your AI Workspace Copilot. I help you design, update, and refine this application\'s blueprint document.\n\nTry telling me what feature or database table you want to add, and I\'ll automatically modify the blueprint for you!'
    }
  ]);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages]);

  const THINKING_STEPS = [
    "Analyzing application model context...",
    "Retrieving existing blueprint structure...",
    "Drafting architectural updates...",
    "Refining collection attributes and field schemas...",
    "Optimizing navigation paths and menu nodes...",
    "Formulating automation triggers and actions...",
    "Ensuring database constraints integrity...",
    "Formatting final markdown blueprint specifications..."
  ];

  useEffect(() => {
    let interval: any;
    if (copilotLoading) {
      setThinkingStep(0);
      interval = setInterval(() => {
        setThinkingStep(prev => (prev + 1) % THINKING_STEPS.length);
      }, 2000);
    } else {
      setThinkingStep(0);
    }
    return () => clearInterval(interval);
  }, [copilotLoading]);

  // Secure Delete States & Handler
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [confirmNameInput, setConfirmNameInput] = useState('');

  const handleDeleteApp = async () => {
    try {
      await apiFetch(`/api/apps/${appId}`, { method: 'DELETE' });
      message.success('App deleted successfully');
      setDeleteConfirmOpen(false);
      setSettingsOpen(false);
      navigate('/admin/apps');
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const triggerInitialAiDesign = useCallback(async (appRecord: any) => {
    const designMsgId = `design-step-${Date.now()}`;
    const steps = [
      { id: 1, label: 'Analyzing business description & domain model', status: 'active' },
      { id: 2, label: 'Formulating database collections & field types', status: 'pending' },
      { id: 3, label: 'Structuring sidebar menus & UI presentation', status: 'pending' },
      { id: 4, label: 'Mapping automation workflows & roles', status: 'pending' },
      { id: 5, label: 'Compiling final Markdown Blueprint document', status: 'pending' }
    ];

    setCopilotMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hi! Let's start building your application! I'll design the initial Blueprint document based on your business description:\n\n"${appRecord.description || 'No description provided'}"`
      },
      {
        id: designMsgId,
        role: 'assistant',
        content: '',
        isDesignProgress: true,
        designSteps: steps
      }
    ]);
    setCopilotLoading(true);

    // Start ticker
    let currentStepIdx = 0;
    const ticker = setInterval(() => {
      setCopilotMessages(prev => prev.map(msg => {
        if (msg.id === designMsgId) {
          const newSteps = msg.designSteps.map((step: any, sIdx: number) => {
            if (sIdx < currentStepIdx) return { ...step, status: 'completed' };
            if (sIdx === currentStepIdx) return { ...step, status: 'active' };
            return { ...step, status: 'pending' };
          });
          return { ...msg, designSteps: newSteps };
        }
        return msg;
      }));
      if (currentStepIdx < 3) {
        currentStepIdx++;
      } else {
        clearInterval(ticker);
      }
    }, 1500);

    try {
      const userPrompt = `You are a professional software architect. Please design a complete, comprehensive software blueprint for this application:\n\n` +
        `App Title: "${appRecord.title}"\n` +
        `Description: "${appRecord.description || ''}"\n\n` +
        `Include database tables (collections) with fields, UI menus, and workflow automations to make this a functional, production-ready system.\n` +
        `You MUST output the entire Markdown Blueprint inside <new_blueprint>\n...\n</new_blueprint> tags. Do NOT truncate the blueprint.`;

      console.log("[AI Workspace Copilot] Initializing AI application blueprint generation...");
      console.log("[AI Workspace Copilot] Prompt sent to LLM:\n", userPrompt);

      const res = await apiFetch<any>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: userPrompt }
          ],
          mode: 'builder',
          context: {
            appId: appRecord.name,
            blueprint: '', // empty initially
          }
        })
      });

      clearInterval(ticker);

      const reply = res?.data?.content || '';
      console.log("[AI Workspace Copilot] Raw LLM Reply thinking & reasoning content:\n", reply);

      const blueprintMatch = reply.match(/<new_blueprint>([\s\S]*?)<\/new_blueprint>/);
      let cleanReply = reply;
      let updatedBlueprint = '';

      if (blueprintMatch && blueprintMatch[1]) {
        updatedBlueprint = blueprintMatch[1].trim();
        cleanReply = reply.replace(/<new_blueprint>[\s\S]*?<\/new_blueprint>/, '').trim();
      }

      // Mark all steps completed
      setCopilotMessages(prev => prev.map(msg => {
        if (msg.id === designMsgId) {
          return {
            ...msg,
            designSteps: msg.designSteps.map((step: any) => ({ ...step, status: 'completed' }))
          };
        }
        return msg;
      }));

      // Append assistant's text reply and update blueprint
      if (cleanReply) {
        setCopilotMessages(prev => [
          ...prev,
          { id: `assistant-${Date.now()}`, role: 'assistant', content: cleanReply }
        ]);
      }

      if (updatedBlueprint) {
        setBlueprintText(updatedBlueprint);
        
        // Auto-save blueprint to database
        await apiFetch(`/api/apps/${appRecord.id}`, {
          method: 'PUT',
          body: JSON.stringify({ values: { blueprint: updatedBlueprint } }),
        });
        message.success('✨ AI designed and saved the initial App Blueprint successfully!');
      }

    } catch (err: any) {
      clearInterval(ticker);
      setCopilotMessages(prev => {
        const withStopSpin = prev.map(msg => {
          if (msg.id === designMsgId) {
            return {
              ...msg,
              designSteps: msg.designSteps.map((step: any) => {
                if (step.status === 'active') {
                  return { ...step, status: 'pending' };
                }
                return step;
              })
            };
          }
          return msg;
        });
        return [
          ...withStopSpin,
          { id: `err-${Date.now()}`, role: 'assistant', content: `Error: ${err.message}`, isError: true }
        ];
      });
    } finally {
      setCopilotLoading(false);
    }
  }, [appId]);

  const handleSendCopilotMessage = async (text?: string) => {
    const inputMsg = (text || copilotInput).trim();
    if (!inputMsg || copilotLoading) return;

    const userMessage = { id: `user-${Date.now()}`, role: 'user', content: inputMsg };
    setCopilotMessages(prev => [...prev, userMessage]);
    if (!text) setCopilotInput('');
    setCopilotLoading(true);

    try {
      const history = copilotMessages.map(m => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: inputMsg });

      console.log("[AI Workspace Copilot] Chat message sent by user:", inputMsg);
      console.log("[AI Workspace Copilot] Request history:", history);
      console.log("[AI Workspace Copilot] Current App Blueprint context:\n", blueprintText);

      const res = await apiFetch<any>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: history,
          mode: 'builder',
          context: {
            appId: app?.title || appId,
            blueprint: blueprintText,
          }
        })
      });

      const reply = res?.data?.content || '';
      console.log("[AI Workspace Copilot] Raw LLM reply containing thinking & blueprint updates:\n", reply);

      const blueprintMatch = reply.match(/<new_blueprint>([\s\S]*?)<\/new_blueprint>/);
      let cleanReply = reply;
      let updatedBlueprint = '';

      if (blueprintMatch && blueprintMatch[1]) {
        updatedBlueprint = blueprintMatch[1].trim();
        cleanReply = reply.replace(/<new_blueprint>[\s\S]*?<\/new_blueprint>/, '').trim();
      }

      const assistantMessage = { id: `assistant-${Date.now()}`, role: 'assistant', content: cleanReply || 'Blueprint updated successfully.' };
      setCopilotMessages(prev => [...prev, assistantMessage]);

      if (updatedBlueprint) {
        setBlueprintText(updatedBlueprint);
        
        // Auto-save blueprint to database!
        await apiFetch(`/api/apps/${appId}`, {
          method: 'PUT',
          body: JSON.stringify({ values: { blueprint: updatedBlueprint } }),
        });
        message.success('✨ AI Workspace Copilot auto-saved your updated App Blueprint!');
        
        // Reload stats
        const [appRes, statsRes] = await Promise.all([
          apiFetch<any>(`/api/apps/${appId}`),
          apiFetch<any>(`/api/apps/${appId}/stats`).catch(() => null),
        ]);
        setApp(appRes?.data ?? null);
        setStats(statsRes?.data ?? null);
      }
    } catch (err: any) {
      setCopilotMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: `Error: ${err.message}`, isError: true }
      ]);
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleSaveBlueprint = async () => {
    try {
      await apiFetch(`/api/apps/${appId}`, {
        method: 'PUT',
        body: JSON.stringify({ values: { blueprint: blueprintText } }),
      });
      message.success('Blueprint saved successfully!');
      setIsEditingBlueprint(false);
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleAutoUpdateApp = async () => {
    setUpdatingApp(true);
    
    // Add "AI Create App" user message in the chat
    setCopilotMessages(prev => [
      ...prev,
      { id: `user-build-${Date.now()}`, role: 'user', content: 'AI Create App' }
    ]);

    try {
      // First, perform dry-run comparison
      const res = await apiFetch<any>(`/api/apps/${appId}/auto-update`, {
        method: 'POST',
      });

      if (res?.data?.needsConfirmation) {
        // App exists and we got the proposed modifications summary
        setCopilotMessages(prev => [
          ...prev,
          {
            id: `blueprint-confirm-${Date.now()}`,
            role: 'assistant',
            content: res.data.summary,
            isBlueprintConfirm: true,
          }
        ]);
        setUpdatingApp(false);
        return;
      }

      // No confirmation needed (brand new draft app): run full compilation and show progress immediately!
      if (res?.data?.success) {
        setActiveTaskId(res.data.taskId);
        setCompilationStatus('pending');
        setCompilationLogs([`[${new Date().toLocaleTimeString()}] Enqueued compilation task in database queue...`]);
        setCompilerDrawerOpen(true);
      }
      await performFullBuild(res);
    } catch (err: any) {
      const isAlreadyProgress = err.message?.toLowerCase().includes('in progress') || err.message?.toLowerCase().includes('compilation_in_progress');
      if (isAlreadyProgress) {
        setCopilotMessages(prev => [
          ...prev,
          { 
            id: `progress-notice-${Date.now()}`, 
            role: 'assistant', 
            content: `✨ An active compilation task is already running for this application. Opening the Compiler Center to track progress...` 
          }
        ]);
        setCompilerDrawerOpen(true);
        setUpdatingApp(false);
        load();
        return;
      }
      setCopilotMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: `Dry-run failed: ${err.message}`, isError: true }
      ]);
      message.error(err.message);
      setUpdatingApp(false);
    }
  };

  const performFullBuild = async (dryRunResponse?: any, confirmMsgId?: string, initialLogs?: string[]) => {
    setUpdatingApp(true);
    setCompilationStatus('processing');
    if (initialLogs && initialLogs.length > 0) {
      setCompilationLogs(initialLogs);
    } else {
      setCompilationLogs([`[${new Date().toLocaleTimeString()}] Starting application compiler...`]);
    }
    setCompilerDrawerOpen(true);
    const buildMsgId = `build-step-${Date.now()}`;
    const steps = [
      { id: 1, label: 'Compiling blueprint and database models', status: 'active' },
      { id: 2, label: 'Generating collection structures & CRUD skills', status: 'pending' },
      { id: 3, label: 'Building responsive pages & UI schemas', status: 'pending' },
      { id: 4, label: 'Mapping sidebar routing & menu navigation', status: 'pending' },
      { id: 5, label: 'Deploying automated workflows & business rules', status: 'pending' },
      { id: 6, label: 'Creating security roles & finalizing setup', status: 'pending' }
    ];

    if (initialLogs && initialLogs.length > 0) {
      // Estimate active step based on logs
      let activeStepId = 1;
      for (const logLine of initialLogs) {
        const lower = logLine.toLowerCase();
        if (lower.includes('finalizing setup') || lower.includes('admin role') || lower.includes('security roles')) {
          activeStepId = 6;
        } else if (lower.includes('workflow specialist') || lower.includes('workflows') || lower.includes('workflow')) {
          activeStepId = 5;
        } else if (lower.includes('child menu') || lower.includes('top-level menu') || lower.includes('sidebar menus') || lower.includes('appmenus')) {
          activeStepId = 4;
        } else if (lower.includes('ui engineer') || lower.includes('ui page schema') || lower.includes('ui schema')) {
          activeStepId = 3;
        } else if (lower.includes('db architect') || lower.includes('collection mapping') || lower.includes('database schema') || lower.includes('business skills') || lower.includes('pass 1') || lower.includes('pass 2')) {
          activeStepId = 2;
        }
      }
      
      steps.forEach(step => {
        if (step.id < activeStepId) {
          step.status = 'completed';
        } else if (step.id === activeStepId) {
          step.status = 'active';
        } else {
          step.status = 'pending';
        }
      });
    }

    if (confirmMsgId) {
      // Replace the confirmation card message with the progress steps card!
      setCopilotMessages(prev => prev.map(msg => {
        if (msg.id === confirmMsgId) {
          return {
            id: buildMsgId,
            role: 'assistant',
            content: '',
            isBuildProgress: true,
            buildSteps: steps,
            logs: initialLogs || []
          };
        }
        return msg;
      }));
    } else {
      setCopilotMessages(prev => [
        ...prev,
        {
          id: buildMsgId,
          role: 'assistant',
          content: '',
          isBuildProgress: true,
          buildSteps: steps,
          logs: initialLogs || []
        }
      ]);
    }

    try {
      let res = dryRunResponse;
      if (!initialLogs) {
        // Call with confirm: true to actually trigger the full database compilation!
        res = dryRunResponse && !confirmMsgId ? dryRunResponse : await apiFetch<any>(`/api/apps/${appId}/auto-update`, {
          method: 'POST',
          body: JSON.stringify({ confirm: true }),
        });
      }

      // 2. Subscribe to compilation stream and wait until it is finished
      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(`${API_BASE}/api/apps/${appId}/compilation/stream`);
        
        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'log') {
              const logLine = data.message;
              setCompilationLogs(prev => [...prev, logLine]);
              setCompilationStatus('processing');
              
              setCopilotMessages(prev => prev.map(msg => {
                if (msg.id === buildMsgId) {
                  const newLogs = [...(msg.logs || []), logLine];
                  
                  // Simple heuristic mapping logs to the 6 steps:
                  let activeStepId = 1;
                  const lower = logLine.toLowerCase();
                  if (lower.includes('admin role') || lower.includes('security roles') || lower.includes('finalizing setup')) {
                    activeStepId = 6;
                  } else if (lower.includes('workflow specialist') || lower.includes('workflows')) {
                    activeStepId = 5;
                  } else if (lower.includes('menu') || lower.includes('sidebar menus') || lower.includes('ui page schema')) {
                    activeStepId = 4;
                  } else if (lower.includes('ui engineer') || lower.includes('ui schema')) {
                    activeStepId = 3;
                  } else if (lower.includes('db architect') || lower.includes('collection mapping') || lower.includes('database schema') || lower.includes('business skills') || lower.includes('pass 1') || lower.includes('pass 2')) {
                    activeStepId = 2;
                  } else {
                    const currentActive = msg.buildSteps.find((s: any) => s.status === 'active');
                    if (currentActive) activeStepId = currentActive.id;
                  }
                  
                  const newSteps = msg.buildSteps.map((step: any) => {
                    if (step.id < activeStepId) {
                      return { ...step, status: 'completed' };
                    } else if (step.id === activeStepId) {
                      return { ...step, status: 'active' };
                    } else {
                      return { ...step, status: 'pending' };
                    }
                  });
                  
                  return {
                    ...msg,
                    buildSteps: newSteps,
                    logs: newLogs
                  };
                }
                return msg;
              }));
            } else if (data.type === 'completed') {
              setCompilationStatus('completed');
              es.close();
              resolve();
            } else if (data.type === 'failed' || data.type === 'error') {
              setCompilationStatus('failed');
              es.close();
              reject(new Error(data.error || data.message || 'Compilation failed'));
            }
          } catch (err) {
            console.error('Error parsing SSE event data:', err);
          }
        };

        es.onerror = (err) => {
          console.error('SSE Error:', err);
          if (es.readyState === EventSource.CLOSED) {
            es.close();
            reject(new Error('Compilation stream disconnected unexpectedly.'));
          }
        };
      });

      // Mark all steps completed
      setCopilotMessages(prev => prev.map(msg => {
        if (msg.id === buildMsgId) {
          return {
            ...msg,
            buildSteps: msg.buildSteps.map((step: any) => ({ ...step, status: 'completed' }))
          };
        }
        return msg;
      }));

      setCopilotMessages(prev => [
        ...prev,
        {
          id: `build-success-${Date.now()}`,
          role: 'assistant',
          content: `🎉 ${res?.data?.message || 'Application successfully updated from blueprint!'} All database tables, pages, and menus have been generated.`
        }
      ]);

      message.success(res?.data?.message || 'App successfully updated from blueprint!');
      load();
    } catch (err: any) {
      const isAlreadyProgress = err.message?.toLowerCase().includes('in progress') || err.message?.toLowerCase().includes('compilation_in_progress');
      if (isAlreadyProgress) {
        setCopilotMessages(prev => [
          ...prev,
          { 
            id: `progress-notice-${Date.now()}`, 
            role: 'assistant', 
            content: `✨ An active compilation task is already running for this application. Opening the Compiler Center to track progress...` 
          }
        ]);
        setCompilerDrawerOpen(true);
        setUpdatingApp(false);
        load();
        return;
      }
      setCompilationStatus('failed');
      setCopilotMessages(prev => {
        const withStopSpin = prev.map(msg => {
          if (msg.id === buildMsgId) {
            return {
              ...msg,
              buildSteps: msg.buildSteps.map((step: any) => {
                if (step.status === 'active') {
                  return { ...step, status: 'pending' };
                }
                return step;
              })
            };
          }
          return msg;
        });
        return [
          ...withStopSpin,
          { id: `err-${Date.now()}`, role: 'assistant', content: `Build failed: ${err.message}`, isError: true }
        ];
      });
      message.error(err.message);
    } finally {
      setUpdatingApp(false);
    }
  };

  const handleConfirmBuild = async (confirmMsgId: string) => {
    await performFullBuild(null, confirmMsgId);
  };

  const handleRefineBlueprint = (confirmMsgId: string) => {
    setCopilotMessages(prev => prev.map(msg => {
      if (msg.id === confirmMsgId) {
        return {
          id: msg.id,
          role: 'assistant',
          content: 'Got it! I\'ve paused the compilation. You can refine the blueprint by typing here, or edit it directly in the panel on the left.'
        };
      }
      return msg;
    }));
  };

  // Live Simulator States (Deprecated but kept for stability)
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(true);

  const reloadIframe = () => {
    setIframeLoading(true);
    setIframeKey((k) => k + 1);
  };

  // Read current role from localStorage (stored during sign in)
  const currentRole = localStorage.getItem('formai_current_role');

  const load = useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const [appRes, statsRes, activeCompRes] = await Promise.all([
        apiFetch<any>(`/api/apps/${appId}`),
        apiFetch<any>(`/api/apps/${appId}/stats`).catch(() => null),
        apiFetch<any>(`/api/apps/${appId}/compilation/active`).catch(() => null),
      ]);
      const appData = appRes?.data ?? null;
      setApp(appData);
      setBlueprintText(appData?.blueprint || '');
      setStats(statsRes?.data ?? null);

      const activeTask = activeCompRes?.data;
      if (activeTask && (activeTask.status === 'pending' || activeTask.status === 'processing')) {
        console.log(`[App Workspace] Re-attaching to running compilation task: ${activeTask.id}`);
        setActiveTaskId(activeTask.id);
        setCompilationStatus(activeTask.status);
        setCompilationLogs(activeTask.logs || []);
        setCompilerDrawerOpen(true);
        setTimeout(() => {
          performFullBuild(null, undefined, activeTask.logs);
        }, 100);
      }

      // Check for initAi parameter
      const initAi = new URLSearchParams(window.location.search).get('initAi') === 'true';
      if (initAi && !initAiTriggered && appData) {
        setInitAiTriggered(true);
        // Clear search parameters to avoid re-triggering on refresh
        window.history.replaceState({}, '', window.location.pathname);
        triggerInitialAiDesign(appData);
      }
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [appId, initAiTriggered, triggerInitialAiDesign]);

  useEffect(() => { load(); }, [load]);

  const handleUpdateSettings = async (values: any) => {
    try {
      await apiFetch(`/api/apps/${appId}`, {
        method: 'PUT',
        body: JSON.stringify({ values }),
      });
      message.success('Settings saved');
      setSettingsOpen(false);
      load();
    } catch (err: any) { message.error(err.message); }
  };

  const handlePublish = async () => {
    try {
      await apiFetch(`/api/apps/${appId}/publish`, { method: 'POST', body: '{}' });
      message.success('Published');
      load();
    } catch (err: any) { message.error(err.message); }
  };

  const handleUnpublish = async () => {
    try {
      await apiFetch(`/api/apps/${appId}/unpublish`, { method: 'POST', body: '{}' });
      message.success('Reverted to Draft');
      load();
    } catch (err: any) { message.error(err.message); }
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  if (!app) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Empty description="App not found" />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/admin/apps')}>Back to Apps</Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[app.status] || { color: 'default', label: app.status };

  const tabItems = [
    {
      key: 'overview',
      label: <Space><DashboardOutlined /> Overview</Space>,
      children: (
        <div style={{ marginTop: 8 }}>
          <Row gutter={[24, 24]}>
            {/* Left Column: Markdown App Blueprint Document & Control Panel */}
            <Col xs={24} lg={13}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Blueprint Card */}
                <Card
                  title={
                    <Space>
                      <BookOutlined style={{ color: '#1677ff' }} />
                      <span style={{ fontWeight: 600 }}>App Blueprint Document</span>
                    </Space>
                  }
                  extra={
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={isEditingBlueprint ? <EyeOutlined /> : <EditOutlined />}
                      onClick={() => setIsEditingBlueprint(!isEditingBlueprint)}
                    >
                      {isEditingBlueprint ? 'Preview Document' : 'Edit Blueprint'}
                    </Button>
                  }
                  styles={{
                    body: {
                      minHeight: 400,
                      maxHeight: 520,
                      overflowY: 'auto',
                      background: '#ffffff',
                    }
                  }}
                  style={{
                    borderRadius: 12,
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                  }}
                >
                  {isEditingBlueprint ? (
                    <Input.TextArea
                      value={blueprintText}
                      onChange={(e) => setBlueprintText(e.target.value)}
                      placeholder="Define your App Blueprint using Markdown..."
                      autoSize={{ minRows: 18 }}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        background: '#fafafa',
                        border: '1px solid rgba(0,0,0,0.06)',
                        borderRadius: 8,
                        padding: 12,
                      }}
                    />
                  ) : (
                    <MarkdownPreview content={blueprintText} />
                  )}
                </Card>

                {/* AI Application Builder Panel */}
                <Card
                  title={
                    <Space>
                      <ThunderboltOutlined style={{ color: '#722ed1' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#531dab' }}>AI Application Builder</span>
                    </Space>
                  }
                  style={{
                    borderRadius: 12,
                    border: '1px solid rgba(114, 46, 209, 0.15)',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(249,240,255,0.9) 100%)',
                    boxShadow: '0 4px 16px rgba(114, 46, 209, 0.04)'
                  }}
                >
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Alert
                      type="info"
                      showIcon
                      icon={<ExclamationCircleOutlined style={{ color: '#722ed1' }} />}
                      message={
                        <span style={{ fontSize: 12, color: '#595959', lineHeight: '1.5' }}>
                          This compiler uses AI to parse the Markdown Blueprint and auto-generate or modify real database collections, navigation menus, and workflows. Modify the blueprint above, then click <strong>AI Create App</strong> to compile.
                        </span>
                      }
                      style={{ borderRadius: 8, padding: '8px 12px', background: '#f9f0ff', border: '1px solid #d3adf7' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                      {compilationStatus !== 'idle' && (
                        <Button
                          icon={<SyncOutlined spin={compilationStatus === 'processing'} />}
                          onClick={() => setCompilerDrawerOpen(true)}
                          style={{ borderRadius: 8, borderColor: '#722ed1', color: '#722ed1' }}
                        >
                          View Compiler Console
                        </Button>
                      )}
                      <Button
                        icon={<SaveOutlined />}
                        onClick={handleSaveBlueprint}
                        disabled={loading || updatingApp || copilotLoading}
                        style={{ borderRadius: 8 }}
                      >
                        Save Blueprint
                      </Button>
                      <Button
                        type="primary"
                        icon={<SyncOutlined />}
                        loading={updatingApp}
                        disabled={updatingApp || loading || copilotLoading}
                        onClick={handleAutoUpdateApp}
                        className="visual-launch-btn"
                        style={{
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
                          border: 'none',
                          color: 'white',
                          fontWeight: 500
                        }}
                      >
                        AI Create App
                      </Button>
                    </div>
                  </Space>
                </Card>
              </div>
            </Col>

            {/* Right Column: Integrated Builder AI Workspace Copilot Chat */}
            <Col xs={24} lg={11}>
              <div style={{ position: 'sticky', top: 80 }}>
                <Card
                  title={
                    <Space>
                      <RobotOutlined style={{ color: '#1677ff' }} />
                      <span style={{ fontWeight: 600 }}>✨ AI Workspace Copilot</span>
                    </Space>
                  }
                  styles={{
                    body: {
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      height: 520,
                      background: 'linear-gradient(135deg, #ffffff 0%, #f6f9ff 100%)',
                    }
                  }}
                  style={{
                    borderRadius: 12,
                    border: '1px solid rgba(22, 119, 255, 0.15)',
                    boxShadow: '0 8px 30px rgba(22, 119, 255, 0.05)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Chat Message Logs */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px' }}>
                    {copilotMessages.map((msg) => {
                      const isUser = msg.role === 'user';
                      return (
                        <div
                          key={msg.id}
                          style={{
                            marginBottom: 12,
                            display: 'flex',
                            flexDirection: isUser ? 'row-reverse' : 'row',
                            alignItems: 'flex-start',
                            gap: 8,
                          }}
                        >
                          <Avatar
                            size="small"
                            icon={isUser ? <UserOutlined /> : <RobotOutlined />}
                            style={{
                              background: isUser ? '#1677ff' : '#52c41a',
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ maxWidth: '85%', width: '100%' }}>
                            {msg.isDesignProgress ? (
                              <Card
                                size="small"
                                style={{
                                  background: '#faf5ff',
                                  border: '1px dashed #d3adf7',
                                  borderRadius: 12,
                                  boxShadow: '0 4px 12px rgba(114, 46, 209, 0.05)',
                                  width: '100%'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                  <RobotOutlined spin={copilotLoading} style={{ color: '#722ed1', fontSize: 16 }} />
                                  <Text strong style={{ color: '#531dab', fontSize: 13 }}>FormAI Blueprint Architect</Text>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {msg.designSteps?.map((step: any) => {
                                    let icon = <span style={{ color: '#bfbfbf', marginRight: 4 }}>○</span>;
                                    let color = '#8c8c8c';
                                    let fontWeight = 400;
                                    if (step.status === 'active') {
                                      icon = <Spin size="small" style={{ marginRight: 4 }} />;
                                      color = '#722ed1';
                                      fontWeight = 600;
                                    } else if (step.status === 'completed') {
                                      icon = <span style={{ color: '#52c41a', fontWeight: 'bold', marginRight: 4 }}>✓</span>;
                                      color = '#52c41a';
                                    }
                                    return (
                                      <div key={step.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color }}>
                                        {icon}
                                        <span style={{ fontWeight }}>{step.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </Card>
                            ) : msg.isBuildProgress ? (
                              <Card
                                size="small"
                                style={{
                                  background: '#f6ffed',
                                  border: '1px dashed #b7eb8f',
                                  borderRadius: 12,
                                  boxShadow: '0 4px 12px rgba(82, 196, 26, 0.05)',
                                  width: '100%'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                  <SyncOutlined spin style={{ color: '#52c41a', fontSize: 16 }} />
                                  <Text strong style={{ color: '#389e0d', fontSize: 13 }}>FormAI App Compiler</Text>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {msg.buildSteps?.map((step: any) => {
                                    let icon = <span style={{ color: '#bfbfbf', marginRight: 4 }}>○</span>;
                                    let color = '#8c8c8c';
                                    let fontWeight = 400;
                                    if (step.status === 'active') {
                                      icon = <Spin size="small" style={{ marginRight: 4 }} />;
                                      color = '#52c41a';
                                      fontWeight = 600;
                                    } else if (step.status === 'completed') {
                                      icon = <span style={{ color: '#52c41a', fontWeight: 'bold', marginRight: 4 }}>✓</span>;
                                      color = '#52c41a';
                                    }
                                    return (
                                      <div key={step.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color }}>
                                        {icon}
                                        <span style={{ fontWeight }}>{step.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </Card>
                            ) : msg.isBlueprintConfirm ? (
                              <Card
                                size="small"
                                style={{
                                  background: '#fffbe6',
                                  border: '1px dashed #ffe58f',
                                  borderRadius: 12,
                                  boxShadow: '0 4px 12px rgba(250, 173, 20, 0.05)',
                                  width: '100%'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                  <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 16 }} />
                                  <Text strong style={{ color: '#d46b08', fontSize: 13 }}>📋 Proposed Modifications / 应用更新对比确认</Text>
                                </div>
                                <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12, overflowX: 'auto' }}>
                                  <MarkdownPreview content={msg.content} />
                                </div>
                                <Space>
                                  <Button
                                    type="primary"
                                    size="small"
                                    icon={<CheckOutlined />}
                                    onClick={() => handleConfirmBuild(msg.id)}
                                    style={{ background: '#faad14', borderColor: '#faad14', borderRadius: 6 }}
                                  >
                                    Confirm & Build / 确认并构建
                                  </Button>
                                  <Button
                                    size="small"
                                    onClick={() => handleRefineBlueprint(msg.id)}
                                    style={{ borderRadius: 6 }}
                                  >
                                    Refine / 调整Blueprint
                                  </Button>
                                </Space>
                              </Card>
                            ) : (
                              <div
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                                  background: isUser ? '#1677ff' : '#f0f2f5',
                                  color: isUser ? '#ffffff' : '#262626',
                                  fontSize: 13,
                                  lineHeight: 1.6,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                }}
                              >
                                {msg.content}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {copilotLoading && (
                      <div style={{ display: 'flex', gap: 8, padding: '6px 0', alignItems: 'flex-start' }}>
                        <Avatar
                          size="small"
                          icon={<RobotOutlined />}
                          style={{ background: '#52c41a', marginTop: 2 }}
                        />
                        <Space size={4} direction="vertical" style={{ display: 'flex', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <LoadingOutlined style={{ color: '#1677ff', fontSize: 13 }} />
                            <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Copilot is thinking...</Text>
                          </div>
                          <div style={{
                            fontSize: 11,
                            fontStyle: 'italic',
                            color: '#722ed1',
                            padding: '4px 8px',
                            background: '#f9f0ff',
                            border: '1px dashed #d3adf7',
                            borderRadius: 6,
                            marginTop: 2,
                            marginLeft: 18,
                            boxShadow: '0 2px 6px rgba(114, 46, 209, 0.03)',
                            animation: 'pulse 2s infinite'
                          }}>
                            💭 {THINKING_STEPS[thinkingStep]}
                          </div>
                        </Space>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Suggestion Chips */}
                  {copilotMessages.length === 1 && (
                    <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                      <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>Try asking:</Text>
                      <Space wrap size={4}>
                        {[
                          'Add a collection reviews for feedback',
                          'Suggest standard fields for product inventory',
                          'Add workflow auto-notifying for VIP customers',
                        ].map((promptText) => (
                          <Tag
                            key={promptText}
                            color="blue"
                            style={{ cursor: 'pointer', fontSize: 10, borderRadius: 4 }}
                            icon={<ThunderboltOutlined />}
                            onClick={() => handleSendCopilotMessage(promptText)}
                          >
                            {promptText.length > 35 ? promptText.slice(0, 35) + '...' : promptText}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  )}

                  {/* Input Box */}
                  <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(0,0,0,0.05)', background: '#ffffff', display: 'flex', gap: 8 }}>
                    <Input.TextArea
                      value={copilotInput}
                      onChange={(e) => setCopilotInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendCopilotMessage();
                        }
                      }}
                      placeholder="Ask AI Copilot to design or modify the blueprint..."
                      autoSize={{ minRows: 1, maxRows: 3 }}
                      style={{ flex: 1, resize: 'none', borderRadius: 6 }}
                      disabled={copilotLoading}
                    />
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={() => handleSendCopilotMessage()}
                      loading={copilotLoading}
                      disabled={!copilotInput.trim()}
                      style={{ borderRadius: 6, height: 38 }}
                    />
                  </div>
                </Card>
              </div>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: 'collections',
      label: <Space><DatabaseOutlined /> Data</Space>,
      children: <AppCollectionsTab appId={appId!} currentRole={currentRole} />,
    },
    {
      key: 'schemas',
      label: <Space><AppstoreOutlined /> Pages</Space>,
      children: <AppSchemasTab appId={appId!} />,
    },
    {
      key: 'menus',
      label: <Space><MenuOutlined /> Menus</Space>,
      children: <AppMenuDesigner appId={appId!} appName={app.title} />,
    },
    {
      key: 'workflows',
      label: <Space><ThunderboltOutlined /> Workflows</Space>,
      children: <AppWorkflowsTab appId={appId!} />,
    },
    {
      key: 'wiki',
      label: <Space><BookOutlined /> Wiki</Space>,
      children: app ? (
        <WikiTabContent app={app} appId={appId!} />
      ) : <Spin />,
    },
    {
      key: 'roles',
      label: <Space><TeamOutlined /> Roles</Space>,
      children: <AppRolesPanel appId={appId!} />,
    },
    {
      key: 'jobs',
      label: <Space><ScheduleOutlined /> Jobs</Space>,
      children: <AppJobsTab appId={appId!} />,
    },
  ];

  const visualStyles = `
    @keyframes pulse-glow {
      0% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.4); }
      50% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 8px rgba(82, 196, 26, 0); }
      100% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(82, 196, 26, 0); }
    }
    @keyframes pulse-glow-amber {
      0% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(250, 140, 22, 0.4); }
      50% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 8px rgba(250, 140, 22, 0); }
      100% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(250, 140, 22, 0); }
    }
    @keyframes shifty-gradient {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes border-glow-move {
      0% { border-color: rgba(22, 119, 255, 0.15); box-shadow: 0 4px 20px rgba(22, 119, 255, 0.04); }
      50% { border-color: rgba(114, 46, 209, 0.25); box-shadow: 0 4px 20px rgba(114, 46, 209, 0.06); }
      100% { border-color: rgba(22, 119, 255, 0.15); box-shadow: 0 4px 20px rgba(22, 119, 255, 0.04); }
    }
    
    .pulse-dot-green {
      width: 8px; height: 8px; border-radius: 50%; background: #52c41a;
      display: inline-block; animation: pulse-glow 2s infinite ease-in-out;
    }
    .pulse-dot-amber {
      width: 8px; height: 8px; border-radius: 50%; background: #fa8c16;
      display: inline-block; animation: pulse-glow-amber 2s infinite ease-in-out;
    }
    .visual-header {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(16px) saturate(120%);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 12px;
      padding: 16px 24px;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.03);
      margin-bottom: 24px;
      transition: all 0.3s ease;
    }
    .app-icon-badge {
      font-size: 26px;
      background: linear-gradient(135deg, #f0f5ff 0%, #d6e4ff 100%);
      border: 1px solid #adc6ff;
      width: 52px; height: 52px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(22, 119, 255, 0.1);
    }
    .visual-launch-btn {
      background: linear-gradient(135deg, #1677ff 0%, #722ed1 100%);
      background-size: 200% 200%;
      animation: shifty-gradient 6s infinite ease;
      border: none !important;
      color: white !important;
      font-weight: 600;
      box-shadow: 0 4px 14px rgba(22, 119, 255, 0.3), 0 0 1px rgba(114, 46, 209, 0.5);
      transition: all 0.3s ease !important;
    }
    .visual-launch-btn:hover:not(:disabled):not(.ant-btn-disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(22, 119, 255, 0.45), 0 0 8px rgba(114, 46, 209, 0.7);
    }
    .visual-launch-btn:disabled,
    .visual-launch-btn[disabled],
    .visual-launch-btn.ant-btn-disabled {
      background: #f5f5f5 !important;
      border-color: #d9d9d9 !important;
      color: rgba(0, 0, 0, 0.25) !important;
      box-shadow: none !important;
      cursor: not-allowed !important;
      animation: none !important;
      transform: none !important;
      opacity: 0.6;
    }
    
    .visual-canvas {
      background: radial-gradient(circle at 10% 20%, rgba(240, 245, 255, 0.4) 0%, rgba(249, 250, 252, 0.4) 90%);
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 16px;
      padding: 20px;
    }
    
    .blueprint-card {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.015);
    }
    .blueprint-card:hover {
      transform: translateY(-4px);
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
    }
    .blueprint-card-blue:hover { border-color: rgba(22, 119, 255, 0.4); box-shadow: 0 8px 24px rgba(22, 119, 255, 0.08); }
    .blueprint-card-purple:hover { border-color: rgba(114, 46, 209, 0.4); box-shadow: 0 8px 24px rgba(114, 46, 209, 0.08); }
    .blueprint-card-green:hover { border-color: rgba(82, 196, 26, 0.4); box-shadow: 0 8px 24px rgba(82, 196, 26, 0.08); }
    .blueprint-card-orange:hover { border-color: rgba(250, 140, 22, 0.4); box-shadow: 0 8px 24px rgba(250, 140, 22, 0.08); }
    .blueprint-card-pink:hover { border-color: rgba(235, 47, 150, 0.4); box-shadow: 0 8px 24px rgba(235, 47, 150, 0.08); }
    
    .copilot-bar {
      border: 1.5px solid rgba(22, 119, 255, 0.15);
      background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(246,249,255,0.9) 100%);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 20px rgba(22, 119, 255, 0.04);
      animation: border-glow-move 8s infinite alternate ease-in-out;
    }
    
    .device-mockup {
      border: 1px solid rgba(0, 0, 0, 0.1);
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .device-header {
      background: #f1f2f6;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .device-dots {
      display: flex; gap: 6px;
    }
    .device-dot {
      width: 10px; height: 10px; border-radius: 50%;
    }
    .device-address {
      flex: 1;
      background: #ffffff;
      border-radius: 6px;
      padding: 3px 12px;
      font-size: 11px;
      font-family: monospace;
      color: #8c8c8c;
      border: 1px solid rgba(0, 0, 0, 0.05);
      display: flex; align-items: center; gap: 6px;
    }
    .device-viewport-desktop {
      width: 100%; transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .device-viewport-mobile {
      width: 375px; max-width: 100%; margin: 20px auto; border: 12px solid #1e272e; border-radius: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
      box-sizing: border-box;
    }
  `;

  const activeItem = tabItems.find((item) => item.key === activeTab) || tabItems[0];

  return (
    <div style={{ padding: '20px 24px 24px' }}>
      <style>{visualStyles}</style>

      {/* Modern Breadcrumb */}
      <div style={{ marginBottom: 12 }}>
        <Breadcrumb items={[
          { title: <a onClick={() => navigate('/admin/apps')} style={{ color: '#8c8c8c' }}>Apps</a> },
          { title: <span style={{ color: '#262626', fontWeight: 500 }}>{app.title}</span> },
        ]} />
      </div>

      {/* Redesigned Premium Glassmorphism Header */}
      <div className="visual-header">
        <Row align="middle" justify="space-between">
          <Col>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Back Button */}
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/admin/apps')}
                style={{
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  borderRadius: '8px'
                }}
              />
              
              {/* App Icon Frame */}
              <div className="app-icon-badge">
                {app.icon || '📦'}
              </div>
              
              {/* Title & Status Info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Title level={3} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.3px' }}>
                    {app.title}
                  </Title>
                  <Tag
                    color={statusConfig.color}
                    style={{
                      borderRadius: '12px',
                      padding: '2px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 600,
                      fontSize: '11px',
                      border: 'none',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                    }}
                  >
                    <span className={app.status === 'published' ? 'pulse-dot-green' : 'pulse-dot-amber'} />
                    {statusConfig.label}
                  </Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 2 }}>
                  {app.description || `App Identifier: ${app.name}`}
                </Text>
              </div>
            </div>
          </Col>
          <Col>
            <Space size={10}>
              <Button
                icon={<SettingOutlined />}
                onClick={() => {
                  editForm.setFieldsValue({ title: app.title, description: app.description, icon: app.icon });
                  setSettingsOpen(true);
                }}
                style={{ borderRadius: 8, height: 38 }}
              >
                Settings
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => { load(); reloadIframe(); }}
                style={{ borderRadius: 8, height: 38 }}
              >
                Refresh
              </Button>
              {(app.status === 'draft' || app.status === 'archived') && (
                <Popconfirm title="Publish this app?" description="It will be visible to end users." onConfirm={handlePublish} okText="Publish">
                  <Button type="primary" style={{ borderRadius: 8, height: 38 }}>
                    Publish App
                  </Button>
                </Popconfirm>
              )}
              {app.status === 'published' && (
                <Popconfirm title="Unpublish this app?" description="It will be set back to draft and hidden from normal users." onConfirm={handleUnpublish} okText="Unpublish" okButtonProps={{ danger: true }}>
                  <Button danger style={{ borderRadius: 8, height: 38 }}>
                    Unpublish App
                  </Button>
                </Popconfirm>
              )}
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                className="visual-launch-btn"
                onClick={() => {
                  window.open(`/apps/${app.name}`, '_blank');
                }}
                style={{ borderRadius: 8, height: 38 }}
              >
                Launch Live App
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Active Tab Workspace Viewport */}
      <div style={{
        minHeight: 'calc(100vh - 280px)',
        background: '#ffffff',
        borderRadius: 12,
        border: '1px solid rgba(0, 0, 0, 0.05)',
        padding: 20,
        boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
      }}>
        {activeItem.children}
      </div>

      {/* Settings modal */}
      <Modal title="App Settings" open={settingsOpen} onCancel={() => setSettingsOpen(false)} onOk={() => editForm.submit()} okText="Save">
        <Form form={editForm} layout="vertical" onFinish={handleUpdateSettings}>
          <Form.Item label="Title" name="title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Description" name="description"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item label="Icon (emoji)" name="icon"><Input placeholder="e.g. 📦" /></Form.Item>
        </Form>

        {/* Danger Zone */}
        <div style={{ marginTop: 24, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <Text type="danger" strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Danger Zone</Text>
          <div style={{
            border: '1px solid #ffccc7',
            borderRadius: 8,
            padding: 12,
            background: '#fff2f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12
          }}>
            <div style={{ flex: 1 }}>
              <Text strong style={{ fontSize: 13, display: 'block', color: '#ff4d4f' }}>Delete this application</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Once deleted, all database tables, UI schemas, menus, workflows, and roles will be permanently removed.
              </Text>
            </div>
            <Button type="primary" danger onClick={() => setDeleteConfirmOpen(true)}>
              Delete App
            </Button>
          </div>
        </div>
      </Modal>

      {/* Double confirmation delete modal */}
      <Modal
        title={<span style={{ color: '#ff4d4f' }}><DeleteOutlined /> Danger: Delete Application</span>}
        open={deleteConfirmOpen}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setConfirmNameInput('');
        }}
        onOk={handleDeleteApp}
        okText="Permanently Delete App"
        okButtonProps={{
          danger: true,
          disabled: confirmNameInput !== app.name,
        }}
      >
        <div style={{ marginTop: 12 }}>
          <Paragraph>
            This action <strong>CANNOT</strong> be undone. This will permanently delete the application{' '}
            <strong>{app.title}</strong> (<code>@{app.name}</code>) and all its data, including database tables, UI schemas, menus, and workflows.
          </Paragraph>
          <Paragraph>
            Please type <Text code strong>{app.name}</Text> below to confirm:
          </Paragraph>
          <Input
            value={confirmNameInput}
            onChange={(e) => setConfirmNameInput(e.target.value)}
            placeholder={app.name}
            style={{ width: '100%' }}
          />
        </div>
      </Modal>

      {/* Runtime AI Assistant — floating trigger + drawer */}
      <RuntimeAIAssistantTrigger
        onClick={() => setAiOpen(!aiOpen)}
        isOpen={aiOpen}
        hasSkills={true}
      />
      <RuntimeAIAssistant
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        appId={appId}
      />

      {/* AI Multi-Agent Compiler Center Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Space size="middle">
              <ThunderboltOutlined style={{ color: '#722ed1', fontSize: 20 }} />
              <span style={{ fontWeight: 700, fontSize: 16 }}>FormAI Multi-Agent Compiler Center</span>
            </Space>
            <Space style={{ marginRight: 24 }}>
              {compilationStatus === 'pending' && <Tag color="blue">QUEUEING</Tag>}
              {compilationStatus === 'processing' && <Tag color="orange" icon={<LoadingOutlined />}>COMPILING</Tag>}
              {compilationStatus === 'completed' && <Tag color="green">SUCCESS</Tag>}
              {compilationStatus === 'failed' && <Tag color="red">FAILED</Tag>}
            </Space>
          </div>
        }
        placement="right"
        width={720}
        onClose={() => setCompilerDrawerOpen(false)}
        open={compilerDrawerOpen}
        styles={{
          body: {
            background: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            padding: 24,
          }
        }}
      >
        {/* Progress header */}
        <Card style={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, color: '#262626' }}>Compiler Dev Team Progress</span>
            <span style={{ fontSize: 13, color: '#8c8c8c' }}>
              Task ID: {activeTaskId ? `#${activeTaskId}` : 'N/A'}
            </span>
          </div>
          <Progress
            percent={
              compilationStatus === 'completed' ? 100 :
              compilationStatus === 'failed' ? 80 :
              compilationStatus === 'idle' ? 0 :
              Object.values(agentStates).filter(s => s === 'completed').length * 25 + 5
            }
            status={
              compilationStatus === 'failed' ? 'exception' :
              compilationStatus === 'completed' ? 'success' :
              'active'
            }
            strokeColor={{
              '0%': '#1677ff',
              '100%': '#722ed1',
            }}
            style={{ marginBottom: 0 }}
          />
        </Card>

        {/* 4 Agent Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Agent 1 */}
          <Card
            styles={{
              body: { padding: 16 }
            }}
            style={{
              borderRadius: 12,
              border: agentStates.db === 'active' ? '1px solid #d3adf7' : '1px solid rgba(0,0,0,0.06)',
              boxShadow: agentStates.db === 'active' ? '0 4px 12px rgba(114, 46, 209, 0.08)' : '0 4px 12px rgba(0,0,0,0.01)',
              background: agentStates.db === 'active' ? 'linear-gradient(135deg, #ffffff 0%, #f9f0ff 100%)' : '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar
                size="large"
                style={{
                  background: agentStates.db === 'completed' ? '#f6ffed' : (agentStates.db === 'active' ? '#f9f0ff' : '#f5f5f5'),
                  color: agentStates.db === 'completed' ? '#52c41a' : (agentStates.db === 'active' ? '#722ed1' : '#bfbfbf'),
                  border: '1px solid',
                  borderColor: agentStates.db === 'completed' ? '#b7eb8f' : (agentStates.db === 'active' ? '#d3adf7' : '#d9d9d9'),
                }}
              >
                🗃️
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 14 }}>DB Architect</Text>
                  {agentStates.db === 'completed' && <Tag color="success" style={{ margin: 0, borderRadius: 4 }}>Done</Tag>}
                  {agentStates.db === 'active' && <Tag color="purple" style={{ margin: 0, borderRadius: 4 }} icon={<LoadingOutlined />}>Active</Tag>}
                  {agentStates.db === 'pending' && <Tag style={{ margin: 0, borderRadius: 4 }}>Pending</Tag>}
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Database tables & skills schema
                </Text>
              </div>
            </div>
          </Card>

          {/* Agent 2 */}
          <Card
            styles={{
              body: { padding: 16 }
            }}
            style={{
              borderRadius: 12,
              border: agentStates.ui === 'active' ? '1px solid #1677ff' : '1px solid rgba(0,0,0,0.06)',
              boxShadow: agentStates.ui === 'active' ? '0 4px 12px rgba(22, 119, 255, 0.08)' : '0 4px 12px rgba(0,0,0,0.01)',
              background: agentStates.ui === 'active' ? 'linear-gradient(135deg, #ffffff 0%, #e6f7ff 100%)' : '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar
                size="large"
                style={{
                  background: agentStates.ui === 'completed' ? '#f6ffed' : (agentStates.ui === 'active' ? '#e6f7ff' : '#f5f5f5'),
                  color: agentStates.ui === 'completed' ? '#52c41a' : (agentStates.ui === 'active' ? '#1677ff' : '#bfbfbf'),
                  border: '1px solid',
                  borderColor: agentStates.ui === 'completed' ? '#b7eb8f' : (agentStates.ui === 'active' ? '#91d5ff' : '#d9d9d9'),
                }}
              >
                🎨
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 14 }}>UI Engineer</Text>
                  {agentStates.ui === 'completed' && <Tag color="success" style={{ margin: 0, borderRadius: 4 }}>Done</Tag>}
                  {agentStates.ui === 'active' && <Tag color="blue" style={{ margin: 0, borderRadius: 4 }} icon={<LoadingOutlined />}>Active</Tag>}
                  {agentStates.ui === 'pending' && <Tag style={{ margin: 0, borderRadius: 4 }}>Pending</Tag>}
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Menus & UI screen layouts
                </Text>
              </div>
            </div>
          </Card>

          {/* Agent 3 */}
          <Card
            styles={{
              body: { padding: 16 }
            }}
            style={{
              borderRadius: 12,
              border: agentStates.flow === 'active' ? '1px solid #d4b106' : '1px solid rgba(0,0,0,0.06)',
              boxShadow: agentStates.flow === 'active' ? '0 4px 12px rgba(212, 177, 6, 0.08)' : '0 4px 12px rgba(0,0,0,0.01)',
              background: agentStates.flow === 'active' ? 'linear-gradient(135deg, #ffffff 0%, #fffbe6 100%)' : '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar
                size="large"
                style={{
                  background: agentStates.flow === 'completed' ? '#f6ffed' : (agentStates.flow === 'active' ? '#fffbe6' : '#f5f5f5'),
                  color: agentStates.flow === 'completed' ? '#52c41a' : (agentStates.flow === 'active' ? '#d4b106' : '#bfbfbf'),
                  border: '1px solid',
                  borderColor: agentStates.flow === 'completed' ? '#b7eb8f' : (agentStates.flow === 'active' ? '#ffe58f' : '#d9d9d9'),
                }}
              >
                ⚡
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 14 }}>Workflow Specialist</Text>
                  {agentStates.flow === 'completed' && <Tag color="success" style={{ margin: 0, borderRadius: 4 }}>Done</Tag>}
                  {agentStates.flow === 'active' && <Tag color="warning" style={{ margin: 0, borderRadius: 4 }} icon={<LoadingOutlined />}>Active</Tag>}
                  {agentStates.flow === 'pending' && <Tag style={{ margin: 0, borderRadius: 4 }}>Pending</Tag>}
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Workflow triggers & automations
                </Text>
              </div>
            </div>
          </Card>

          {/* Agent 4 */}
          <Card
            styles={{
              body: { padding: 16 }
            }}
            style={{
              borderRadius: 12,
              border: agentStates.lead === 'active' ? '1px solid #389e0d' : '1px solid rgba(0,0,0,0.06)',
              boxShadow: agentStates.lead === 'active' ? '0 4px 12px rgba(56, 158, 13, 0.08)' : '0 4px 12px rgba(0,0,0,0.01)',
              background: agentStates.lead === 'active' ? 'linear-gradient(135deg, #ffffff 0%, #f6ffed 100%)' : '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar
                size="large"
                style={{
                  background: agentStates.lead === 'completed' ? '#f6ffed' : (agentStates.lead === 'active' ? '#f6ffed' : '#f5f5f5'),
                  color: agentStates.lead === 'completed' ? '#52c41a' : (agentStates.lead === 'active' ? '#389e0d' : '#bfbfbf'),
                  border: '1px solid',
                  borderColor: agentStates.lead === 'completed' ? '#b7eb8f' : (agentStates.lead === 'active' ? '#b7eb8f' : '#d9d9d9'),
                }}
              >
                👑
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 14 }}>Release Manager</Text>
                  {agentStates.lead === 'completed' && <Tag color="success" style={{ margin: 0, borderRadius: 4 }}>Done</Tag>}
                  {agentStates.lead === 'active' && <Tag color="green" style={{ margin: 0, borderRadius: 4 }} icon={<LoadingOutlined />}>Active</Tag>}
                  {agentStates.lead === 'pending' && <Tag style={{ margin: 0, borderRadius: 4 }}>Pending</Tag>}
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Integrity & verification auditor
                </Text>
              </div>
            </div>
          </Card>
        </div>

        {/* Real-time Scrolling Console Viewer */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 280, borderRadius: 12, overflow: 'hidden', border: '1px solid #1f2937' }}>
          {/* Console Header */}
          <div style={{ background: '#1f2937', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#9ca3af', fontWeight: 'bold' }}>📡 Real-time Compilation Log Terminal</span>
            <Badge status={compilationStatus === 'processing' ? 'processing' : 'default'} text={<span style={{ color: '#9ca3af', fontSize: 11 }}>Stream Connected</span>} />
          </div>
          {/* Logs scroll panel */}
          <div
            style={{
              flex: 1,
              background: '#0f141c',
              padding: 16,
              overflowY: 'auto',
              maxHeight: 340,
              fontSize: 12,
              lineHeight: '1.6',
              boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            {compilationLogs.length === 0 ? (
              <div style={{ color: '#6b7280', fontFamily: 'monospace', textAlign: 'center', padding: '40px 0' }}>
                Waiting for backend task logs to connect...
              </div>
            ) : (
              compilationLogs.map(line => formatConsoleLog(line))
            )}
          </div>
        </div>

        {/* Action Controls Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16, marginTop: 8 }}>
          <Space>
            {(compilationStatus === 'processing' || compilationStatus === 'failed') && (
              <Popconfirm
                title="Are you sure you want to force-cancel and reset the compiler queue?"
                description="This will clear database compilation locks and let you retry compile safely."
                okText="Yes, Force Reset"
                cancelText="Cancel"
                okButtonProps={{ danger: true, loading: resettingQueue }}
                onConfirm={handleResetQueue}
              >
                <Button danger ghost icon={<ReloadOutlined />}>
                  Reset Compiler Queue
                </Button>
              </Popconfirm>
            )}
          </Space>
          <Space>
            <Button onClick={() => setCompilerDrawerOpen(false)} style={{ borderRadius: 8 }}>
              Close Console View
            </Button>
            {compilationStatus === 'completed' && (
              <Button type="primary" onClick={() => { setCompilerDrawerOpen(false); load(); }} style={{ borderRadius: 8 }}>
                Load Completed Modules
              </Button>
            )}
          </Space>
        </div>
      </Drawer>
    </div>
  );
}
