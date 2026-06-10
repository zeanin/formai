import React from 'react';
import { ColorPicker as AntColorPicker, Typography, Space } from 'antd';
import type { ColorPickerProps as AntColorPickerProps } from 'antd';

export interface ColorPickerProps extends Omit<AntColorPickerProps, 'onChange'> {
  value?: string;
  onChange?: (color: string) => void;
  disabled?: boolean;
  readPretty?: boolean;
  style?: React.CSSProperties;
  className?: string;
  allowClear?: boolean;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  disabled = false,
  readPretty = false,
  style,
  className,
  allowClear = true,
  ...rest
}) => {
  const colorValue = value || '#1677ff';

  const handleChange = (color: any) => {
    // Return Hex representation
    onChange?.(color.toHexString());
  };

  if (readPretty) {
    return (
      <Space align="center" style={style} className={className}>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            backgroundColor: colorValue,
            border: '1px solid #d9d9d9',
            boxShadow: '0 2px 0 rgba(0,0,0,0.02)',
          }}
        />
        <Typography.Text code>{colorValue}</Typography.Text>
      </Space>
    );
  }

  return (
    <AntColorPicker
      value={colorValue}
      onChange={handleChange}
      disabled={disabled}
      allowClear={allowClear}
      style={style}
      className={className}
      presets={[
        {
          label: 'Recommended',
          colors: [
            '#1677ff',
            '#52c41a',
            '#faad14',
            '#f5222d',
            '#722ed1',
            '#13c2c2',
            '#2f54eb',
            '#fa8c16',
            '#eb2f96',
            '#fa541c',
          ],
        },
      ]}
      {...rest}
    />
  );
};

export default ColorPicker;
