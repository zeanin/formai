import React from 'react';
import { Timeline as AntdTimeline } from 'antd';

export interface TimelineItem {
  label?: React.ReactNode;
  children: React.ReactNode;
  color?: string;
  dot?: React.ReactNode;
}

export interface TimelineProps {
  items?: TimelineItem[];
  mode?: 'left' | 'alternate' | 'right';
  pending?: React.ReactNode;
  reverse?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({
  items = [],
  mode = 'left',
  pending,
  reverse = false,
  style,
  className,
}) => {
  return (
    <AntdTimeline
      mode={mode}
      pending={pending}
      reverse={reverse}
      style={style}
      className={className}
      items={items.map((item) => ({
        label: item.label,
        children: item.children,
        color: item.color,
        dot: item.dot,
      }))}
    />
  );
};

export default Timeline;
