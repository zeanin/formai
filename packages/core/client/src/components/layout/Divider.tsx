import React from 'react';
import { Divider as AntDivider } from 'antd';

export interface DividerProps {
  children?: React.ReactNode;
  dashed?: boolean;
  orientation?: 'left' | 'right' | 'center';
  plain?: boolean;
  type?: 'horizontal' | 'vertical';
  style?: React.CSSProperties;
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({
  children,
  dashed = false,
  orientation = 'center',
  plain = false,
  type = 'horizontal',
  style,
  className,
}) => {
  return (
    <AntDivider
      dashed={dashed}
      orientation={orientation}
      plain={plain}
      type={type}
      style={style}
      className={className}
    >
      {children}
    </AntDivider>
  );
};

export default Divider;
