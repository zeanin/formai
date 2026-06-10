import React from 'react';
import { Tabs as AntTabs } from 'antd';
import type { TabsProps as AntTabsProps } from 'antd';

export interface TabItemProps {
  key: string;
  label: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  defaultActiveKey?: string;
  activeKey?: string;
  items?: TabItemProps[];
  onChange?: (key: string) => void;
  tabPosition?: 'top' | 'right' | 'bottom' | 'left';
  type?: 'line' | 'card' | 'editable-card';
  size?: 'large' | 'small' | 'middle';
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultActiveKey,
  activeKey,
  items,
  onChange,
  tabPosition = 'top',
  type = 'line',
  size = 'middle',
  style,
  children,
}) => {
  const tabItems: AntTabsProps['items'] = items?.map((item) => ({
    key: item.key,
    label: item.label,
    children: item.children,
    disabled: item.disabled,
  }));

  return (
    <AntTabs
      defaultActiveKey={defaultActiveKey}
      activeKey={activeKey}
      items={tabItems}
      onChange={onChange}
      tabPosition={tabPosition}
      type={type}
      size={size}
      style={style}
    >
      {!items && children}
    </AntTabs>
  );
};

export default Tabs;
