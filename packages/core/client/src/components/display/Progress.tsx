import React from 'react';
import { Progress as AntdProgress } from 'antd';

export interface ProgressProps {
  percent?: number;
  type?: 'line' | 'circle' | 'dashboard';
  status?: 'success' | 'exception' | 'normal' | 'active';
  strokeColor?: string;
  strokeWidth?: number;
  size?: 'default' | 'small' | number | [number, number];
  style?: React.CSSProperties;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  percent = 0,
  type = 'line',
  status,
  strokeColor,
  strokeWidth,
  size = 'default',
  style,
  className,
}) => {
  return (
    <AntdProgress
      percent={percent}
      type={type}
      status={status}
      strokeColor={strokeColor}
      strokeWidth={strokeWidth}
      size={size}
      style={style}
      className={className}
    />
  );
};

export default Progress;
