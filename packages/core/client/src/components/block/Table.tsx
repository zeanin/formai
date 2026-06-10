import React, { useState, useEffect } from 'react';
import { Table as AntTable } from 'antd';
import type { TableProps as AntTableProps, ColumnType } from 'antd/es/table';
import { useAPIClient } from '../../providers/APIClientProvider';

export interface TableColumnProps {
  title: string;
  dataIndex: string;
  key?: string;
  sorter?: boolean;
  width?: number;
  fixed?: 'left' | 'right' | boolean;
  ellipsis?: boolean;
  render?: any; // Allow functions or string render types
}

export interface TablePaginationProps {
  current?: number;
  pageSize?: number;
  total?: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  onChange?: (page: number, pageSize: number) => void;
}

export interface TableProps {
  collection?: string;
  columns?: TableColumnProps[];
  dataSource?: any[];
  loading?: boolean;
  pagination?: TablePaginationProps | false;
  rowSelection?: boolean;
  bordered?: boolean;
  size?: 'small' | 'middle' | 'large';
  rowKey?: string | ((record: any) => string);
  scroll?: { x?: number | string; y?: number | string };
  onRow?: (record: any, index?: number) => React.HTMLAttributes<HTMLElement>;
  onChange?: (pagination: any, filters: any, sorter: any) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Table: React.FC<TableProps> = ({
  collection,
  columns,
  dataSource,
  loading = false,
  pagination,
  rowSelection,
  bordered = false,
  size = 'middle',
  rowKey = 'id',
  scroll = { x: 'max-content' },
  onRow,
  onChange,
  style,
}) => {
  const [data, setData] = useState<any[]>(dataSource || []);
  const [loadingState, setLoadingState] = useState(loading);
  const [filterState, setFilterState] = useState<any>({});
  const apiClient = useAPIClient();

  useEffect(() => {
    const handleFilterChange = (e: Event) => {
      const { collection: eventCollection, filter } = (e as CustomEvent).detail || {};
      if (eventCollection === collection) {
        setFilterState(filter || {});
      }
    };
    window.addEventListener('formai-filter-change', handleFilterChange);
    return () => window.removeEventListener('formai-filter-change', handleFilterChange);
  }, [collection]);

  useEffect(() => {
    if (dataSource) {
      setData(dataSource);
      return;
    }
    if (collection && apiClient) {
      setLoadingState(true);
      apiClient
        .request({
          url: `/api/${collection}`,
          method: 'GET',
          params: {
            pageSize: 100,
            filter: filterState,
          },
        })
        .then((res) => {
          setData(res?.data || []);
        })
        .catch((err) => {
          console.error('[Table] Failed to fetch data:', err);
        })
        .finally(() => {
          setLoadingState(false);
        });
    }
  }, [collection, dataSource, apiClient, filterState]);

  const antColumns: ColumnType<any>[] | undefined = columns?.map((col) => {
    let customRender = col.render;
    if (typeof col.render === 'string') {
      const renderStr = col.render.toLowerCase();
      if (renderStr === 'amount') {
        customRender = (val: any) => {
          if (val == null) return '—';
          return typeof val === 'number' ? `¥${val.toFixed(2)}` : `¥${parseFloat(val).toFixed(2)}`;
        };
      } else if (renderStr === 'badge' || renderStr === 'status') {
        customRender = (val: any) => {
          if (val == null) return '—';
          const colors: Record<string, string> = {
            active: 'green',
            published: 'blue',
            pending: 'orange',
            draft: 'gold',
            inactive: 'red',
            cancelled: 'red',
            error: 'red',
          };
          const color = colors[String(val).toLowerCase()] || 'blue';
          return (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 4,
                background:
                  color === 'green'
                    ? '#f6ffed'
                    : color === 'blue'
                    ? '#e6f7ff'
                    : color === 'orange'
                    ? '#fff7e6'
                    : color === 'red'
                    ? '#fff1f0'
                    : '#f5f5f5',
                border: `1px solid ${
                  color === 'green'
                    ? '#b7eb8f'
                    : color === 'blue'
                    ? '#91d5ff'
                    : color === 'orange'
                    ? '#ffd591'
                    : color === 'red'
                    ? '#ffa39e'
                    : '#d9d9d9'
                }`,
                color:
                  color === 'green'
                    ? '#52c41a'
                    : color === 'blue'
                    ? '#1890ff'
                    : color === 'orange'
                    ? '#fa8c16'
                    : color === 'red'
                    ? '#f5222d'
                    : '#555',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {String(val).toUpperCase()}
            </span>
          );
        };
      } else if (renderStr === 'datetime' || renderStr === 'date') {
        customRender = (val: any) => {
          if (!val) return '—';
          return new Date(val).toLocaleString();
        };
      } else {
        customRender = undefined;
      }
    }
    return {
      title: col.title,
      dataIndex: col.dataIndex,
      key: col.key ?? col.dataIndex,
      sorter: col.sorter,
      width: col.width,
      fixed: col.fixed,
      ellipsis: col.ellipsis,
      render: customRender,
    };
  });

  const antRowSelection: AntTableProps<any>['rowSelection'] = rowSelection
    ? {
        type: 'checkbox',
        onChange: (selectedRowKeys: any[]) => {
          (window as any).formaiSelectedRowKeys = selectedRowKeys;
          window.dispatchEvent(new CustomEvent('formai-selection-change', { detail: selectedRowKeys }));
        },
      }
    : undefined;

  return (
    <AntTable
      columns={antColumns}
      dataSource={data}
      loading={loadingState}
      pagination={pagination}
      rowSelection={antRowSelection}
      bordered={bordered}
      size={size}
      rowKey={rowKey}
      scroll={scroll}
      onRow={onRow}
      onChange={onChange}
      style={style}
    />
  );
};

export default Table;

