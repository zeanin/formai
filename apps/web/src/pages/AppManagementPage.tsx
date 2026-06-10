import React, { useState, useEffect, useCallback } from 'react';
import {
  Button, Space, Tag, Typography, Modal, Form, Input,
  Popconfirm, message, Empty, Card, Row, Col, Statistic,
  Dropdown, Switch, Progress, Spin,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ReloadOutlined,
  AppstoreOutlined, RightOutlined, DatabaseOutlined,
  ThunderboltOutlined, EyeOutlined, InboxOutlined,
  SendOutlined, EditOutlined, TeamOutlined, RobotOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

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

// ─── App Card ────────────────────────────────────────────────────────────────

function AppCard({ app, onRefresh }: { app: any; onRefresh: () => void }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    apiFetch<any>(`/api/apps/${app.name}/stats`)
      .then((res) => setStats(res?.data))
      .catch(() => {});
  }, [app.name]);

  const statusConfig = STATUS_CONFIG[app.status] || { color: 'default', label: app.status };

  const handleDelete = async () => {
    try {
      await apiFetch(`/api/apps/${app.name}`, { method: 'DELETE' });
      message.success('App deleted');
      onRefresh();
    } catch (err: any) { message.error(err.message); }
  };

  const handlePublish = async () => {
    try {
      await apiFetch(`/api/apps/${app.name}/publish`, { method: 'POST', body: '{}' });
      message.success('Published');
      onRefresh();
    } catch (err: any) { message.error(err.message); }
  };

  const handleArchive = async () => {
    try {
      await apiFetch(`/api/apps/${app.name}/archive`, { method: 'POST', body: '{}' });
      message.success('Archived');
      onRefresh();
    } catch (err: any) { message.error(err.message); }
  };

  const handleUnpublish = async () => {
    try {
      await apiFetch(`/api/apps/${app.name}/unpublish`, { method: 'POST', body: '{}' });
      message.success('Reverted to Draft');
      onRefresh();
    } catch (err: any) { message.error(err.message); }
  };

  const moreMenuItems: any[] = [
    ...(app.status === 'draft' || app.status === 'archived' ? [{ key: 'publish', icon: <SendOutlined />, label: 'Publish', onClick: handlePublish }] : []),
    ...(app.status === 'published' ? [{ key: 'unpublish', icon: <UndoOutlined />, label: 'Unpublish', onClick: handleUnpublish }] : []),
    ...(app.status === 'published' ? [{ key: 'archive', icon: <InboxOutlined />, label: 'Archive', onClick: handleArchive }] : []),
  ];

  return (
    <Card
      hoverable
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px' } }}
      onClick={() => navigate(`/admin/apps/${app.name}`)}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24 }}>{app.icon || '📦'}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{app.title}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>@{app.name}</Text>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Tag color={statusConfig.color} style={{ margin: 0 }}>{statusConfig.label}</Tag>
          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
            <Button type="text" size="small" icon={<EditOutlined />}
              onClick={(e) => e.stopPropagation()} style={{ color: '#999' }} />
          </Dropdown>
        </div>
      </div>

      {/* Description */}
      <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12, flex: 1 }}
        ellipsis={{ rows: 2 }}>
        {app.description || 'No description'}
      </Paragraph>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <Space size={4}>
            <DatabaseOutlined style={{ color: '#1677ff', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>{stats.collections} tables</Text>
          </Space>
          <Space size={4}>
            <AppstoreOutlined style={{ color: '#722ed1', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>{stats.schemas} pages</Text>
          </Space>
          <Space size={4}>
            <ThunderboltOutlined style={{ color: '#fa8c16', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>{stats.workflows} flows</Text>
          </Space>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
        <Space size={4}>
          <TeamOutlined style={{ color: '#999', fontSize: 12 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>{stats?.roles ?? 0} roles</Text>
        </Space>
        <Button type="link" size="small" icon={<RightOutlined />}
          onClick={(e) => { e.stopPropagation(); navigate(`/admin/apps/${app.name}`); }}
          style={{ padding: 0 }}>
          Open
        </Button>
      </div>
    </Card>
  );
}

// ─── AppManagementPage ────────────────────────────────────────────────────────

const AI_STEPS = [
  "Designing Application Blueprint...",
  "Creating Database Tables & CRUD Skills...",
  "Mapping Sidebar & Navigation Menus...",
  "Auto-generating Premium UI Pages...",
  "Deploying Automation Workflows...",
  "Assigning Security Roles & Finalizing..."
];

export function AppManagementPage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [aiGenerate, setAiGenerate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiProgressStep, setAiProgressStep] = useState(0);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/api/apps?pageSize=100');
      setApps(res?.data ?? []);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values: any) => {
    const isAi = aiGenerate;
    setSubmitting(true);

    try {
      await apiFetch('/api/apps', {
        method: 'POST',
        body: JSON.stringify({
          values: {
            ...values,
            aiGenerate: false, // We do not auto-generate on the backend during initial POST
          }
        }),
      });

      message.success(
        isAi 
          ? `✨ Redirecting to AI Workspace to design "${values.title}"...`
          : `App "${values.title}" created successfully!`
      );
      setCreateOpen(false);
      form.resetFields();
      setAiGenerate(false);

      if (isAi) {
        navigate(`/admin/apps/${values.name}?initAi=true`);
      } else {
        load();
      }
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Apps</Title>
          <Text type="secondary">Build and manage enterprise applications. Click an app to enter its workspace.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New App
          </Button>
        </Space>
      </div>

      {/* App Cards Grid */}
      {apps.length === 0 && !loading ? (
        <Empty
          description="No apps yet. Create one to get started."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Create Your First App
          </Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {apps.map((app) => (
            <Col key={app.name} xs={24} sm={12} md={8} lg={6}>
              <AppCard app={app} onRefresh={load} />
            </Col>
          ))}
        </Row>
      )}

      {/* Create App Modal */}
      <Modal
        title="Create New App"
        open={createOpen}
        onCancel={() => {
          if (!submitting) {
            setCreateOpen(false);
            setAiGenerate(false);
            form.resetFields();
          }
        }}
        onOk={() => form.submit()}
        okText="Create"
        confirmLoading={submitting}
        cancelButtonProps={{ disabled: submitting }}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="App Name"
            name="name"
            rules={[
              { required: true },
              { pattern: /^[a-z][a-z0-9-_]*$/, message: 'Lowercase letters, numbers, hyphens only (e.g. crm-app)' },
            ]}
            extra="Used in the URL: /apps/{name}"
          >
            <Input placeholder="e.g. crm" disabled={submitting} />
          </Form.Item>
          <Form.Item label="Title" name="title" rules={[{ required: true }]}>
            <Input placeholder="e.g. CRM System" disabled={submitting} />
          </Form.Item>

          <Form.Item name="aiGenerate" valuePropName="checked" style={{ marginBottom: 16 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f9f0ff',
              border: '1px dashed #d3adf7',
              borderRadius: 8,
              padding: '10px 14px',
              transition: 'all 0.3s'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 600, color: '#722ed1', fontSize: 13 }}>✨ AI Auto-generate App Modules</span>
                <span style={{ fontSize: 11, color: '#9254de' }}>Auto-design data tables, menus, pages & workflows</span>
              </div>
              <Switch checked={aiGenerate} onChange={setAiGenerate} disabled={submitting} />
            </div>
          </Form.Item>

          <Form.Item
            label={aiGenerate ? "App Purpose / Business Description (Required for AI)" : "Description"}
            name="description"
            rules={[{ required: aiGenerate, message: 'Please describe what this app is for so AI can design it!' }]}
            extra={aiGenerate ? "e.g., An enterprise CRM system containing contacts, deals, tasks, and sales automation workflows." : "What is this app for?"}
          >
            <Input.TextArea rows={3} placeholder="What is this app for?" disabled={submitting} />
          </Form.Item>
          <Form.Item label="Icon (emoji)" name="icon">
            <Input placeholder="e.g. 📦" disabled={submitting} />
          </Form.Item>
        </Form>
      </Modal>

      {/* AI Progress Modal */}
      <Modal
        open={submitting && aiGenerate}
        footer={null}
        closable={false}
        centered
        width={420}
        styles={{ body: { padding: '24px 20px', textAlign: 'center' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            position: 'relative',
            width: 80,
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f9f0ff 0%, #e6f7ff 100%)',
            boxShadow: '0 4px 12px rgba(114, 46, 209, 0.15)'
          }}>
            <RobotOutlined spin style={{ fontSize: 40, color: '#722ed1' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>FormAI Architect</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Designing and building your application modules...</Text>
          </div>
          
          <div style={{ width: '100%', padding: '0 8px', marginTop: 12 }}>
            <Progress
              percent={Math.round(((aiProgressStep + 1) / 6) * 100)}
              status="active"
              strokeColor={{
                '0%': '#1890ff',
                '100%': '#722ed1',
              }}
            />
          </div>

          <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '12px 16px', width: '100%', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Spin size="small" />
              <Text strong style={{ fontSize: 13 }}>{AI_STEPS[aiProgressStep]}</Text>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
              {AI_STEPS.map((step, idx) => {
                let color = '#bfbfbf';
                let icon = '○';
                if (idx < aiProgressStep) {
                  color = '#52c41a';
                  icon = '✓';
                } else if (idx === aiProgressStep) {
                  color = '#1890ff';
                  icon = '●';
                }
                return (
                  <div key={idx} style={{ fontSize: 11, color, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold' }}>{icon}</span>
                    <span>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
