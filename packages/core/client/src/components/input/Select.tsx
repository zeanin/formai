import React from 'react';
import { Select as AntSelect, Typography } from 'antd';

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string | number | string[] | number[];
  defaultValue?: string | number | string[] | number[];
  onChange?: (value: any, option: any) => void;
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  readPretty?: boolean;
  multiple?: boolean;
  allowClear?: boolean;
  showSearch?: boolean;
  loading?: boolean;
  size?: 'large' | 'middle' | 'small';
  style?: React.CSSProperties;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  value,
  defaultValue,
  onChange,
  options,
  placeholder,
  disabled,
  readPretty,
  multiple,
  allowClear,
  showSearch,
  loading,
  size,
  style,
  className,
}) => {
  if (readPretty) {
    const currentValue = value ?? defaultValue;
    const displayValues = Array.isArray(currentValue) ? currentValue : [currentValue];
    const labels = displayValues
      .map((v) => options?.find((o) => o.value === v)?.label ?? String(v))
      .join(', ');
    return <Typography.Text style={style}>{labels || '-'}</Typography.Text>;
  }

  return (
    <AntSelect
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      mode={multiple ? 'multiple' : undefined}
      allowClear={allowClear}
      showSearch={showSearch}
      loading={loading}
      size={size}
      style={{ width: '100%', ...style }}
      className={className}
    />
  );
};

export default Select;
