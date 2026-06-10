import React from 'react';
import { Switch as AntSwitch, Typography } from 'antd';

export interface SwitchProps {
  value?: boolean;
  defaultValue?: boolean;
  onChange?: (checked: boolean) => void;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  readPretty?: boolean;
  checkedChildren?: React.ReactNode;
  unCheckedChildren?: React.ReactNode;
  size?: 'default' | 'small';
  loading?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  value,
  defaultValue,
  onChange,
  checked,
  defaultChecked,
  disabled,
  readPretty,
  checkedChildren,
  unCheckedChildren,
  size = 'default',
  loading,
  style,
  className,
}) => {
  const isChecked = value ?? checked;
  const isDefaultChecked = defaultValue ?? defaultChecked;

  if (readPretty) {
    return (
      <Typography.Text style={style}>
        {isChecked ? (checkedChildren ?? 'Yes') : (unCheckedChildren ?? 'No')}
      </Typography.Text>
    );
  }

  return (
    <AntSwitch
      checked={isChecked}
      defaultChecked={isDefaultChecked}
      onChange={onChange}
      disabled={disabled}
      checkedChildren={checkedChildren}
      unCheckedChildren={unCheckedChildren}
      size={size}
      loading={loading}
      style={style}
      className={className}
    />
  );
};

export default Switch;
