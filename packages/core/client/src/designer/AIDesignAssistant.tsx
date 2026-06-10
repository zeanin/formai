import React, { useState, useRef, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AICommandButtonProps {
  context: {
    page?: any;
    block?: any;
    collection?: string;
    fields?: string[];
  };
  onGenerate: (schema: any) => void;
  buttonText?: string;
}

export interface AIChatPanelProps {
  mode: 'builder' | 'assistant';
  context?: {
    currentPage?: any;
    collections?: string[];
    currentSchema?: any;
  };
  onApplySchema?: (schema: any) => void;
  onApplyCollection?: (collection: any) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  schema?: any;
  timestamp: number;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Simulate an AI response (placeholder - replace with real @formai/ai call) */
async function callAIAPI(prompt: string, _context?: any): Promise<{ content: string; schema?: any }> {
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
  const lower = prompt.toLowerCase();

  if (lower.includes('table') || lower.includes('list')) {
    return {
      content: 'Here is a table block for your data. You can customize columns as needed.',
      schema: {
        'x-component': 'Table',
        'x-component-props': {
          columns: [
            { key: 'id', title: 'ID', dataIndex: 'id' },
            { key: 'name', title: 'Name', dataIndex: 'name' },
            { key: 'status', title: 'Status', dataIndex: 'status' },
          ],
          dataSource: [],
        },
      },
    };
  }

  if (lower.includes('form')) {
    return {
      content: 'Here is a form block. Add your fields and configure validation.',
      schema: {
        'x-component': 'Form',
        'x-component-props': { layout: 'vertical' },
        properties: {
          name: {
            'x-component': 'FormItem',
            'x-component-props': { label: 'Name', required: true },
            properties: { name: { 'x-component': 'Input' } },
          },
          status: {
            'x-component': 'FormItem',
            'x-component-props': { label: 'Status' },
            properties: {
              status: {
                'x-component': 'Select',
                'x-component-props': {
                  options: [
                    { label: 'Active', value: 'active' },
                    { label: 'Inactive', value: 'inactive' },
                  ],
                },
              },
            },
          },
        },
      },
    };
  }

  return {
    content: `I can help you build that. Could you provide more details about the data structure or layout you need?`,
  };
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── AICommandButton ──────────────────────────────────────────────────────────

// Block-level AI button ("AI Optimize" on each block)
export const AICommandButton: React.FC<AICommandButtonProps> = ({
  context,
  onGenerate,
  buttonText = 'AI Optimize',
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const result = await callAIAPI(prompt, context);
      if (result.schema) {
        setPreview(result.schema);
      } else {
        setError(result.content);
      }
    } catch (err) {
      setError('AI request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (preview) {
      onGenerate(preview);
      setOpen(false);
      setPreview(null);
      setPrompt('');
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          border: '1px solid #1677ff',
          borderRadius: 4,
          background: open ? '#e6f4ff' : '#fff',
          color: '#1677ff',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        ✨ {buttonText}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 1100,
            marginTop: 4,
            width: 320,
            background: '#fff',
            border: '1px solid #e8e8e8',
            borderRadius: 8,
            boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid #f0f0f0',
              fontSize: 13,
              fontWeight: 600,
              color: '#1677ff',
              background: '#f8fbff',
            }}
          >
            ✨ AI Assistant
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to optimize or add..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                fontSize: 13,
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
            />

            {error && (
              <div style={{ fontSize: 12, color: '#ff4d4f', padding: '4px 0' }}>{error}</div>
            )}

            {preview && (
              <div
                style={{
                  padding: '8px 10px',
                  background: '#f6ffed',
                  border: '1px solid #b7eb8f',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#52c41a',
                }}
              >
                ✓ Schema generated — preview ready
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {preview && (
                <button
                  onClick={handleApply}
                  style={{
                    padding: '5px 14px',
                    border: 'none',
                    borderRadius: 5,
                    background: '#1677ff',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Apply
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={loading || !prompt.trim()}
                style={{
                  padding: '5px 14px',
                  border: '1px solid #1677ff',
                  borderRadius: 5,
                  background: loading ? '#f0f0f0' : '#fff',
                  color: '#1677ff',
                  cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  opacity: loading || !prompt.trim() ? 0.6 : 1,
                }}
              >
                {loading ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── AIChatPanel ──────────────────────────────────────────────────────────────

// Chat-style AI panel (sidebar or modal)
export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  mode,
  context,
  onApplySchema,
  onApplyCollection,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: generateId(),
      role: 'assistant',
      content:
        mode === 'builder'
          ? 'Hi! I can help you build pages and layouts. Describe what you want to create.'
          : 'Hi! I can help you with your current page. What would you like to improve?',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await callAIAPI(text, context);
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: result.content,
        schema: result.schema,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, context]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          background: '#f8fbff',
          fontSize: 13,
          fontWeight: 600,
          color: '#1677ff',
        }}
      >
        ✨ AI {mode === 'builder' ? 'Page Builder' : 'Design Assistant'}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 6,
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: msg.role === 'user' ? '#1677ff' : '#f5f5f5',
                color: msg.role === 'user' ? '#fff' : '#333',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {msg.content}
            </div>

            {msg.schema && (
              <div
                style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  border: '1px solid #b7eb8f',
                  borderRadius: 6,
                  background: '#f6ffed',
                  fontSize: 12,
                }}
              >
                <div style={{ color: '#52c41a', fontWeight: 500, marginBottom: 6 }}>
                  ✓ Schema generated
                </div>
                <pre
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: '#666',
                    overflow: 'auto',
                    maxHeight: 120,
                    fontFamily: 'monospace',
                  }}
                >
                  {JSON.stringify(msg.schema, null, 2)}
                </pre>
                {onApplySchema && (
                  <button
                    onClick={() => onApplySchema(msg.schema)}
                    style={{
                      marginTop: 8,
                      padding: '4px 12px',
                      border: 'none',
                      borderRadius: 4,
                      background: '#52c41a',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    Apply
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '12px 12px 12px 2px',
                background: '#f5f5f5',
                fontSize: 13,
                color: '#999',
              }}
            >
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          gap: 8,
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI to build or modify..."
          rows={2}
          style={{
            flex: 1,
            padding: '8px 10px',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            fontSize: 13,
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            alignSelf: 'flex-end',
            padding: '6px 14px',
            border: 'none',
            borderRadius: 6,
            background: loading || !input.trim() ? '#d9d9d9' : '#1677ff',
            color: '#fff',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

// ─── AIGlobalInput ────────────────────────────────────────────────────────────

// Global AI input bar at the top of the page
export const AIGlobalInput: React.FC<{
  onGenerate: (schema: any) => void;
  placeholder?: string;
}> = ({
  onGenerate,
  placeholder = 'Create a customer management page with table and form...',
}) => {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const text = value.trim();
    if (!text || loading) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const result = await callAIAPI(text);
      if (result.schema) {
        setPreview(result.schema);
      } else {
        setError(result.content);
      }
    } catch {
      setError('AI request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (preview) {
      onGenerate(preview);
      setPreview(null);
      setValue('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          border: '1.5px solid #1677ff',
          borderRadius: 8,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(22, 119, 255, 0.1)',
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>✨</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: 14,
            color: '#333',
            background: 'transparent',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !value.trim()}
          style={{
            flexShrink: 0,
            padding: '5px 14px',
            border: 'none',
            borderRadius: 6,
            background: loading || !value.trim() ? '#d9d9d9' : '#1677ff',
            color: '#fff',
            cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 500,
            transition: 'background 0.2s',
          }}
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#ff4d4f', paddingLeft: 4 }}>{error}</div>
      )}

      {preview && (
        <div
          style={{
            padding: '10px 14px',
            border: '1px solid #b7eb8f',
            borderRadius: 6,
            background: '#f6ffed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, color: '#52c41a', fontWeight: 500 }}>
            ✓ Schema ready — {preview['x-component']} block generated
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setPreview(null)}
              style={{
                padding: '4px 10px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                color: '#666',
              }}
            >
              Discard
            </button>
            <button
              onClick={handleApply}
              style={{
                padding: '4px 10px',
                border: 'none',
                borderRadius: 4,
                background: '#52c41a',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── AIPreview ────────────────────────────────────────────────────────────────

// AI Preview overlay - shows generated schema before applying
export const AIPreview: React.FC<{
  schema: any;
  onConfirm: () => void;
  onCancel: () => void;
  onModify: (instruction: string) => void;
}> = ({ schema, onConfirm, onCancel, onModify }) => {
  const [modifyInput, setModifyInput] = useState('');

  const handleModify = () => {
    const text = modifyInput.trim();
    if (!text) return;
    onModify(text);
    setModifyInput('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: 640,
          background: '#fff',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fbff',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1677ff' }}>
            ✨ AI Generated Preview
          </span>
          <button
            onClick={onCancel}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: '#999',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Schema preview */}
        <div style={{ padding: '16px 20px' }}>
          <div
            style={{
              padding: '12px',
              background: '#fafafa',
              border: '1px solid #e8e8e8',
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>Generated Schema</div>
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                color: '#333',
                overflow: 'auto',
                maxHeight: 200,
                fontFamily: 'monospace',
              }}
            >
              {JSON.stringify(schema, null, 2)}
            </pre>
          </div>

          {/* Modify input */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              value={modifyInput}
              onChange={(e) => setModifyInput(e.target.value)}
              placeholder='Modify: "also add a search bar", "use horizontal layout"...'
              style={{
                flex: 1,
                padding: '7px 10px',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                fontSize: 13,
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleModify();
              }}
            />
            <button
              onClick={handleModify}
              disabled={!modifyInput.trim()}
              style={{
                padding: '7px 14px',
                border: '1px solid #1677ff',
                borderRadius: 6,
                background: '#fff',
                color: '#1677ff',
                cursor: modifyInput.trim() ? 'pointer' : 'not-allowed',
                fontSize: 13,
                opacity: modifyInput.trim() ? 1 : 0.5,
              }}
            >
              Modify
            </button>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '7px 20px',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                background: '#fff',
                color: '#555',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              style={{
                padding: '7px 20px',
                border: 'none',
                borderRadius: 6,
                background: '#1677ff',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
