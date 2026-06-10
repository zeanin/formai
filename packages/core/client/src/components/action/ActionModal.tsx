import React, { useState } from 'react';
import { Button, Modal } from 'antd';

export interface ActionModalProps {
  title?: string;
  triggerText?: string;
  triggerType?: 'primary' | 'default' | 'dashed' | 'link' | 'text';
  triggerIcon?: React.ReactNode;
  triggerDanger?: boolean;
  triggerDisabled?: boolean;
  modalTitle?: string;
  width?: number | string;
  centered?: boolean;
  closable?: boolean;
  maskClosable?: boolean;
  footer?: React.ReactNode | null;
  okText?: string;
  cancelText?: string;
  onOk?: () => void | Promise<void>;
  onCancel?: () => void;
  onOpen?: () => void;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

export const ActionModal: React.FC<ActionModalProps> = ({
  title,
  triggerText,
  triggerType = 'default',
  triggerIcon,
  triggerDanger,
  triggerDisabled,
  modalTitle,
  width = 520,
  centered,
  closable = true,
  maskClosable = true,
  footer,
  okText = 'OK',
  cancelText = 'Cancel',
  onOk,
  onCancel,
  onOpen,
  style,
  className,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    onOpen?.();
  };

  const handleCancel = () => {
    setOpen(false);
    onCancel?.();
  };

  const handleOk = async () => {
    if (onOk) {
      setLoading(true);
      try {
        await onOk();
        setOpen(false);
      } finally {
        setLoading(false);
      }
    } else {
      setOpen(false);
    }
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
      <Modal
        title={modalTitle ?? title}
        open={open}
        onOk={handleOk}
        onCancel={handleCancel}
        confirmLoading={loading}
        width={width}
        centered={centered}
        closable={closable}
        maskClosable={maskClosable}
        footer={footer}
        okText={okText}
        cancelText={cancelText}
        style={style}
        className={className}
      >
        {children}
      </Modal>
    </>
  );
};

export default ActionModal;
