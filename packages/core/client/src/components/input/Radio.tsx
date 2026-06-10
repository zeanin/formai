import React from 'react';
import { Radio as AntRadio, Typography } from 'antd';

export interface RadioOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface RadioProps {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (value: string | number) => void;
  options?: RadioOption[];
  disabled?: boolean;
  readPretty?: boolean;
  direction?: 'horizontal' | 'vertical';
  buttonStyle?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const Radio: React.FC<RadioProps> = ({
  value,
  defaultValue,
  onChange,
  options,
  disabled,
  readPretty,
  direction = 'horizontal',
  buttonStyle,
  style,
  className,
}) => {
  if (readPretty) {
    const label = options?.find((o) => o.value === (value ?? defaultValue))?.label ?? String(value ?? defaultValue ?? '-');
    return <Typography.Text style={style}>{label}</Typography.Text>;
  }

  const handleChange = (e: any) => {
    onChange?.(e.target.value);
  };

  if (buttonStyle) {
    return (
      <AntRadio.Group
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        disabled={disabled}
        style={style}
        className={className}
      >
        {options?.map((opt) => (
          <AntRadio.Button key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </AntRadio.Button>
        ))}
      </AntRadio.Group>
    );
  }

  return (
    <AntRadio.Group
      value={value}
      defaultValue={defaultValue}
      onChange={handleChange}
      disabled={disabled}
      style={{
        display: 'flex',
        flexDirection: direction === 'vertical' ? 'column' : 'row',
        gap: '8px',
        ...style,
      }}
      className={className}
    >
      {options?.map((opt) => (
        <AntRadio key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </AntRadio>
      ))}
    </AntRadio.Group>
  );
};

export default Radio;
