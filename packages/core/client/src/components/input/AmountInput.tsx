import React from 'react';
import { InputNumber, Select, Space, Typography } from 'antd';

const { Text } = Typography;

export interface AmountInputProps {
  value?: number;
  onChange?: (value: number | null) => void;
  currency?: string;
  onCurrencyChange?: (currency: string) => void;
  precision?: number;
  min?: number;
  disabled?: boolean;
  readPretty?: boolean;
  style?: React.CSSProperties;
}

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'CNY', label: 'CNY' },
  { value: 'JPY', label: 'JPY' },
];

const SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
  JPY: '¥',
};

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  currency = 'USD',
  onCurrencyChange,
  precision = 2,
  min = 0,
  disabled = false,
  readPretty = false,
  style,
}) => {
  if (readPretty) {
    const symbol = SYMBOLS[currency] ?? currency;
    const formatted = value != null
      ? `${symbol}${Number(value).toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })}`
      : '-';
    return <Text strong style={style}>{formatted}</Text>;
  }

  return (
    <Space.Compact style={style}>
      {onCurrencyChange && (
        <Select
          value={currency}
          onChange={onCurrencyChange}
          options={CURRENCIES}
          style={{ width: 80 }}
          disabled={disabled}
        />
      )}
      <InputNumber
        value={value}
        onChange={onChange}
        precision={precision}
        min={min}
        disabled={disabled}
        prefix={!onCurrencyChange ? SYMBOLS[currency] : undefined}
        style={{ flex: 1, minWidth: 120 }}
        formatter={(v) =>
          v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
        }
        parser={(v) => parseFloat(v?.replace(/,/g, '') ?? '0') as any}
      />
    </Space.Compact>
  );
};

export default AmountInput;
