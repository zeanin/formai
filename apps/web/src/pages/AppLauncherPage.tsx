import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Tag, Button, Empty, Spin, Space, theme, Avatar,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function apiFetch<T = any>(path: string): Promise<T> {
  const token = localStorage.getItem('formai_token');
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.errors?.[0]?.message ?? `HTTP ${res.status}`);
  return json;
}

const APP_ICON_COLORS = [
  '#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96',
  '#13c2c2', '#faad14', '#f5222d',
];

function getIconColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return APP_ICON_COLORS[Math.abs(hash) % APP_ICON_COLORS.length];
}

interface AppInfo {
  id: number;
  name: string;
  title: string;
  description?: string;
  status: string;
  icon?: string;
  basePath: string;
}

interface AppLauncherPageProps {
  currentUser: any;
  currentRole: string | null;
}

export function AppLauncherPage({ currentUser, currentRole }: AppLauncherPageProps) {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 576);

  const isAdmin =
    currentRole === 'root' || currentRole === 'admin' || currentRole === 'developer';

  useEffect(() => {
    apiFetch<any>('/api/my/apps')
      .then((res) => setApps(res?.data ?? []))
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 576);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const openApp = (app: AppInfo) => {
    navigate(`/apps/${app.name}`);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: token.colorBgLayout,
        padding: isMobile ? '24px 16px' : '40px 48px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? 16 : 14,
          marginBottom: 32,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <RobotOutlined style={{ fontSize: isMobile ? 28 : 32, color: token.colorPrimary, flexShrink: 0 }} />
          <div>
            <Title level={3} style={{ margin: 0, fontSize: isMobile ? 18 : 24 }}>
              Welcome back, {currentUser?.nickname || currentUser?.username}
            </Title>
            <Text type="secondary" style={{ fontSize: isMobile ? 13 : 14 }}>Select an application to get started</Text>
          </div>
        </div>

        {isAdmin && (
          <Button
            icon={<SettingOutlined />}
            onClick={() => navigate('/admin/dashboard')}
            block={isMobile}
            style={{ height: isMobile ? 38 : 'auto' }}
          >
            Platform Admin
          </Button>
        )}
      </div>

      {/* App Grid */}
      {apps.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 80,
          }}
        >
          <Empty
            image={<AppstoreOutlined style={{ fontSize: 64, color: token.colorTextQuaternary }} />}
            imageStyle={{ height: 80 }}
            description={
              <Space direction="vertical" align="center">
                <Text style={{ fontSize: 16 }}>No applications available</Text>
                {isAdmin ? (
                  <Text type="secondary">
                    Go to{' '}
                    <Button type="link" size="small" onClick={() => navigate('/admin/apps')}>
                      Apps Management
                    </Button>{' '}
                    to create your first application.
                  </Text>
                ) : (
                  <Text type="secondary">
                    Contact your administrator to get access to an application.
                  </Text>
                )}
              </Space>
            }
          />
        </div>
      ) : (
        <Row gutter={[20, 20]}>
          {apps.map((app) => (
            <Col key={app.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                style={{ borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}
                styles={{ body: { padding: 20 } }}
                onClick={() => openApp(app)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <Avatar
                    size={48}
                    style={{
                      background: getIconColor(app.name),
                      fontSize: 22,
                      flexShrink: 0,
                      borderRadius: 10,
                    }}
                  >
                    {app.icon || app.title.charAt(0).toUpperCase()}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text strong style={{ fontSize: 15, display: 'block' }}>
                        {app.title}
                      </Text>
                      {app.status === 'draft' && (
                        <Tag color="orange" style={{ fontSize: 11 }}>Draft</Tag>
                      )}
                    </div>
                    {app.description && (
                      <Paragraph
                        type="secondary"
                        ellipsis={{ rows: 2 }}
                        style={{ margin: '4px 0 0', fontSize: 13 }}
                      >
                        {app.description}
                      </Paragraph>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="link"
                    size="small"
                    icon={<ArrowRightOutlined />}
                    style={{ padding: 0 }}
                  >
                    Open
                  </Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
