import React from 'react';
import { Checkbox as AntCheckbox, Typography } from 'antd';

export interface CheckboxOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface CheckboxProps {
  value?: boolean | string[] | number[];
  defaultValue?: boolean | string[] | number[];
  onChange?: (value: boolean | string[] | number[]) => void;
  checked?: boolean;
  label?: string;
  disabled?: boolean;
  readPretty?: boolean;
  options?: CheckboxOption[];
  style?: React.CSSProperties;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  value,
  defaultValue,
  onChange,
  checked,
  label,
  disabled,
  readPretty,
  options,
  style,
  className,
}) => {
  if (readPretty) {
    if (options) {
      const vals = (value ?? defaultValue ?? []) as string[];
      const labels = options
        .filter((o) => vals.includes(o.value as string))
        .map((o) => o.label)
        .join(', ');
      return <Typography.Text style={style}>{labels || '-'}</Typography.Text>;
    }
    const isChecked = typeof value === 'boolean' ? value : !!checked;
    return <Typography.Text style={style}>{isChecked ? 'Yes' : 'No'}</Typography.Text>;
  }

  if (options) {
    return (
      <AntCheckbox.Group
        value={value as string[] | undefined}
        defaultValue={defaultValue as string[] | undefined}
        onChange={(vals) => onChange?.(vals as string[])}
        options={options}
        disabled={disabled}
        style={style}
        className={className}
      />
    );
  }

  return (
    <AntCheckbox
      checked={typeof value === 'boolean' ? value : checked}
      defaultChecked={typeof defaultValue === 'boolean' ? defaultValue : undefined}
      onChange={(e) => onChange?.(e.target.checked)}
      disabled={disabled}
      style={style}
      className={className}
    >
      {label}
    </AntCheckbox>
  );
};

export default Checkbox;
