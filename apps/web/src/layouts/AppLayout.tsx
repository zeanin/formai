import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Layout, Menu, Button, Typography, Space, Avatar, Dropdown, theme, Spin,
  Input, Badge, Tooltip,
} from 'antd';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  HomeOutlined,
  UserOutlined,
  RobotOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  CloseOutlined,
  SendOutlined,
  AppstoreOutlined,
  LoadingOutlined,
  EyeOutlined,
  EditOutlined,
  SettingOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { useDesignMode, useTheme } from '@formai/client';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

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

// ─── Menu tree helpers ────────────────────────────────────────────────────────

interface AppMenuItem {
  id: number;
  title: string;
  icon?: string;
  type: 'page' | 'link' | 'group';
  path?: string;
  schemaUid?: string;
  url?: string;
  parentId?: number | null;
  sort: number;
  permissionKey?: string;
}

function buildMenuTree(flat: AppMenuItem[]): any[] {
  const map = new Map<number, any>();
  flat.forEach((item) => map.set(item.id, { ...item, children: [] }));

  const roots: any[] = [];
  flat.forEach((item) => {
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId).children.push(map.get(item.id));
    } else {
      roots.push(map.get(item.id));
    }
  });
  return roots;
}

function menuTreeToAntd(
  nodes: any[],
  appId: string,
  navigate: (path: string) => void,
  onItemClick?: () => void
): any[] {
  return nodes.map((node) => {
    const key = `/apps/${appId}/${node.path || node.id}`;
    if (node.type === 'group' && node.children?.length > 0) {
      return {
        key,
        icon: <AppstoreOutlined />,
        label: node.title,
        children: menuTreeToAntd(node.children, appId, navigate, onItemClick),
      };
    }
    return {
      key,
      label: node.title,
      onClick: () => {
        onItemClick?.();
        if (node.type === 'link' && node.url) {
          window.open(node.url, '_blank');
        } else {
          navigate(key);
        }
      },
    };
  });
}

// ─── Global AI Chat Panel ─────────────────────────────────────────────────────

interface GlobalAIChatPanelProps {
  onClose: () => void;
  appId?: string;
  activeMenu?: AppMenuItem | null;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function GlobalAIChatPanel({ onClose, appId, activeMenu }: GlobalAIChatPanelProps) {
  const { token } = theme.useToken();
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hi! I can help you navigate this application, query data, or perform actions. What would you like to do?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMsg = { id: String(Date.now()), role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await apiFetch<any>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: userMsg.content }],
          mode: 'assistant',
          context: {
            appId,
            currentPage: activeMenu ? {
              title: activeMenu.title,
              path: activeMenu.path,
              schemaUid: activeMenu.schemaUid,
            } : undefined,
          },
        }),
      });
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), role: 'assistant', content: res?.data?.content ?? 'Done.' },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), role: 'assistant', content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgTextHover,
        }}
      >
        <Space>
          <RobotOutlined style={{ color: token.colorPrimary }} />
          <Text strong>AI Assistant</Text>
        </Space>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              marginBottom: 12,
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <Avatar
              size="small"
              icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              style={{ background: msg.role === 'user' ? token.colorPrimary : token.colorSuccess, flexShrink: 0 }}
            />
            <div
              style={{
                maxWidth: '80%',
                padding: '8px 12px',
                borderRadius: 8,
                background: msg.role === 'user' ? token.colorPrimary : token.colorBgTextHover,
                color: msg.role === 'user' ? '#fff' : token.colorText,
                fontSize: 13,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
            <Avatar size="small" icon={<RobotOutlined />} style={{ background: token.colorSuccess }} />
            <Spin size="small" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          padding: '12px 16px',
          display: 'flex',
          gap: 8,
        }}
      >
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
          }}
          placeholder="Ask something about this app..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{ flex: 1, resize: 'none' }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={sendMessage}
          loading={loading}
          disabled={!input.trim()}
        />
      </div>
    </div>
  );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

interface AppLayoutProps {
  currentUser: any;
  onSignOut: () => void;
  children: React.ReactNode;
}

export function AppLayout({ currentUser, onSignOut, children }: AppLayoutProps) {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { appId } = useParams<{ appId: string }>();

  const { mode, setMode, toggleMode } = useDesignMode();
  const { isDark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  // Auto-activate design mode if ?mode=design query param is present
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('mode') === 'design') {
      setMode('design');
    }
  }, [location.search, setMode]);
  const [appInfo, setAppInfo] = useState<any>(null);
  const [menus, setMenus] = useState<AppMenuItem[]>([]);
  const [menusLoading, setMenusLoading] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMenuItemClick = useCallback(() => {
    if (window.innerWidth < 768) {
      setCollapsed(true);
    }
  }, []);

  // Load app info and menus
  useEffect(() => {
    if (!appId) return;
    setMenusLoading(true);

    Promise.all([
      apiFetch<any>(`/api/apps/${appId}`).catch(() => null),
      apiFetch<any>(`/api/apps/${appId}/menus`).catch(() => ({ data: [] })),
    ]).then(([appRes, menusRes]) => {
      setAppInfo(appRes?.data ?? null);
      setMenus(menusRes?.data ?? []);
    }).finally(() => setMenusLoading(false));
  }, [appId]);

  const menuTree = useMemo(() => buildMenuTree(menus), [menus]);
  const antdMenuItems = useMemo(
    () => menuTreeToAntd(menuTree, appId || '', navigate, handleMenuItemClick),
    [menuTree, appId, navigate, handleMenuItemClick],
  );

  const selectedKey = location.pathname;

  const activeMenu = useMemo(() => {
    if (!appId) return null;
    return menus.find((m) => {
      const menuKey = `/apps/${appId}/${m.path || m.id}`;
      return menuKey === selectedKey;
    });
  }, [menus, appId, selectedKey]);

  const userMenuItems = useMemo(() => {
    const currentRole = localStorage.getItem('formai_current_role');
    const isAdmin = currentRole === 'root' || currentRole === 'admin' || currentRole === 'developer';
    
    const items = [];
    if (isAdmin) {
      items.push({
        key: 'admin',
        icon: <SettingOutlined />,
        label: 'Admin Console',
        onClick: () => navigate(appId ? `/admin/apps/${appId}` : '/admin/dashboard'),
      });
    }
    items.push({ key: 'apps', icon: <HomeOutlined />, label: 'App Launcher', onClick: () => navigate('/apps') });
    items.push({ key: 'signout', icon: <LogoutOutlined />, label: 'Sign Out', onClick: onSignOut });
    return items;
  }, [appId, navigate, onSignOut]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Header */}
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 12px' : '0 24px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          height: 52,
          lineHeight: '52px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 12 }}>
          {isMobile && (
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((v) => !v)}
              style={{ padding: '0 8px' }}
            />
          )}
          <Button
            type="text"
            icon={<HomeOutlined />}
            onClick={() => navigate('/apps')}
            style={{ padding: '0 8px' }}
          />
          <Title
            level={4}
            style={{
              margin: 0,
              color: token.colorText,
              fontSize: isMobile ? 15 : 20,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: isMobile ? '120px' : 'none',
            }}
          >
            {appInfo?.title || appId || 'App'}
          </Title>
        </div>

        <Space size={isMobile ? 'small' : 'middle'}>
          {(() => {
            const currentRole = localStorage.getItem('formai_current_role');
            const isAdmin = currentRole === 'root' || currentRole === 'admin' || currentRole === 'developer';
            return isAdmin && (
              <Button
                size="small"
                type={mode === 'design' ? 'primary' : 'default'}
                icon={mode === 'design' ? <EyeOutlined /> : <EditOutlined />}
                onClick={toggleMode}
              >
                {!isMobile && (mode === 'design' ? 'Preview' : 'Design')}
              </Button>
            );
          })()}

          <Tooltip title="AI Assistant">
            <Button
              size="small"
              type={aiPanelOpen ? 'primary' : 'default'}
              icon={<RobotOutlined />}
              onClick={() => setAiPanelOpen((v) => !v)}
            >
              {!isMobile && 'AI Assistant'}
            </Button>
          </Tooltip>

          <Tooltip title={isDark ? 'Light Theme' : 'Dark Theme'}>
            <Button
              size="small"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
            >
              {!isMobile && (isDark ? 'Light' : 'Dark')}
            </Button>
          </Tooltip>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ background: token.colorPrimary }} />
              {!isMobile && <Text style={{ fontSize: 13 }}>{currentUser?.nickname || currentUser?.username}</Text>}
            </Space>
          </Dropdown>
        </Space>
      </Header>

      <Layout style={{ position: 'relative' }}>
        {/* Mobile Sidebar Mask */}
        {isMobile && !collapsed && (
          <div
            onClick={() => setCollapsed(true)}
            style={{
              position: 'fixed',
              top: 52,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              zIndex: 98,
              transition: 'all 0.3s',
            }}
          />
        )}

        {/* Left Sidebar — Dynamic App Menus */}
        <Sider
          collapsible collapsed={collapsed} trigger={null} width={isMobile ? 240 : 220} collapsedWidth={isMobile ? 0 : 60}
          style={{
            background: token.colorBgContainer,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'auto',
            height: 'calc(100vh - 52px)',
            position: isMobile ? 'fixed' : 'sticky',
            zIndex: isMobile ? 99 : 1,
            top: 52,
            left: 0,
            boxShadow: isMobile && !collapsed ? '4px 0 16px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {menusLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <Spin indicator={<LoadingOutlined />} />
              </div>
            ) : (
              <Menu
                mode="inline"
                selectedKeys={[selectedKey]}
                items={antdMenuItems}
                style={{ border: 'none', background: 'transparent', paddingTop: 8, flex: 1 }}
              />
            )}
            <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}>
              <Button
                type="text" block
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed((v) => !v)}
                style={{ height: 44, borderRadius: 0 }}
              >
                {!collapsed && 'Collapse'}
              </Button>
            </div>
          </div>
        </Sider>

        {/* Main Content */}
        <Content style={{ background: token.colorBgLayout, overflowY: 'auto', minHeight: 'calc(100vh - 52px)' }}>
          {children}
        </Content>

        {/* Right AI Panel */}
        {aiPanelOpen && (
          <Sider
            width={isMobile ? '100%' : 380}
            style={{
              background: token.colorBgContainer,
              borderLeft: `1px solid ${token.colorBorderSecondary}`,
              overflow: 'hidden',
              height: 'calc(100vh - 52px)',
              position: isMobile ? 'fixed' : 'sticky',
              zIndex: isMobile ? 100 : 1,
              top: 52,
              right: 0,
              boxShadow: isMobile ? '-4px 0 16px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            <GlobalAIChatPanel onClose={() => setAiPanelOpen(false)} appId={appId} activeMenu={activeMenu} />
          </Sider>
        )}
      </Layout>
    </Layout>
  );
}
