import React, { useState, useRef, useEffect } from 'react';
import {
  Button, Input, Avatar, Spin, theme, Typography, Space, Tooltip, Badge, Drawer,
  Tag, Divider,
} from 'antd';
import {
  SendOutlined,
  UserOutlined,
  CloseOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  ReloadOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { FormaiRobotIcon } from '../components/FormaiRobotIcon';
import { usePageAIContext } from '../providers/PageAIContextProvider';

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

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: string;
}

// ─── Suggested prompts per page context ──────────────────────────────────────

function getSuggestions(collectionName: string): string[] {
  if (!collectionName) return ['Help me understand this page', 'What can I do here?'];
  return [
    `Show me all records in ${collectionName}`,
    `Filter ${collectionName} from this month`,
    `Sort ${collectionName} by most recent`,
    `Explain the data on this page`,
  ];
}

// ─── PageAIAssistant ──────────────────────────────────────────────────────────

interface PageAIAssistantProps {
  /** Controlled open state */
  open: boolean;
  onClose: () => void;
}

/**
 * PageAIAssistant — inline/drawer AI assistant embedded in each SchemaPage.
 * It reads and modifies page state through PageAIContextProvider.
 */
export function PageAIAssistant({ open, onClose }: PageAIAssistantProps) {
  const { token } = theme.useToken();
  const pageAI = usePageAIContext();
  const { context, actions } = pageAI || { context: null, actions: null };

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Hi! I'm your page assistant. I can filter, sort, and help you understand the data on this page. What would you like to do?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const executeAIAction = (actionData: any) => {
    if (!actions) return;
    switch (actionData?.type) {
      case 'setFilter':
        actions.setFilter(actionData.filter || {});
        break;
      case 'setSort':
        actions.setSort(actionData.sort);
        break;
      case 'refresh':
        actions.refresh();
        break;
      case 'setSelectedRecordIds':
        actions.setSelectedRecordIds(actionData.ids || []);
        break;
      default:
        break;
    }
  };

  const sendMessage = async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || loading) return;

    const userMsg: ChatMsg = { id: String(Date.now()), role: 'user', content: msgText };
    setMessages((prev) => [...prev, userMsg]);
    if (!text) setInput('');
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await apiFetch<any>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: msgText }],
          mode: 'page-assistant',
          pageContext: context,
        }),
      });

      const data = res?.data;

      // Execute any action returned by AI
      if (data?.action) {
        executeAIAction(data.action);
      }

      const assistantMsg: ChatMsg = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: data?.content ?? 'Done.',
        action: data?.action?.type,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), role: 'assistant', content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = getSuggestions(context?.collectionName || '');

  const actionIcon = (action?: string) => {
    if (!action) return null;
    const icons: Record<string, React.ReactNode> = {
      setFilter: <FilterOutlined />,
      setSort: <SortAscendingOutlined />,
      refresh: <ReloadOutlined />,
    };
    return icons[action] ? (
      <Tag icon={icons[action]} color="blue" style={{ fontSize: 11 }}>
        {action}
      </Tag>
    ) : null;
  };

  return (
    <Drawer
      title={
        <Space>
          <FormaiRobotIcon style={{ color: token.colorPrimary }} />
          <span>Page AI Assistant</span>
          {context?.collectionName && (
            <Tag color="processing" style={{ fontSize: 11 }}>
              {context.collectionName}
            </Tag>
          )}
        </Space>
      }
      open={open}
      onClose={onClose}
      placement="right"
      width={360}
      closable
      closeIcon={<CloseOutlined />}
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
    >
      {/* Suggestion chips */}
      {messages.length === 1 && (
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Quick actions:
          </Text>
          <Space wrap size={4}>
            {suggestions.map((s) => (
              <Tag
                key={s}
                color="blue"
                style={{ cursor: 'pointer', fontSize: 12 }}
                icon={<BulbOutlined />}
                onClick={() => sendMessage(s)}
              >
                {s}
              </Tag>
            ))}
          </Space>
        </div>
      )}

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
              icon={msg.role === 'user' ? <UserOutlined /> : <FormaiRobotIcon />}
              style={{
                background: msg.role === 'user' ? token.colorPrimary : token.colorSuccess,
                flexShrink: 0,
              }}
            />
            <div style={{ maxWidth: '80%' }}>
              <div
                style={{
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
              {msg.action && (
                <div style={{ marginTop: 4, textAlign: 'right' }}>
                  {actionIcon(msg.action)}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
            <Avatar size="small" icon={<FormaiRobotIcon />} style={{ background: token.colorSuccess }} />
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
          placeholder={`Ask about ${context?.collectionName || 'this page'}...`}
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{ flex: 1, resize: 'none' }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => sendMessage()}
          loading={loading}
          disabled={!input.trim()}
        />
      </div>
    </Drawer>
  );
}

// ─── PageAIAssistantTrigger — floating button to open the assistant ───────────

interface PageAIAssistantTriggerProps {
  onClick: () => void;
  isOpen: boolean;
}

export function PageAIAssistantTrigger({ onClick, isOpen }: PageAIAssistantTriggerProps) {
  const { token } = theme.useToken();
  return (
    <Tooltip title={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'} placement="left">
      <Badge dot={false}>
        <Button
          type={isOpen ? 'primary' : 'default'}
          shape="circle"
          size="large"
          icon={<FormaiRobotIcon />}
          onClick={onClick}
          style={{
            position: 'fixed',
            bottom: 32,
            right: 32,
            zIndex: 200,
            boxShadow: token.boxShadow,
            width: 48,
            height: 48,
          }}
        />
      </Badge>
    </Tooltip>
  );
}
