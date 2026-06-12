import React from 'react';
import { Steps as AntdSteps } from 'antd';

export interface StepItem {
  title: React.ReactNode;
  subTitle?: React.ReactNode;
  description?: React.ReactNode;
  status?: 'wait' | 'process' | 'finish' | 'error';
  disabled?: boolean;
}

export interface StepsProps {
  current?: number;
  direction?: 'horizontal' | 'vertical';
  size?: 'default' | 'small';
  status?: 'wait' | 'process' | 'finish' | 'error';
  items?: StepItem[];
  style?: React.CSSProperties;
  className?: string;
}

export const Steps: React.FC<StepsProps> = ({
  current = 0,
  direction = 'horizontal',
  size = 'default',
  status,
  items = [],
  style,
  className,
}) => {
  return (
    <AntdSteps
      current={current}
      direction={direction}
      size={size}
      status={status}
      items={items.map((item) => ({
        title: item.title,
        subTitle: item.subTitle,
        description: item.description,
        status: item.status,
        disabled: item.disabled,
      }))}
      style={style}
      className={className}
    />
  );
};

export default Steps;
