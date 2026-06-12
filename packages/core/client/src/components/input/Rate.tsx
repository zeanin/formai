import React from 'react';
import { Rate as AntdRate } from 'antd';

export interface RateProps {
  value?: number;
  count?: number;
  allowHalf?: boolean;
  disabled?: boolean;
  onChange?: (value: number) => void;
  style?: React.CSSProperties;
  className?: string;
}

export const Rate: React.FC<RateProps> = ({
  value = 0,
  count = 5,
  allowHalf = false,
  disabled = false,
  onChange,
  style,
  className,
}) => {
  return (
    <AntdRate
      value={value}
      count={count}
      allowHalf={allowHalf}
      disabled={disabled}
      onChange={onChange}
      style={style}
      className={className}
    />
  );
};

export default Rate;
