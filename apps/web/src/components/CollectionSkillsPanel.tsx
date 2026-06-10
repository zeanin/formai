import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Typography, Switch, Tooltip, Empty,
  message, Badge, Tabs,
} from 'antd';
import {
  ApiOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  PlusOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { SkillExecutionLogsPanel } from './SkillExecutionLogsPanel';
import { CustomSkillForm } from './CustomSkillForm';

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

// ─── Skill type helpers ───────────────────────────────────────────────────────

const SKILL_ACTION_META: Record<string, { label: string; color: string; danger?: boolean }> = {
  list:   { label: 'Query List', color: 'blue' },
  get:    { label: 'Get Details', color: 'cyan' },
  create: { label: 'Create Record', color: 'green' },
  update: { label: 'Update Record', color: 'orange' },
  delete: { label: 'Delete Record', color: 'red', danger: true },
};

function getSkillTypeBadge(record: any) {
  if (record.skillType === 'custom') {
    return <Tag color="purple" style={{ fontSize: 10, padding: '0 4px' }}>Custom</Tag>;
  }
  return <Tag color="geekblue" style={{ fontSize: 10, padding: '0 4px' }}>Auto</Tag>;
}

function getActionFromName(skillName: string, collectionName: string): string {
  return skillName.replace(`${collectionName}_`, '');
}

// ─── Skills management sub-panel ─────────────────────────────────────────────

interface SkillsManagementTabProps {
  /** Filter skills by collection */
  collectionName: string;
  /** Filter skills by app */
  appId?: string;
  isAdmin: boolean;
}

function SkillsManagementTab({
  collectionName,
  appId,
  isAdmin,
}: SkillsManagementTabProps) {
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingSkill, setUpdatingSkill] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>(
        `/api/resource_skills?filter[resourceType]=collection&filter[resourceName]=${collectionName}&pageSize=50`,
      );
      setSkills(res?.data ?? []);
    } catch (err: any) {
      message.error(`Failed to load Skills: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [collectionName]);

  useEffect(() => { load(); }, [load]);

  const handleToggleEnabled = async (skillName: string, enabled: boolean) => {
    setUpdatingSkill(skillName);
    try {
      await apiFetch(`/api/resource_skills/${skillName}`, {
        method: 'PUT',
        body: JSON.stringify({ values: { enabled } }),
      });
      message.success(enabled ? `Enabled ${skillName}` : `Disabled ${skillName}`);
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setUpdatingSkill(null);
    }
  };

  const handleToggleConfirm = async (skillName: string, requiresConfirm: boolean) => {
    setUpdatingSkill(skillName);
    try {
      await apiFetch(`/api/resource_skills/${skillName}`, {
        method: 'PUT',
        body: JSON.stringify({ values: { requiresConfirm } }),
      });
      message.success(`Confirmation settings updated`);
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setUpdatingSkill(null);
    }
  };

  const handleDeleteCustom = async (skillName: string) => {
    try {
      await apiFetch(`/api/resource_skills/${skillName}`, { method: 'DELETE' });
      message.success('Custom Skill deleted');
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const enabledCount = skills.filter((s) => s.enabled).length;

  const columns = [
    {
      title: 'Skill',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => {
        const action = getActionFromName(name, collectionName);
        const meta = SKILL_ACTION_META[action] || { label: action, color: 'default' };
        return (
          <Space direction="vertical" size={2}>
            <Space size={4}>
              <Tag color={meta.color} style={{ fontSize: 11, margin: 0 }}>{meta.label || action}</Tag>
              {meta.danger && record.requiresConfirm && (
                <Tooltip title="Requires user confirmation"><ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 11 }} /></Tooltip>
              )}
              {getSkillTypeBadge(record)}
            </Space>
            <Text style={{ fontSize: 10 }} type="secondary" code>{name}</Text>
          </Space>
        );
      },
    },
    {
      title: (
        <Space size={4}>
          <span>AI Description</span>
          <Tooltip title="AI uses this description to determine when to call. The more precise the description, the more accurate the routing.">
            <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 11 }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => <Text type="secondary" style={{ fontSize: 12 }}>{desc || '—'}</Text>,
    },
    {
      title: 'Confirmation Required',
      dataIndex: 'requiresConfirm',
      key: 'requiresConfirm',
      width: 75,
      align: 'center' as const,
      render: (val: boolean, record: any) => {
        const action = getActionFromName(record.name, collectionName);
        const meta = SKILL_ACTION_META[action] || {};
        if (!meta.danger && record.skillType !== 'custom') {
          return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
        }
        // Non-admin: read-only display
        if (!isAdmin) {
          return val
            ? <Tag color="orange" style={{ fontSize: 10 }}>Yes</Tag>
            : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
        }
        return (
          <Switch
            size="small"
            checked={val}
            loading={updatingSkill === record.name}
            onChange={(v) => handleToggleConfirm(record.name, v)}
            checkedChildren="Yes"
            unCheckedChildren="No"
          />
        );
      },
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 72,
      align: 'center' as const,
      render: (val: boolean, record: any) => {
        // Non-admin: read-only display of current status (Tag instead of Switch)
        if (!isAdmin) {
          return val
            ? <Tag color="green" style={{ fontSize: 10 }}>Enabled</Tag>
            : <Tag color="default" style={{ fontSize: 10 }}>Disabled</Tag>;
        }
        return (
          <Switch
            checked={val}
            loading={updatingSkill === record.name}
            onChange={(v) => handleToggleEnabled(record.name, v)}
            checkedChildren={<CheckCircleOutlined />}
            unCheckedChildren={<StopOutlined />}
          />
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: any, record: any) => record.skillType === 'custom' && isAdmin ? (
        <Button
          size="small"
          danger
          type="text"
          onClick={() => handleDeleteCustom(record.name)}
          style={{ padding: '0 4px', fontSize: 11 }}
        >
          Delete
        </Button>
      ) : null,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Space size={8}>
          <RobotOutlined style={{ color: '#1677ff' }} />
          <Text><Text strong>{enabledCount}</Text><Text type="secondary"> / {skills.length} Enabled</Text></Text>
          {enabledCount > 0 && <Badge status="processing" text={<Text style={{ fontSize: 11 }} type="secondary">Available to AI</Text>} />}
        </Space>
        {/* Only admins can see write action buttons */}
        {isAdmin && (
          <Space size={6}>
            <Button size="small" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Custom Skill</Button>
            <Button size="small" icon={<ThunderboltOutlined />} onClick={load}>Refresh</Button>
          </Space>
        )}
        {!isAdmin && (
          <Button size="small" icon={<ThunderboltOutlined />} onClick={load}>Refresh</Button>
        )}
      </div>

      {enabledCount === 0 && skills.length > 0 && (
        <div style={{ padding: '8px 12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, marginBottom: 10 }}>
          <Space size={6}>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <Text style={{ fontSize: 12 }}>No Skills enabled. Enable at least one so that the AI can operate on this Collection's data.</Text>
          </Space>
        </div>
      )}

      <Table
        dataSource={skills}
        columns={columns}
        rowKey="name"
        loading={loading}
        size="small"
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              image={<RobotOutlined style={{ fontSize: 40, color: '#d9d9d9' }} />}
              imageStyle={{ height: 50 }}
              description={
                <Space direction="vertical" size={2}>
                  <Text type="secondary" style={{ fontSize: 12 }}>This Collection has no AI Skills yet</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>Skills are automatically generated when a Collection is created, or click "Custom Skill" to add one manually.</Text>
                </Space>
              }
            />
          ),
        }}
      />

      <div style={{ marginTop: 10 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          <InfoCircleOutlined /> Query-type Skills are enabled by default; write operations are disabled by default and must be enabled manually; "Confirmation Required" is recommended for delete operations.
        </Text>
      </div>

      {/* Only administrators can create custom Skills */}
      {isAdmin && (
        <CustomSkillForm
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSuccess={load}
          collectionName={collectionName}
          appId={appId}
        />
      )}
    </div>
  );
}

// ─── CollectionSkillsPanel (tabbed) ──────────────────────────────────────────

interface CollectionSkillsPanelProps {
  collectionName: string;
  appId?: string;
  /**
   * Whether the user is an administrator (root / admin / developer).
   * - true: Show Switch toggles, Custom Skill buttons, and execution log tabs (full administrative view).
   * - false: Read-only presentation of current Skill statuses (tags replace switches), hiding all write controls.
   */
  isAdmin?: boolean;
}

/**
 * CollectionSkillsPanel
 * AI Skills management panel with tabs:
 * - Tab 1: Skills List (Administrators: interactive; Ordinary users: read-only)
 * - Tab 2: Execution Logs (Exclusive audit logs for administrators)
 */
export function CollectionSkillsPanel({ collectionName, appId, isAdmin = false }: CollectionSkillsPanelProps) {
  const tabs = [
    {
      key: 'skills',
      label: <Space size={4}><ApiOutlined />Skills Configuration</Space>,
      children: <SkillsManagementTab collectionName={collectionName} appId={appId} isAdmin={isAdmin} />,
    },
    // Execution logs are only visible to administrators (auditing sensitive operations)
    ...(isAdmin ? [{
      key: 'logs',
      label: <Space size={4}><HistoryOutlined />Execution Logs</Space>,
      children: <SkillExecutionLogsPanel collectionName={collectionName} appId={appId} />,
    }] : []),
  ];

  return <Tabs size="small" items={tabs} />;
}

