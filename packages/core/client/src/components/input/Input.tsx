import React from 'react';
import { Input as AntInput, Typography } from 'antd';

const { TextArea } = AntInput;
const { Text } = Typography;

export interface InputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  readPretty?: boolean;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  showCount?: boolean;
  size?: 'large' | 'middle' | 'small';
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  allowClear?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const Input: React.FC<InputProps> = ({
  value,
  defaultValue,
  onChange,
  placeholder,
  disabled,
  readOnly,
  readPretty,
  multiline,
  rows = 3,
  maxLength,
  showCount,
  size,
  prefix,
  suffix,
  allowClear,
  style,
  className,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange?.(e.target.value);
  };

  if (readPretty) {
    return <Text style={style}>{value ?? defaultValue ?? '-'}</Text>;
  }

  if (multiline) {
    return (
      <TextArea
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        rows={rows}
        maxLength={maxLength}
        showCount={showCount}
        style={style}
        className={className}
      />
    );
  }

  return (
    <AntInput
      value={value}
      defaultValue={defaultValue}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      maxLength={maxLength}
      showCount={showCount}
      size={size}
      prefix={prefix}
      suffix={suffix}
      allowClear={allowClear}
      style={style}
      className={className}
    />
  );
};

export default Input;
