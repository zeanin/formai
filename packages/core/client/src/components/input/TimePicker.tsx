import React from 'react';
import { TimePicker as AntTimePicker, Typography } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

export interface TimePickerProps {
  value?: string | Dayjs | null;
  defaultValue?: string | Dayjs | null;
  onChange?: (time: Dayjs | null, timeString: string | string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  readPretty?: boolean;
  format?: string;
  allowClear?: boolean;
  size?: 'large' | 'middle' | 'small';
  use12Hours?: boolean;
  hourStep?: number;
  minuteStep?: number;
  secondStep?: number;
  style?: React.CSSProperties;
  className?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  defaultValue,
  onChange,
  placeholder,
  disabled,
  readPretty,
  format = 'HH:mm:ss',
  allowClear = true,
  size,
  use12Hours = false,
  hourStep,
  minuteStep,
  secondStep,
  style,
  className,
}) => {
  // Parse string value into dayjs object if needed
  const parseVal = (val: string | Dayjs | null | undefined): Dayjs | null => {
    if (!val) return null;
    if (dayjs.isDayjs(val)) return val;
    return dayjs(val, format);
  };

  const dayjsValue = parseVal(value);
  const dayjsDefaultValue = parseVal(defaultValue);

  const handleChange = (time: Dayjs | null, timeString: string | string[]) => {
    onChange?.(time, timeString);
  };

  if (readPretty) {
    const displayValue = dayjsValue ? dayjsValue.format(format) : '-';
    return <Typography.Text style={style}>{displayValue}</Typography.Text>;
  }

  return (
    <AntTimePicker
      value={dayjsValue}
      defaultValue={dayjsDefaultValue ?? undefined}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      format={format}
      allowClear={allowClear}
      size={size}
      use12Hours={use12Hours}
      hourStep={hourStep as any}
      minuteStep={minuteStep as any}
      secondStep={secondStep as any}
      style={{ width: '100%', ...style }}
      className={className}
    />
  );
};

export default TimePicker;
