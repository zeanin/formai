import React, { useState, useEffect } from 'react';
import { Select, Typography, Tag, Space } from 'antd';
import { useAPIClient } from '../../providers/APIClientProvider';

export interface AssociationFieldOption {
  label: string;
  value: string | number;
  record?: Record<string, any>;
}

export interface AssociationFieldProps {
  value?: string | number | string[] | number[];
  defaultValue?: string | number | string[] | number[];
  onChange?: (value: any, records: any) => void;
  collection?: string;
  targetField?: string;
  labelField?: string;
  valueField?: string;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  readPretty?: boolean;
  options?: AssociationFieldOption[];
  style?: React.CSSProperties;
  className?: string;
}

export const AssociationField: React.FC<AssociationFieldProps> = ({
  value,
  defaultValue,
  onChange,
  collection,
  labelField = 'name',
  valueField = 'id',
  multiple,
  placeholder,
  disabled,
  readPretty,
  options: externalOptions,
  style,
  className,
}) => {
  const apiClient = useAPIClient();
  const [options, setOptions] = useState<AssociationFieldOption[]>(externalOptions ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (externalOptions) {
      setOptions(externalOptions);
      return;
    }
    if (collection && apiClient) {
      setLoading(true);
      apiClient
        .request<{ data: any[] }>({
          url: `/api/${collection}`,
          method: 'GET',
          params: { pageSize: 100 },
        })
        .then((res) => {
          const records = res?.data ?? [];
          setOptions(
            records.map((record: any) => ({
              label: record[labelField],
              value: record[valueField],
              record,
            })),
          );
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [collection, apiClient, labelField, valueField, externalOptions]);

  if (readPretty) {
    const currentValues = value ?? defaultValue;
    const vals = Array.isArray(currentValues) ? currentValues : [currentValues];
    const labels = vals
      .map((v) => options.find((o) => o.value === v)?.label ?? String(v))
      .filter(Boolean);

    return (
      <Space size={4} wrap style={style}>
        {labels.length > 0
          ? labels.map((label) => <Tag key={label}>{label}</Tag>)
          : <Typography.Text>-</Typography.Text>}
      </Space>
    );
  }

  return (
    <Select
      value={value}
      defaultValue={defaultValue}
      onChange={(val, opt) => onChange?.(val, opt)}
      options={options}
      loading={loading}
      mode={multiple ? 'multiple' : undefined}
      placeholder={placeholder}
      disabled={disabled}
      showSearch
      filterOption={(input, option) =>
        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
      }
      allowClear
      style={{ width: '100%', ...style }}
      className={className}
    />
  );
};

export default AssociationField;
