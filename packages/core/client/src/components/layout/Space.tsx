import React from 'react';
import { Space as AntSpace } from 'antd';

export interface SpaceProps {
  children?: React.ReactNode;
  direction?: 'horizontal' | 'vertical';
  size?: 'small' | 'middle' | 'large' | number;
  wrap?: boolean;
  align?: 'start' | 'end' | 'center' | 'baseline';
  style?: React.CSSProperties;
  className?: string;
}

export const Space: React.FC<SpaceProps> = ({
  children,
  direction = 'horizontal',
  size = 'small',
  wrap,
  align,
  style,
  className,
}) => {
  return (
    <AntSpace
      direction={direction}
      size={size}
      wrap={wrap}
      align={align}
      style={style}
      className={className}
    >
      {children}
    </AntSpace>
  );
};

export default Space;
