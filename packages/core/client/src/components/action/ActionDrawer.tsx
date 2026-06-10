import React, { useState } from 'react';
import { Button, Drawer } from 'antd';

export interface ActionDrawerProps {
  title?: string;
  triggerText?: string;
  triggerType?: 'primary' | 'default' | 'dashed' | 'link' | 'text';
  triggerIcon?: React.ReactNode;
  triggerDanger?: boolean;
  triggerDisabled?: boolean;
  drawerTitle?: string;
  width?: number | string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  closable?: boolean;
  maskClosable?: boolean;
  footer?: React.ReactNode;
  onClose?: () => void;
  onOpen?: () => void;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

export const ActionDrawer: React.FC<ActionDrawerProps> = ({
  title,
  triggerText,
  triggerType = 'default',
  triggerIcon,
  triggerDanger,
  triggerDisabled,
  drawerTitle,
  width = 520,
  placement = 'right',
  closable = true,
  maskClosable = true,
  footer,
  onClose,
  onOpen,
  style,
  className,
  children,
}) => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    onOpen?.();
  };

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <>
      <Button
        type={triggerType}
        icon={triggerIcon}
        danger={triggerDanger}
        disabled={triggerDisabled}
        onClick={handleOpen}
      >
        {triggerText ?? title}
      </Button>
      <Drawer
        title={drawerTitle ?? title}
        open={open}
        onClose={handleClose}
        width={width}
        placement={placement}
        closable={closable}
        maskClosable={maskClosable}
        footer={footer}
        style={style}
        className={className}
      >
        {children}
      </Drawer>
    </>
  );
};

export default ActionDrawer;
