import React from 'react';
import { Typography } from 'antd';

export interface ActionLinkProps {
  title?: string;
  href?: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

export const ActionLink: React.FC<ActionLinkProps> = ({
  title,
  href,
  target,
  disabled,
  onClick,
  style,
  className,
  children,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    if (!href && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Typography.Link
      href={href}
      target={target}
      disabled={disabled}
      onClick={handleClick}
      style={style}
      className={className}
    >
      {title ?? children}
    </Typography.Link>
  );
};

export default ActionLink;
