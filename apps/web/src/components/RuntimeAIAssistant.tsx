import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Button, Input, Avatar, Spin, theme, Typography, Space, Tooltip, Badge, Drawer,
  Tag, Alert, Modal, Collapse, Divider,
} from 'antd';
import {
  RobotOutlined,
  SendOutlined,
  UserOutlined,
  CloseOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  ApiOutlined,
  CopyOutlined,
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToolCallRecord {
  toolCallId: string;
  result: any;
}

interface PendingConfirmation {
  confirmationId: string;
  skillName: string;
  skillTitle: string;
  humanReadableAction: string;
  args: Record<string, any>;
  expiresAt: number;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCallRecord[];
  pendingConfirmation?: PendingConfirmation;
  isError?: boolean;
}

// ─── Suggestion prompts based on context ──────────────────────────────────────

function getSuggestions(collectionName?: string): string[] {
  if (!collectionName) {
    return [
      'Help me query data',
      'What can I do with AI?',
    ];
  }
  return [
    `Query all ${collectionName}`,
    `Query newly added ${collectionName} this month`,
    `Count the number of ${collectionName}`,
    `Help me create a ${collectionName} record`,
  ];
}

// ─── Tool Call Result display ─────────────────────────────────────────────────

function ToolCallBadge({ toolCalls }: { toolCalls: ToolCallRecord[] }) {
  const { token } = theme.useToken();
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <Collapse
      ghost
      size="small"
      style={{ marginTop: 6 }}
      items={toolCalls.map((tc, i) => ({
        key: i,
        label: (
          <Space size={4}>
            <ApiOutlined style={{ color: token.colorPrimary, fontSize: 11 }} />
            <Text style={{ fontSize: 11, color: token.colorTextSecondary }}>
              Invoked Skill
            </Text>
            <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
              {tc.toolCallId.split('-')[0]}
            </Tag>
          </Space>
        ),
        children: (
          <pre
            style={{
              fontSize: 11,
              background: token.colorBgTextHover,
              borderRadius: 4,
              padding: '6px 8px',
              margin: 0,
              maxHeight: 120,
              overflow: 'auto',
              color: token.colorTextSecondary,
            }}
          >
            {JSON.stringify(tc.result, null, 2)}
          </pre>
        ),
      }))}
    />
  );
}

// ─── Confirmation dialog ──────────────────────────────────────────────────────

function ConfirmationAlert({
  confirmation,
  onApprove,
  onReject,
  loading,
}: {
  confirmation: PendingConfirmation;
  onApprove: () => void;
  onReject: () => void;
  loading: boolean;
}) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        border: `1px solid ${token.colorWarningBorder}`,
        borderRadius: 8,
        padding: '10px 12px',
        background: token.colorWarningBg,
        marginTop: 6,
      }}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Space size={6}>
          <ExclamationCircleOutlined style={{ color: token.colorWarning }} />
          <Text strong style={{ fontSize: 12 }}>Action requires confirmation</Text>
        </Space>
        <Text style={{ fontSize: 12 }}>
          AI wants to execute: <Text code style={{ fontSize: 11 }}>{confirmation.humanReadableAction}</Text>
        </Text>
        <Space size={8}>
          <Button
            size="small"
            type="primary"
            danger
            icon={<CheckCircleOutlined />}
            onClick={onApprove}
            loading={loading}
          >
            Confirm Execution
          </Button>
          <Button size="small" onClick={onReject} disabled={loading}>
            Cancel
          </Button>
        </Space>
      </Space>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onApprove, onReject, confirmLoading }: {
  msg: ChatMsg;
  onApprove: (confirmationId: string) => void;
  onReject: (confirmationId: string) => void;
  confirmLoading: string | null;
}) {
  const { token } = theme.useToken();
  const isUser = msg.role === 'user';

  return (
    <div
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
          background: isUser ? token.colorPrimary : token.colorSuccess,
          flexShrink: 0,
        }}
      />
      <div style={{ maxWidth: '85%' }}>
        <div
          style={{
            padding: '8px 12px',
            borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
            background: isUser
              ? token.colorPrimary
              : msg.isError
                ? token.colorErrorBg
                : token.colorBgTextHover,
            color: isUser ? '#fff' : msg.isError ? token.colorError : token.colorText,
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {msg.content}
        </div>

        {/* Tool calls transparency */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <ToolCallBadge toolCalls={msg.toolCalls} />
        )}

        {/* Confirmation required */}
        {msg.pendingConfirmation && (
          <ConfirmationAlert
            confirmation={msg.pendingConfirmation}
            onApprove={() => onApprove(msg.pendingConfirmation!.confirmationId)}
            onReject={() => onReject(msg.pendingConfirmation!.confirmationId)}
            loading={confirmLoading === msg.pendingConfirmation.confirmationId}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main RuntimeAIAssistant ──────────────────────────────────────────────────

interface RuntimeAIAssistantProps {
  open: boolean;
  onClose: () => void;
  appId?: string;
  /** Optional: narrow scope to a specific resource's skills */
  resourceScope?: Array<{ type: string; name: string }>;
  /** Optional: collection name for contextual suggestions */
  collectionName?: string;
}

/**
 * RuntimeAIAssistant
 *
 * AI chat panel calling the /api/ai/runtime-chat endpoint,
 * enabling AI to operate on business data using registered Resource Skills.
 *
 * Features:
 * - Transparent Tool Calls display (expandable to view invocation results)
 * - High-risk operation confirmation flow (requiresConfirm)
 * - Resource scope awareness (resourceScope)
 * - Chat history retention (retained within the session)
 */
export function RuntimeAIAssistant({
  open,
  onClose,
  appId,
  resourceScope,
  collectionName,
}: RuntimeAIAssistantProps) {
  const { token } = theme.useToken();

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Hello! I am the AI assistant for ${appId ? `"${appId}"` : 'the platform'}.\n\nI can help you query, create, and update data. Try telling me what you want to do.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState<string | null>(null);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages, open]);

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || loading) return;

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', content: msgText };
    setMessages((prev) => [...prev, userMsg]);
    if (!text) setInput('');
    setLoading(true);

    try {
      const res = await apiFetch<any>('/api/ai/runtime-chat', {
        method: 'POST',
        body: JSON.stringify({
          message: msgText,
          appId,
          sessionId,
          resourceScope,
        }),
      });

      const data = res?.data;
      const assistantMsg: ChatMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data?.reply ?? 'Processed successfully.',
        toolCalls: data?.toolCalls ?? [],
        pendingConfirmation: data?.pendingConfirmation ?? undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err.message}`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, appId, sessionId, resourceScope]);

  const handleConfirmApprove = useCallback(async (confirmationId: string) => {
    setConfirmLoading(confirmationId);
    try {
      const res = await apiFetch<any>('/api/ai/confirm-skill', {
        method: 'POST',
        body: JSON.stringify({ confirmationId, approved: true }),
      });
      const result = res?.data;

      // Update corresponding message: remove pendingConfirmation and add result
      setMessages((prev) => prev.map((m) =>
        m.pendingConfirmation?.confirmationId === confirmationId
          ? { ...m, pendingConfirmation: undefined }
          : m,
      ));

      const resultMsg: ChatMsg = {
        id: `confirm-${Date.now()}`,
        role: 'assistant',
        content: result?.status === 'executed'
          ? `✅ Action executed successfully.`
          : `Operation result: ${JSON.stringify(result?.result)}`,
        toolCalls: result?.result ? [{ toolCallId: confirmationId, result: result.result }] : [],
      };
      setMessages((prev) => [...prev, resultMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Execution confirmation failed: ${err.message}`,
          isError: true,
        },
      ]);
    } finally {
      setConfirmLoading(null);
    }
  }, []);

  const handleConfirmReject = useCallback((confirmationId: string) => {
    setMessages((prev) => prev.map((m) =>
      m.pendingConfirmation?.confirmationId === confirmationId
        ? { ...m, pendingConfirmation: undefined }
        : m,
    ));
    setMessages((prev) => [
      ...prev,
      {
        id: `cancel-${Date.now()}`,
        role: 'assistant',
        content: 'Sure, the operation has been cancelled.',
      },
    ]);
  }, []);

  const suggestions = getSuggestions(collectionName);

  return (
    <Drawer
      title={
        <Space>
          <RobotOutlined style={{ color: token.colorPrimary }} />
          <span>AI Data Assistant</span>
          {collectionName && (
            <Tag color="processing" style={{ fontSize: 11 }}>
              {collectionName}
            </Tag>
          )}
          {appId && (
            <Tag style={{ fontSize: 11 }}>{appId}</Tag>
          )}
        </Space>
      }
      open={open}
      onClose={onClose}
      placement="right"
      width={380}
      closable
      closeIcon={<CloseOutlined />}
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
      }}
    >
      {/* Quick suggestion chips */}
      {messages.length === 1 && (
        <div
          style={{
            padding: '10px 14px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
            Quick Actions:
          </Text>
          <Space wrap size={4}>
            {suggestions.map((s) => (
              <Tag
                key={s}
                color="blue"
                style={{ cursor: 'pointer', fontSize: 11 }}
                icon={<ThunderboltOutlined />}
                onClick={() => sendMessage(s)}
              >
                {s}
              </Tag>
            ))}
          </Space>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onApprove={handleConfirmApprove}
            onReject={handleConfirmReject}
            confirmLoading={confirmLoading}
          />
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 8, padding: '4px 0', alignItems: 'center' }}>
            <Avatar
              size="small"
              icon={<RobotOutlined />}
              style={{ background: token.colorSuccess }}
            />
            <Space size={4}>
              <LoadingOutlined style={{ color: token.colorPrimary }} />
              <Text type="secondary" style={{ fontSize: 12 }}>AI is thinking...</Text>
            </Space>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Hint bar */}
      <div
        style={{
          padding: '4px 14px',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgTextHover,
        }}
      >
        <Text type="secondary" style={{ fontSize: 10 }}>
          <ApiOutlined /> Skills active · Dangerous operations will request confirmation
        </Text>
      </div>

      {/* Input */}
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          gap: 8,
        }}
      >
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={
            collectionName
              ? `Ask about ${collectionName} data...`
              : 'Tell me what you want to do...'
          }
          autoSize={{ minRows: 1, maxRows: 5 }}
          style={{ flex: 1, resize: 'none' }}
          disabled={loading}
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

// ─── RuntimeAIAssistantTrigger — floating button ──────────────────────────────

interface RuntimeAIAssistantTriggerProps {
  onClick: () => void;
  isOpen: boolean;
  hasSkills?: boolean;
}

export function RuntimeAIAssistantTrigger({
  onClick,
  isOpen,
  hasSkills = true,
}: RuntimeAIAssistantTriggerProps) {
  const { token } = theme.useToken();
  return (
    <Tooltip
      title={isOpen ? 'Close AI Assistant' : 'AI Data Assistant (Runtime Skills)'}
      placement="left"
    >
      <Badge dot={hasSkills} color={token.colorSuccess} offset={[-4, 4]}>
        <Button
          type={isOpen ? 'primary' : 'default'}
          shape="circle"
          size="large"
          icon={<RobotOutlined />}
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
