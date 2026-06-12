import React from 'react';
import { Card, Statistic as AntdStatistic, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface StatisticProps {
  title?: React.ReactNode;
  value?: number | string;
  precision?: number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  trend?: 'up' | 'down' | 'none';
  trendValue?: string | number;
  colorBg?: string;
  gradientType?: 'cyan' | 'green' | 'orange' | 'blue' | 'none';
  style?: React.CSSProperties;
  className?: string;
}

const GRADIENTS = {
  cyan: 'linear-gradient(135deg, #13c2c2 0%, #722ed1 100%)',
  green: 'linear-gradient(135deg, #52c41a 0%, #13c2c2 100%)',
  orange: 'linear-gradient(135deg, #fa8c16 0%, #eb2f96 100%)',
  blue: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
  none: undefined,
};

export const Statistic: React.FC<StatisticProps> = ({
  title,
  value,
  precision,
  prefix,
  suffix,
  trend = 'none',
  trendValue,
  colorBg,
  gradientType = 'none',
  style,
  className,
}) => {
  const resolvedBg = gradientType !== 'none' ? GRADIENTS[gradientType] : colorBg;
  const isGradient = gradientType !== 'none';

  return (
    <Card
      style={{
        background: resolvedBg || 'var(--antd-color-bg-container, #ffffff)',
        borderRadius: 8,
        border: isGradient ? 'none' : '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
        overflow: 'hidden',
        color: isGradient ? '#ffffff' : undefined,
        ...style,
      }}
      className={className}
      bodyStyle={{ padding: '16px 20px' }}
    >
      <AntdStatistic
        title={
          <div style={{ color: isGradient ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.45)', fontSize: 13, marginBottom: 4 }}>
            {title}
          </div>
        }
        value={value}
        precision={precision}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{
          color: isGradient ? '#ffffff' : 'var(--antd-color-text-title, #262626)',
          fontSize: 28,
          fontWeight: 700,
        }}
      />
      {trend !== 'none' && trendValue && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          {trend === 'up' ? (
            <ArrowUpOutlined style={{ color: isGradient ? '#aff0b5' : '#3f8600' }} />
          ) : (
            <ArrowDownOutlined style={{ color: isGradient ? '#ffa39e' : '#cf1322' }} />
          )}
          <span
            style={{
              color: isGradient
                ? '#ffffff'
                : trend === 'up'
                ? '#3f8600'
                : '#cf1322',
              fontWeight: 600,
            }}
          >
            {trendValue}
          </span>
          <span style={{ color: isGradient ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)' }}>
            vs last month
          </span>
        </div>
      )}
    </Card>
  );
};

export default Statistic;
