import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, Empty, Alert, theme, Typography } from 'antd';
import { SchemaRenderer } from '@formai/client';
import { useDesignMode, PageDesignPanel } from '@formai/client';
import { PageAIContextProvider } from '../providers/PageAIContextProvider';
import { PageAIAssistant, PageAIAssistantTrigger } from '../components/PageAIAssistant';

const { Title } = Typography;
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

interface SchemaPageProps {
  /** Override appId (default from URL param) */
  appId?: string;
  /** Override schemaUid (default resolved from appMenus via menuPath) */
  schemaUid?: string;
  /** Permissions for the current user */
  userPermissions?: string[];
}

/**
 * SchemaPage — runtime route component that:
 * 1. Resolves which schema to show (from URL params → appMenu → schemaUid)
 * 2. Loads the UI schema from the backend
 * 3. Wraps content in PageAIContextProvider
 * 4. Renders the schema via SchemaRenderer (with design-mode support)
 * 5. Shows PageDesignPanel when in design mode
 * 6. Persists schema changes via PATCH /api/uiSchemas/:uid
 */
export function SchemaPage({ userPermissions = [] }: SchemaPageProps) {
  const { token } = theme.useToken();
  const { appId, menuPath } = useParams<{ appId: string; menuPath: string }>();
  const { mode } = useDesignMode();
  const designable = mode === 'design';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuItem, setMenuItem] = useState<any>(null);
  const [schemaUid, setSchemaUid] = useState<string>('');
  const [schema, setSchema] = useState<any>(null);
  const [aiOpen, setAiOpen] = useState(false);

  // Design panel state
  const [designPanelOpen, setDesignPanelOpen] = useState(false);
  const [selectedBlockUid, setSelectedBlockUid] = useState<string | undefined>();
  const [selectedBlockSchema, setSelectedBlockSchema] = useState<any>(undefined);

  // Auto-open design panel when entering design mode
  useEffect(() => {
    if (designable) {
      setDesignPanelOpen(true);
    } else {
      setDesignPanelOpen(false);
      setSelectedBlockUid(undefined);
      setSelectedBlockSchema(undefined);
    }
  }, [designable]);

  // Debounced persistence
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistSchema = useCallback(
    (uid: string, updatedSchema: any) => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(async () => {
        try {
          await apiFetch(`/api/uiSchemas/${uid}`, {
            method: 'PUT',
            body: JSON.stringify({ values: { schema: updatedSchema } }),
          });
        } catch (err: any) {
          console.error('[SchemaPage] Failed to persist schema:', err.message);
        }
      }, 600);
    },
    [],
  );

  // Deep clone helper
  const deepClone = (obj: any) => JSON.parse(JSON.stringify(obj));

  /**
   * Find a node by uid and apply a patch.
   */
  const patchNodeInSchema = useCallback(
    (root: any, uid: string, patch: any): boolean => {
      if (!root || typeof root !== 'object') return false;
      if (root['x-uid'] === uid) {
        Object.assign(root, patch);
        if (patch['x-component-props'] && root['x-component-props']) {
          root['x-component-props'] = { ...root['x-component-props'], ...patch['x-component-props'] };
        }
        return true;
      }
      for (const key of Object.keys(root.properties || {})) {
        if (patchNodeInSchema(root.properties[key], uid, patch)) return true;
      }
      if (root.items && patchNodeInSchema(root.items, uid, patch)) return true;
      return false;
    },
    [],
  );

  /**
   * Find a node by uid and remove it from its parent's properties.
   */
  const removeNodeFromSchema = useCallback(
    (root: any, uid: string): boolean => {
      if (!root?.properties) return false;
      for (const key of Object.keys(root.properties)) {
        if (root.properties[key]['x-uid'] === uid) {
          delete root.properties[key];
          return true;
        }
        if (removeNodeFromSchema(root.properties[key], uid)) return true;
      }
      return false;
    },
    [],
  );

  /**
   * Find a node's parent container and swap key ordering in properties.
   */
  const moveNodeInSchema = useCallback(
    (root: any, uid: string, direction: 'up' | 'down'): boolean => {
      if (!root || typeof root !== 'object') return false;

      const properties = root.properties;
      if (properties) {
        const keys = Object.keys(properties);
        const index = keys.findIndex((k) => properties[k]['x-uid'] === uid);

        if (index > -1) {
          if (direction === 'up' && index > 0) {
            const newProperties: Record<string, any> = {};
            keys.forEach((key, kIdx) => {
              if (kIdx === index - 1) {
                newProperties[keys[index]] = properties[keys[index]];
              } else if (kIdx === index) {
                newProperties[keys[index - 1]] = properties[keys[index - 1]];
              } else {
                newProperties[key] = properties[key];
              }
            });
            root.properties = newProperties;
            return true;
          } else if (direction === 'down' && index < keys.length - 1) {
            const newProperties: Record<string, any> = {};
            keys.forEach((key, kIdx) => {
              if (kIdx === index) {
                newProperties[keys[index + 1]] = properties[keys[index + 1]];
              } else if (kIdx === index + 1) {
                newProperties[keys[index]] = properties[keys[index]];
              } else {
                newProperties[key] = properties[key];
              }
            });
            root.properties = newProperties;
            return true;
          }
          return false;
        }
      }

      for (const key of Object.keys(root.properties || {})) {
        if (moveNodeInSchema(root.properties[key], uid, direction)) return true;
      }
      if (root.items && moveNodeInSchema(root.items, uid, direction)) return true;
      return false;
    },
    [],
  );

  // ─── Design callbacks ────────────────────────────────────────────────────

  const handlePatch = useCallback(
    (uid: string, patch: any) => {
      setSchema((prev: any) => {
        if (!prev) return prev;
        if (prev['x-uid'] === uid) {
          persistSchema(schemaUid, patch);
          return patch;
        }
        const next = deepClone(prev);
        patchNodeInSchema(next, uid, patch);
        persistSchema(schemaUid, next);
        return next;
      });
    },
    [schemaUid, patchNodeInSchema, persistSchema],
  );

  const handleRemove = useCallback(
    (uid: string) => {
      setSchema((prev: any) => {
        if (!prev) return prev;
        const next = deepClone(prev);
        removeNodeFromSchema(next, uid);
        persistSchema(schemaUid, next);
        return next;
      });
    },
    [schemaUid, removeNodeFromSchema, persistSchema],
  );

  const handleMove = useCallback(
    (uid: string, direction: 'up' | 'down') => {
      setSchema((prev: any) => {
        if (!prev) return prev;
        const next = deepClone(prev);
        const moved = moveNodeInSchema(next, uid, direction);
        if (moved) {
          persistSchema(schemaUid, next);
        }
        return next;
      });
    },
    [schemaUid, moveNodeInSchema, persistSchema],
  );

  const handleInsert = useCallback(
    (_uid: string, _position: 'before' | 'after' | 'child', newBlock: any) => {
      setSchema((prev: any) => {
        if (!prev) return prev;
        const next = deepClone(prev);
        // Insert as a top-level page block
        const blockKey = newBlock['x-uid'] || `block_${Date.now()}`;
        if (!next.properties) next.properties = {};
        next.properties[blockKey] = newBlock;
        persistSchema(schemaUid, next);
        return next;
      });
    },
    [schemaUid, persistSchema],
  );

  const handleSelectBlock = useCallback((uid: string, blockSchema: any) => {
    setSelectedBlockUid(uid);
    setSelectedBlockSchema(blockSchema);
    setDesignPanelOpen(true);
  }, []);

  // AI generation callback
  const handleAIGenerate = useCallback(
    async (prompt: string, context: any) => {
      return apiFetch<any>('/api/ai/a2ui', {
        method: 'POST',
        body: JSON.stringify({ prompt, mode: 'modify', context }),
      });
    },
    [],
  );

  // ─── Load schema ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!appId || !menuPath) return;

    setLoading(true);
    setError(null);

    // 1. Load all menus for the app to find the one matching menuPath
    apiFetch<any>(`/api/apps/${appId}/menus`)
      .then(async (menusRes) => {
        const menus: any[] = menusRes?.data ?? [];
        const menu = menus.find((m: any) => m.path === menuPath || String(m.id) === menuPath);

        if (!menu) {
          setError(`Page not found: "${menuPath}"`);
          return;
        }

        setMenuItem(menu);

        // 2. Load the UI schema if we have a schemaUid
        if (menu.schemaUid) {
          setSchemaUid(menu.schemaUid);
          const schemaRes = await apiFetch<any>(`/api/uiSchemas/${menu.schemaUid}`);
          setSchema(schemaRes?.data?.schema ?? null);
        } else if (menu.type === 'group') {
          setError('This is a menu group, not a page.');
        } else {
          // No schema yet — show placeholder
          setSchema(null);
        }
      })
      .catch((err: any) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [appId, menuPath]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <Alert
          type="error"
          message="Page Error"
          description={error}
          showIcon
        />
      </div>
    );
  }

  const pageTitle = menuItem?.title || menuPath || 'Page';
  const isRootPage = schema?.['x-component'] === 'Page';
  const collectionName = schema?.['x-collection'] || menuItem?.collectionName || '';

  return (
    <PageAIContextProvider
      initialContext={{
        appId: appId || '',
        pageSchemaUid: menuItem?.schemaUid || '',
        collectionName,
        currentFilters: {},
        selectedRecordIds: [],
        visibleFields: [],
        userPermissions,
      }}
    >
      {/* Design mode banner */}
      {designable && (
        <div
          style={{
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            padding: '6px 16px',
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ fontSize: 14 }}>✦</span>
          <span>Design Mode — hover over blocks to edit, or use the AI assistant →</span>
          <button
            onClick={() => setDesignPanelOpen((v) => !v)}
            style={{
              marginLeft: 'auto',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              padding: '2px 10px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {designPanelOpen ? 'Close AI Panel' : 'Open AI Panel'}
          </button>
        </div>
      )}

      {/* Page container — shift left when design panel is open */}
      <div
        className="formai-page-container"
        style={{
          padding: isRootPage ? 0 : undefined,
          minHeight: '100%',
          marginRight: designable && designPanelOpen ? 380 : 0,
          transition: 'margin-right 0.25s ease',
        }}
      >
        {/* Page title */}
        {!isRootPage && (
          <div style={{ marginBottom: 20 }}>
            <Title level={3} style={{ margin: 0 }}>
              {pageTitle}
            </Title>
          </div>
        )}

        {/* Schema-rendered content */}
        {schema ? (
          <SchemaRenderer
            schema={schema}
            designable={designable}
            onPatch={handlePatch}
            onRemove={handleRemove}
            onInsert={handleInsert}
            onSelectBlock={handleSelectBlock}
            onMove={handleMove}
          />
        ) : (
          <Empty
            description={
              <div>
                <div style={{ marginBottom: 8 }}>This page has no schema configured yet.</div>
                <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
                  {designable
                    ? 'Use the AI Design Assistant (right panel) to generate a UI for this page.'
                    : 'Use the AI Assistant to generate a UI for this page, or configure it in the admin panel.'}
                </div>
              </div>
            }
          />
        )}
      </div>

      {/* AI Design Panel (right drawer, only in design mode) */}
      {designable && (
        <PageDesignPanel
          open={designPanelOpen}
          onClose={() => setDesignPanelOpen(false)}
          schemaUid={schemaUid}
          pageSchema={schema}
          selectedBlockUid={selectedBlockUid}
          selectedBlockSchema={selectedBlockSchema}
          onAIGenerate={handleAIGenerate}
          onPatch={handlePatch}
          onInsert={handleInsert}
        />
      )}

      {/* Floating AI assistant trigger (runtime assistant, hidden in design mode) */}
      {!designable && (
        <>
          <PageAIAssistantTrigger onClick={() => setAiOpen((v) => !v)} isOpen={aiOpen} />
          <PageAIAssistant open={aiOpen} onClose={() => setAiOpen(false)} />
        </>
      )}
    </PageAIContextProvider>
  );
}
