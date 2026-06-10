import React, { useState, useEffect } from 'react';
import { Button, Modal, Table, Input, Space, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useAPIClient } from '../../providers/APIClientProvider';

export interface RecordPickerColumn {
  title: string;
  dataIndex: string;
  key?: string;
  width?: number;
}

export interface RecordPickerProps {
  value?: any | any[];
  defaultValue?: any | any[];
  onChange?: (value: any | any[]) => void;
  collection?: string;
  columns?: RecordPickerColumn[];
  labelField?: string;
  valueField?: string;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  readPretty?: boolean;
  triggerText?: string;
  modalTitle?: string;
  modalWidth?: number | string;
  style?: React.CSSProperties;
  className?: string;
}

export const RecordPicker: React.FC<RecordPickerProps> = ({
  value,
  defaultValue,
  onChange,
  collection,
  columns,
  labelField = 'name',
  valueField = 'id',
  multiple,
  placeholder = 'Select records...',
  disabled,
  readPretty,
  triggerText = 'Select',
  modalTitle = 'Select Records',
  modalWidth = 800,
  style,
  className,
}) => {
  const apiClient = useAPIClient();
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);

  const currentValue = value ?? defaultValue;
  const selectedValues = Array.isArray(currentValue)
    ? currentValue
    : currentValue != null
    ? [currentValue]
    : [];

  useEffect(() => {
    if (open && collection && apiClient) {
      setLoading(true);
      apiClient
        .request<{ data: any[] }>({
          url: `/api/${collection}`,
          method: 'GET',
          params: { pageSize: 100 },
        })
        .then((res) => setRecords(res?.data ?? []))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, collection, apiClient]);

  const filteredRecords = records.filter((r) =>
    searchText
      ? String(r[labelField] ?? '').toLowerCase().includes(searchText.toLowerCase())
      : true,
  );

  const handleOk = () => {
    const selected = records.filter((r) => selectedKeys.includes(r[valueField]));
    if (multiple) {
      onChange?.(selected);
    } else {
      onChange?.(selected[0] ?? null);
    }
    setOpen(false);
    setSelectedKeys([]);
  };

  const handleCancel = () => {
    setOpen(false);
    setSelectedKeys([]);
  };

  const tableColumns = columns ?? [
    {
      title: 'Name',
      dataIndex: labelField,
      key: labelField,
    },
  ];

  const displayValue = (() => {
    if (selectedValues.length === 0) return null;
    if (typeof selectedValues[0] === 'object') {
      return selectedValues.map((r: any) => r[labelField]).join(', ');
    }
    return selectedValues.join(', ');
  })();

  if (readPretty) {
    return <Typography.Text style={style}>{displayValue ?? '-'}</Typography.Text>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }} className={className}>
      <Typography.Text type="secondary" style={{ flex: 1 }}>
        {displayValue ?? <span style={{ color: '#bfbfbf' }}>{placeholder}</span>}
      </Typography.Text>
      <Button size="small" disabled={disabled} onClick={() => setOpen(true)}>
        {triggerText}
      </Button>
      <Modal
        title={modalTitle}
        open={open}
        onOk={handleOk}
        onCancel={handleCancel}
        width={modalWidth}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Table
            loading={loading}
            dataSource={filteredRecords}
            columns={tableColumns}
            rowKey={valueField}
            size="small"
            rowSelection={{
              type: multiple ? 'checkbox' : 'radio',
              selectedRowKeys: selectedKeys,
              onChange: setSelectedKeys,
            }}
            pagination={{ pageSize: 10 }}
          />
        </Space>
      </Modal>
    </div>
  );
};

export default RecordPicker;
