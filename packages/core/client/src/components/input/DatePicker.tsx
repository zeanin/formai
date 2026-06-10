import React from 'react';
import { DatePicker as AntDatePicker, Typography } from 'antd';
import type { Dayjs } from 'dayjs';

const { RangePicker } = AntDatePicker;

export interface DatePickerProps {
  value?: Dayjs | null;
  defaultValue?: Dayjs | null;
  onChange?: (date: Dayjs | null, dateString: string | string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  readPretty?: boolean;
  format?: string;
  showTime?: boolean;
  picker?: 'date' | 'week' | 'month' | 'quarter' | 'year';
  range?: boolean;
  allowClear?: boolean;
  size?: 'large' | 'middle' | 'small';
  style?: React.CSSProperties;
  className?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  defaultValue,
  onChange,
  placeholder,
  disabled,
  readPretty,
  format,
  showTime,
  picker = 'date',
  range,
  allowClear,
  size,
  style,
  className,
}) => {
  if (readPretty) {
    const displayFormat = format ?? (showTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD');
    const displayValue = value ? value.format(displayFormat) : '-';
    return <Typography.Text style={style}>{displayValue}</Typography.Text>;
  }

  if (range) {
    return (
      <RangePicker
        disabled={disabled}
        format={format}
        showTime={showTime}
        allowClear={allowClear}
        size={size}
        style={{ width: '100%', ...style }}
        className={className}
      />
    );
  }

  return (
    <AntDatePicker
      value={value}
      defaultValue={defaultValue ?? undefined}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      format={format}
      showTime={showTime}
      picker={picker}
      allowClear={allowClear}
      size={size}
      style={{ width: '100%', ...style }}
      className={className}
    />
  );
};

export default DatePicker;
