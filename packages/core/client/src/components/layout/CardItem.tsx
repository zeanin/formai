import React from 'react';
import { Card } from 'antd';

export interface CardItemProps {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  children?: React.ReactNode;
  bordered?: boolean;
  hoverable?: boolean;
  loading?: boolean;
  size?: 'default' | 'small';
  style?: React.CSSProperties;
  className?: string;
  bodyStyle?: React.CSSProperties;
}

export const CardItem: React.FC<CardItemProps> = ({
  title,
  extra,
  children,
  bordered = true,
  hoverable = false,
  loading = false,
  size = 'default',
  style,
  className,
  bodyStyle,
}) => {
  return (
    <Card
      title={title}
      extra={extra}
      bordered={bordered}
      hoverable={hoverable}
      loading={loading}
      size={size}
      style={style}
      className={className}
      styles={{ body: bodyStyle }}
    >
      {children}
    </Card>
  );
};

export default CardItem;
