import React, { useState, useCallback, useEffect } from 'react';
import {
  Table, Tag, Typography, Space, Tooltip, Button, Select,
  Badge, Collapse, Empty, theme,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  ApiOutlined,
} from '@ant-design/icons';

// Simple relative time helper (no external dep)
function fromNow(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

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

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  success:         { label: 'Success',   color: 'success', icon: <CheckCircleOutlined />  },
  error:           { label: 'Failed',   color: 'error',   icon: <CloseCircleOutlined />   },
  pending_confirm: { label: 'Pending Confirmation', color: 'warning', icon: <QuestionCircleOutlined /> },
  confirmed:       { label: 'Confirmed', color: 'cyan',    icon: <CheckCircleOutlined />   },
  cancelled:       { label: 'Cancelled', color: 'default', icon: <ClockCircleOutlined />   },
};

// ─── SkillExecutionLogsPanel ──────────────────────────────────────────────────

interface SkillExecutionLogsPanelProps {
  /** Filter skills by collection */
  collectionName?: string;
  /** Filter skills by app */
  appId?: string;
}

/**
 * SkillExecutionLogsPanel
 * Show the execution history (audit logs) of AI Skill invocations.
 * Filterable by status and skill name; supports expanding to view full parameters and results.
 */
export function SkillExecutionLogsPanel({ collectionName, appId }: SkillExecutionLogsPanelProps) {
  const { token } = theme.useToken();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (collectionName) params.set('skillName', `${collectionName}_`);
    if (appId)          params.set('appId', appId);
    if (statusFilter)   params.set('filter[status]', statusFilter);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    return params.toString();
  }, [collectionName, appId, statusFilter, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>(`/api/skill_execution_logs?${buildQuery()}`);
      setLogs(res?.data ?? []);
      setTotal(res?.meta?.count ?? 0);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    {
      title: 'Skill',
      dataIndex: 'skillName',
      key: 'skillName',
      width: 220,
      render: (v: string) => (
        <Space size={4} direction="vertical">
          <Space size={4}>
            <ApiOutlined style={{ color: token.colorPrimary, fontSize: 11 }} />
            <Text style={{ fontSize: 12 }} code>{v}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => {
        const meta = STATUS_META[v] || { label: v, color: 'default', icon: null };
        return (
          <Tag icon={meta.icon} color={meta.color} style={{ fontSize: 11 }}>
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: 'Duration',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 75,
      align: 'right' as const,
      render: (v: number) => v != null
        ? <Text style={{ fontSize: 11 }} type="secondary">{v}ms</Text>
        : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'User',
      dataIndex: 'userId',
      key: 'userId',
      width: 80,
      render: (v: string, r: any) => (
        <Space size={2} direction="vertical">
          <Text style={{ fontSize: 11 }}>{v || 'Anonymous'}</Text>
          {r.userRoles?.length > 0 && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              {r.userRoles.slice(0, 2).join(', ')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (v: string) => (
        <Tooltip title={v ? new Date(v).toLocaleString() : ''}>
          <Text style={{ fontSize: 11 }} type="secondary">
            {v ? fromNow(v) : '—'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Error',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      render: (v: string) => v
        ? <Text type="danger" style={{ fontSize: 11 }}>{v.slice(0, 60)}{v.length > 60 ? '…' : ''}</Text>
        : null,
    },
  ];

  const expandedRowRender = (record: any) => (
    <div style={{ padding: '8px 0' }}>
      <Collapse
        ghost
        size="small"
        items={[
          {
            key: 'args',
            label: <Text style={{ fontSize: 12 }}>Input Parameters</Text>,
            children: (
              <pre style={{
                fontSize: 11,
                background: token.colorBgTextHover,
                borderRadius: 4,
                padding: '6px 8px',
                margin: 0,
                overflow: 'auto',
                maxHeight: 150,
              }}>
                {JSON.stringify(record.inputArgs, null, 2)}
              </pre>
            ),
          },
          ...(record.output ? [{
            key: 'output',
            label: <Text style={{ fontSize: 12 }}>Execution Output</Text>,
            children: (
              <pre style={{
                fontSize: 11,
                background: token.colorBgTextHover,
                borderRadius: 4,
                padding: '6px 8px',
                margin: 0,
                overflow: 'auto',
                maxHeight: 200,
              }}>
                {JSON.stringify(record.output, null, 2)}
              </pre>
            ),
          }] : []),
          ...(record.sessionId ? [{
            key: 'meta',
            label: <Text style={{ fontSize: 12 }}>Metadata</Text>,
            children: (
              <Space direction="vertical" size={2}>
                <Text style={{ fontSize: 11 }}>Session: <Text code style={{ fontSize: 10 }}>{record.sessionId}</Text></Text>
                {record.confirmationId && (
                  <Text style={{ fontSize: 11 }}>Confirmation ID: <Text code style={{ fontSize: 10 }}>{record.confirmationId}</Text></Text>
                )}
              </Space>
            ),
          }] : []),
        ]}
      />
    </div>
  );

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Status Filter: </Text>
        <Select
          allowClear
          size="small"
          style={{ width: 120 }}
          placeholder="All"
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          options={Object.entries(STATUS_META).map(([k, v]) => ({
            value: k,
            label: v.label,
          }))}
        />
        <Button size="small" icon={<ReloadOutlined />} onClick={() => { setPage(1); load(); }}>
          Refresh
        </Button>
        <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
          <InfoCircleOutlined /> Total {total} records
        </Text>
      </div>

      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        expandable={{ expandedRowRender }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          size: 'small',
          onChange: (p) => setPage(p),
          showSizeChanger: false,
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  No execution records yet. Records will appear here once AI invokes a Skill.
                </Text>
              }
            />
          ),
        }}
      />
    </div>
  );
}
