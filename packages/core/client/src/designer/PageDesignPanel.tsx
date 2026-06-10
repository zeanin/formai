import React, { useState, useRef, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  schemaPatch?: any;
  newBlock?: any;
}

export interface PageDesignPanelProps {
  /** Whether the panel is visible */
  open: boolean;
  /** Close the panel */
  onClose: () => void;
  /** The full page schema UID (for persistence) */
  schemaUid: string;
  /** The full page schema (for AI context) */
  pageSchema: any;
  /** Callback: call AI to generate/modify schema based on a prompt */
  onAIGenerate?: (prompt: string, context: any) => Promise<any>;
  /** Currently selected block uid (from DesignableNode AI button) */
  selectedBlockUid?: string;
  /** Currently selected block schema (for AI context) */
  selectedBlockSchema?: any;
  /** Callback: apply a patch to a specific block */
  onPatch?: (uid: string, patch: any) => void;
  /** Callback: insert a new block into the page */
  onInsert?: (uid: string, position: 'before' | 'after' | 'child', schema: any) => void;
}

// ─── PageDesignPanel ─────────────────────────────────────────────────────────

export const PageDesignPanel: React.FC<PageDesignPanelProps> = ({
  open,
  onClose,
  schemaUid,
  pageSchema,
  selectedBlockUid,
  selectedBlockSchema,
  onAIGenerate,
  onPatch,
  onInsert,
}) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'schema'>('ai');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content:
        '✦ AI Design Assistant ready.\n\nI can help you:\n• Modify blocks ("Make this table show 20 rows")\n• Add new blocks ("Add a search filter above the table")\n• Redesign the page ("Add a KPI cards row at the top")\n\nSelect a block using the ✦ button, or just describe what you want.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingSchema, setPendingSchema] = useState<any>(null);
  const [pendingMode, setPendingMode] = useState<'patch' | 'insert' | null>(null);
  const [rawSchema, setRawSchema] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // When a new block is selected from the page, add a context message
  useEffect(() => {
    if (selectedBlockUid && selectedBlockSchema) {
      const compName = selectedBlockSchema['x-component'] || 'Block';
      setMessages((prev) => [
        ...prev,
        {
          id: `ctx-${selectedBlockUid}`,
          role: 'assistant',
          content: `📍 Selected: **${compName}** \`${selectedBlockUid}\`\n\nWhat would you like to change about this block?`,
        },
      ]);
    }
  }, [selectedBlockUid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize rawSchema editor from pageSchema
  useEffect(() => {
    if (pageSchema && activeTab === 'schema') {
      setRawSchema(JSON.stringify(pageSchema, null, 2));
    }
  }, [pageSchema, activeTab]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setPendingSchema(null);

    try {
      const prompt = selectedBlockUid
        ? `${input.trim()}\n\n[Context: currently editing block uid="${selectedBlockUid}", component="${selectedBlockSchema?.['x-component']}"]\n\n[Current block schema: ${JSON.stringify(selectedBlockSchema, null, 2)}]`
        : `${input.trim()}\n\n[Current page schema: ${JSON.stringify(pageSchema, null, 2)}]`;

      const context = {
        schemaUid,
        pageSchema: pageSchema || null,
        selectedBlockUid: selectedBlockUid || null,
        selectedBlockSchema: selectedBlockSchema || null,
      };

      const res = onAIGenerate
        ? await onAIGenerate(prompt, context)
        : { data: null, message: 'AI generation not configured.' };

      const aiSchema = res?.data;
      const isBlockPatch = !!selectedBlockUid && !!aiSchema;
      const isNewBlock = !selectedBlockUid && !!aiSchema;

      let replyContent = res?.message || '✦ Here is the generated schema:';

      if (isBlockPatch) {
        replyContent =
          'I\'ve generated a patch for the selected block. Click **Apply** to update it, or **Discard** to cancel.';
        setPendingSchema(aiSchema);
        setPendingMode('patch');
      } else if (isNewBlock) {
        if (aiSchema && aiSchema['x-component'] === 'Page') {
          replyContent =
            'I\'ve updated the page layout. Click **Apply** to update the page, or **Discard** to cancel.';
        } else {
          replyContent =
            'I\'ve generated a new block. Click **Apply** to add it to the page, or **Discard** to cancel.';
        }
        setPendingSchema(aiSchema);
        setPendingMode('insert');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: replyContent,
          schemaPatch: isBlockPatch ? aiSchema : undefined,
          newBlock: isNewBlock ? aiSchema : undefined,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `Error: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, selectedBlockUid, selectedBlockSchema, pageSchema, schemaUid]);

  const handleApply = useCallback(() => {
    if (!pendingSchema) return;
    if (pendingMode === 'patch' && selectedBlockUid) {
      onPatch?.(selectedBlockUid, pendingSchema);
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now()), role: 'assistant', content: '✅ Block updated successfully!' },
      ]);
    } else if (pendingMode === 'insert') {
      if (pendingSchema['x-component'] === 'Page') {
        const pageUid = pageSchema['x-uid'] || schemaUid;
        onPatch?.(pageUid, pendingSchema);
        setMessages((prev) => [
          ...prev,
          { id: String(Date.now()), role: 'assistant', content: '✅ Page updated successfully!' },
        ]);
      } else {
        // Insert as child of root, or after selected block
        const insertAfterUid = selectedBlockUid || Object.keys(pageSchema?.properties || {})[0] || '';
        onInsert?.(insertAfterUid, 'after', pendingSchema);
        setMessages((prev) => [
          ...prev,
          { id: String(Date.now()), role: 'assistant', content: '✅ New block added to the page!' },
        ]);
      }
    }
    setPendingSchema(null);
    setPendingMode(null);
  }, [pendingSchema, pendingMode, selectedBlockUid, onPatch, onInsert, pageSchema]);

  const handleDiscard = useCallback(() => {
    setPendingSchema(null);
    setPendingMode(null);
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), role: 'assistant', content: 'Discarded. What else can I help with?' },
    ]);
  }, []);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 52,
        right: 0,
        bottom: 0,
        width: 380,
        background: '#fff',
        borderLeft: '1px solid #e8e8e8',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, color: '#fff' }}>✦</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
              AI Design Assistant
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1 }}>
              AI-native page editor
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            borderRadius: 6,
            width: 28,
            height: 28,
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        {(['ai', 'schema'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #667eea' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#667eea' : '#888',
              transition: 'all 0.15s',
            }}
          >
            {tab === 'ai' ? '✦ AI Chat' : '{ } Schema Editor'}
          </button>
        ))}
      </div>

      {/* Selected block context badge */}
      {selectedBlockUid && (
        <div
          style={{
            padding: '6px 12px',
            background: '#f0f4ff',
            borderBottom: '1px solid #d6e0ff',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 10, color: '#667eea' }}>📍 Selected:</span>
          <code style={{ fontSize: 10, color: '#333', background: '#fff', padding: '1px 4px', borderRadius: 3, border: '1px solid #d6e0ff' }}>
            {selectedBlockSchema?.['x-component'] || 'Block'}
          </code>
          <code style={{ fontSize: 9, color: '#999', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedBlockUid}
          </code>
        </div>
      )}

      {/* AI Chat Tab */}
      {activeTab === 'ai' && (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: msg.role === 'user' ? '#667eea' : 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: msg.role === 'user' ? 12 : 14,
                    flexShrink: 0,
                  }}
                >
                  {msg.role === 'user' ? 'U' : '✦'}
                </div>
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '8px 12px',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: msg.role === 'user' ? '#667eea' : '#f8f8f8',
                    color: msg.role === 'user' ? '#fff' : '#333',
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Pending schema apply/discard buttons */}
            {pendingSchema && (
              <div
                style={{
                  background: '#f0f9eb',
                  border: '1px solid #b7eb8f',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 12, color: '#52c41a', fontWeight: 600 }}>
                  ✓ Schema ready — preview looks good?
                </div>
                <pre
                  style={{
                    fontSize: 10,
                    background: '#fff',
                    padding: 8,
                    borderRadius: 4,
                    overflow: 'auto',
                    maxHeight: 120,
                    border: '1px solid #e8e8e8',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(pendingSchema, null, 2)}
                </pre>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleApply}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      border: 'none',
                      borderRadius: 6,
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Apply
                  </button>
                  <button
                    onClick={handleDiscard}
                    style={{
                      padding: '6px 14px',
                      border: '1px solid #d9d9d9',
                      borderRadius: 6,
                      background: '#fff',
                      fontSize: 12,
                      cursor: 'pointer',
                      color: '#666',
                    }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {loading && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    color: '#fff',
                  }}
                >
                  ✦
                </div>
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#f8f8f8',
                    borderRadius: '12px 12px 12px 2px',
                    fontSize: 13,
                    color: '#999',
                    display: 'flex',
                    gap: 4,
                    alignItems: 'center',
                  }}
                >
                  <span>Thinking</span>
                  <LoadingDots />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestion chips */}
          <div style={{ padding: '6px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid #f5f5f5' }}>
            {[
              'Add a search filter',
              'Add KPI cards',
              'Make it a form',
              'Add export button',
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => setInput(chip)}
                style={{
                  padding: '3px 10px',
                  border: '1px solid #d6e0ff',
                  borderRadius: 12,
                  background: '#f0f4ff',
                  color: '#667eea',
                  fontSize: 11,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div
            style={{
              padding: '10px 12px',
              borderTop: '1px solid #f0f0f0',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                selectedBlockUid
                  ? `Describe changes to ${selectedBlockSchema?.['x-component'] || 'this block'}…`
                  : 'Describe what you want to add or change…'
              }
              rows={2}
              style={{
                flex: 1,
                resize: 'none',
                border: '1px solid #d9d9d9',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 13,
                lineHeight: 1.4,
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#667eea')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#d9d9d9')}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                width: 36,
                height: 36,
                border: 'none',
                borderRadius: 8,
                background:
                  !input.trim() || loading
                    ? '#f0f0f0'
                    : 'linear-gradient(135deg, #667eea, #764ba2)',
                color: !input.trim() || loading ? '#ccc' : '#fff',
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              ↑
            </button>
          </div>
        </>
      )}

      {/* Schema Editor Tab */}
      {activeTab === 'schema' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            style={{
              padding: '8px 12px',
              background: '#fffbe6',
              borderBottom: '1px solid #ffe58f',
              fontSize: 11,
              color: '#874d00',
            }}
          >
            ⚠ Direct schema edits will be applied immediately. Use with caution.
          </div>
          <textarea
            value={rawSchema}
            onChange={(e) => setRawSchema(e.target.value)}
            style={{
              flex: 1,
              padding: 12,
              border: 'none',
              outline: 'none',
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.6,
              resize: 'none',
              background: '#1e1e1e',
              color: '#d4d4d4',
            }}
          />
          <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                try {
                  const parsed = JSON.parse(rawSchema);
                  const uid = parsed['x-uid'];
                  if (uid) {
                    onPatch?.(uid, parsed);
                  }
                } catch {
                  alert('Invalid JSON. Please fix before applying.');
                }
              }}
              style={{
                flex: 1,
                padding: '6px 0',
                border: 'none',
                borderRadius: 6,
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Apply Schema
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Loading dots animation ───────────────────────────────────────────────────

const LoadingDots: React.FC = () => {
  const [dots, setDots] = useState('.');
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '.' : d + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return <span style={{ minWidth: 18 }}>{dots}</span>;
};
