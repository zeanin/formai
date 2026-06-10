import React from 'react';
import { Menu as AntMenu } from 'antd';
import type { MenuProps as AntMenuProps } from 'antd';

export interface MenuItemProps {
  key: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  children?: MenuItemProps[];
}

export interface MenuProps {
  items?: MenuItemProps[];
  mode?: 'vertical' | 'horizontal' | 'inline';
  theme?: 'light' | 'dark';
  defaultSelectedKeys?: string[];
  selectedKeys?: string[];
  defaultOpenKeys?: string[];
  openKeys?: string[];
  onSelect?: (info: { key: string; keyPath: string[] }) => void;
  onClick?: (info: { key: string; keyPath: string[] }) => void;
  onOpenChange?: (openKeys: string[]) => void;
  inlineCollapsed?: boolean;
  inlineIndent?: number;
  style?: React.CSSProperties;
  className?: string;
}

function transformItems(items: MenuItemProps[]): AntMenuProps['items'] {
  return items.map((item) => {
    if (item.children && item.children.length > 0) {
      return {
        key: item.key,
        label: item.label,
        icon: item.icon,
        disabled: item.disabled,
        danger: item.danger,
        children: transformItems(item.children),
      };
    }
    return {
      key: item.key,
      label: item.label,
      icon: item.icon,
      disabled: item.disabled,
      danger: item.danger,
    };
  });
}

export const Menu: React.FC<MenuProps> = ({
  items,
  mode = 'inline',
  theme = 'light',
  defaultSelectedKeys,
  selectedKeys,
  defaultOpenKeys,
  openKeys,
  onSelect,
  onClick,
  onOpenChange,
  inlineCollapsed,
  inlineIndent,
  style,
  className,
}) => {
  const antItems = items ? transformItems(items) : undefined;

  return (
    <AntMenu
      items={antItems}
      mode={mode}
      theme={theme}
      defaultSelectedKeys={defaultSelectedKeys}
      selectedKeys={selectedKeys}
      defaultOpenKeys={defaultOpenKeys}
      openKeys={openKeys}
      onSelect={onSelect}
      onClick={onClick}
      onOpenChange={onOpenChange}
      inlineCollapsed={inlineCollapsed}
      inlineIndent={inlineIndent}
      style={style}
      className={className}
    />
  );
};

export default Menu;
