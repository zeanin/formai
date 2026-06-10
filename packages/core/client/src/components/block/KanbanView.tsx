import React, { useState, useCallback, useEffect } from 'react';
import { Card, Typography, Badge, Space, Button, Tooltip, Spin } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useAPIClient } from '../../providers/APIClientProvider';

const { Text } = Typography;

export interface KanbanCard {
  id: string | number;
  title: string;
  description?: string;
  /** The column key this card belongs to */
  columnKey: string;
  /** Extra metadata displayed as tag/badge */
  meta?: Record<string, string | number>;
  /** Original record for callbacks */
  record?: Record<string, unknown>;
}

export interface KanbanColumn {
  key: string;
  title: string;
  color?: string;
  limit?: number; // WIP limit, shows warning when exceeded
}

export interface KanbanViewProps {
  columns: KanbanColumn[];
  cards?: KanbanCard[];
  /** Optional dynamic collection configuration */
  collection?: string;
  groupBy?: string; // field to group by, e.g. 'status'
  titleField?: string; // field to display as title, e.g. 'name'
  descriptionField?: string; // field to display as description, e.g. 'description'
  /** Called when a card is dropped onto a new column */
  onCardMove?: (cardId: string | number, fromColumn: string, toColumn: string) => void;
  /** Called when + button is clicked in a column */
  onAddCard?: (columnKey: string) => void;
  /** Called when a card is clicked */
  onCardClick?: (card: KanbanCard) => void;
  /** Width of each column in px (default 260) */
  columnWidth?: number;
  style?: React.CSSProperties;
  readOnly?: boolean;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  columns = [],
  cards = [],
  collection,
  groupBy = 'status',
  titleField = 'name',
  descriptionField = 'description',
  onCardMove,
  onAddCard,
  onCardClick,
  columnWidth = 260,
  style,
  readOnly = false,
}) => {
  const apiClient = useAPIClient();
  const [localCards, setLocalCards] = useState<KanbanCard[]>(cards);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState<{ cardId: string | number; fromColumn: string } | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!collection || !apiClient) return;
    setLoading(true);
    try {
      const res = await apiClient.request({
        url: `/api/${collection}`,
        method: 'GET',
        params: {
          pageSize: 100,
        },
      });
      const records = res?.data || [];
      const mapped = records.map((record: any) => {
        const titleVal = record[titleField] || record[titleField === 'name' ? 'title' : 'name'] || record.name || record.title || `Record #${record.id}`;
        const descVal = record[descriptionField] || record[descriptionField === 'description' ? 'content' : 'description'] || record.description || record.content || '';
        
        // Extract currency amount if present
        const metaObj: Record<string, string | number> = {};
        if (record.amount != null) {
          metaObj['Amount'] = `¥${parseFloat(record.amount).toFixed(2)}`;
        } else if (record.price != null) {
          metaObj['Price'] = `¥${parseFloat(record.price).toFixed(2)}`;
        }
        
        return {
          id: record.id,
          title: String(titleVal),
          description: String(descVal),
          columnKey: String(record[groupBy] || 'todo'),
          meta: metaObj,
          record,
        };
      });
      setLocalCards(mapped);
    } catch (err) {
      console.error('[KanbanView] Failed to fetch collection cards:', err);
    } finally {
      setLoading(false);
    }
  }, [collection, apiClient, groupBy, titleField, descriptionField]);

  useEffect(() => {
    if (collection) {
      fetchData();
    } else {
      setLocalCards(cards || []);
    }
  }, [collection, cards, fetchData]);

  const cardsByColumn = useCallback(
    (colKey: string) => localCards.filter((c) => String(c.columnKey).toLowerCase() === String(colKey).toLowerCase()),
    [localCards],
  );

  const handleDragStart = (card: KanbanCard) => {
    if (readOnly) return;
    setDragging({ cardId: card.id, fromColumn: card.columnKey });
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setOverColumn(colKey);
  };

  const handleDrop = async (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    if (dragging && dragging.fromColumn !== colKey) {
      if (collection && apiClient) {
        setLoading(true);
        try {
          await apiClient.request({
            url: `/api/${collection}/${dragging.cardId}`,
            method: 'PUT',
            data: {
              values: {
                [groupBy]: colKey,
              },
            },
          });
          await fetchData();
        } catch (err) {
          console.error('[KanbanView] Drop update failed:', err);
        } finally {
          setLoading(false);
        }
      } else {
        // Fallback for static card state
        setLocalCards((prev) =>
          prev.map((c) => (c.id === dragging.cardId ? { ...c, columnKey: colKey } : c))
        );
      }
      onCardMove?.(dragging.cardId, dragging.fromColumn, colKey);
    }
    setDragging(null);
    setOverColumn(null);
  };

  const handleDragEnd = () => {
    setDragging(null);
    setOverColumn(null);
  };

  // If no columns are provided but we have cards, compile default columns dynamically
  const displayedColumns = columns.length > 0 ? columns : [
    { key: 'todo', title: 'To Do', color: '#f5f5f5' },
    { key: 'in_progress', title: 'In Progress', color: '#e6f4ff' },
    { key: 'done', title: 'Done', color: '#f6ffed' }
  ];

  return (
    <Spin spinning={loading}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          padding: '8px 4px',
          ...style,
        }}
      >
        {displayedColumns.map((col) => {
          const colCards = cardsByColumn(col.key);
          const isOver = overColumn === col.key;
          const overLimit = col.limit != null && colCards.length > col.limit;

          return (
            <div
              key={col.key}
              style={{ width: columnWidth, flexShrink: 0 }}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: col.color ?? '#f5f5f5',
                  borderRadius: '8px 8px 0 0',
                  marginBottom: 6,
                  borderBottom: '2px solid rgba(0,0,0,0.04)',
                }}
              >
                <Space size={6}>
                  <Text strong style={{ fontSize: 13, letterSpacing: '0.02em' }}>{col.title}</Text>
                  <Badge
                    count={colCards.length}
                    showZero
                    color={overLimit ? '#ff4d4f' : '#1677ff'}
                    style={{ fontSize: 10, minWidth: 16, height: 16, lineHeight: '16px' }}
                  />
                  {col.limit != null && (
                    <Tooltip title={`WIP limit: ${col.limit}`}>
                      <Text type={overLimit ? 'danger' : 'secondary'} style={{ fontSize: 11 }}>
                        /{col.limit}
                      </Text>
                    </Tooltip>
                  )}
                </Space>
                {!readOnly && onAddCard && (
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined style={{ fontSize: 12 }} />}
                    onClick={() => onAddCard(col.key)}
                    style={{ padding: '0 4px', height: 22, width: 22 }}
                  />
                )}
              </div>

              {/* Column body */}
              <div
                style={{
                  minHeight: 320,
                  maxHeight: 600,
                  overflowY: 'auto',
                  background: isOver ? '#f0f5ff' : '#fafafa',
                  borderRadius: '0 0 8px 8px',
                  border: isOver ? '2px dashed #1890ff' : '2px solid rgba(0,0,0,0.02)',
                  padding: 8,
                  transition: 'background 0.15s, border 0.15s',
                }}
              >
                {colCards.map((card) => (
                  <Card
                    key={card.id}
                    size="small"
                    hoverable
                    draggable={!readOnly}
                    onDragStart={() => handleDragStart(card)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onCardClick?.(card)}
                    style={{
                      marginBottom: 8,
                      cursor: readOnly ? 'default' : 'grab',
                      opacity: dragging?.cardId === card.id ? 0.4 : 1,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      borderRadius: 6,
                      border: '1px solid rgba(0,0,0,0.06)',
                    }}
                    bodyStyle={{ padding: '10px 12px' }}
                  >
                    <Text style={{ fontSize: 13, display: 'block', fontWeight: 500, marginBottom: 4, color: '#262626' }}>
                      {card.title}
                    </Text>
                    {card.description ? (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', whiteSpace: 'normal', wordBreak: 'break-all' }}>
                        {card.description}
                      </Text>
                    ) : null}
                    {card.meta && Object.keys(card.meta).length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {Object.entries(card.meta).map(([k, v]) => (
                          <span
                              key={k}
                              style={{
                                fontSize: 10,
                                background: '#f0f0f0',
                                padding: '1px 6px',
                                borderRadius: 4,
                                color: '#595959',
                                border: '1px solid rgba(0,0,0,0.03)',
                              }}
                          >
                            {k}: <strong>{String(v)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
                {colCards.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#bfbfbf', fontSize: 12 }}>
                    No items
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Spin>
  );
};

export default KanbanView;
