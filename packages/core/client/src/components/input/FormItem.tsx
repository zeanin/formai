import React from 'react';
import { Form } from 'antd';
import type { Rule } from 'antd/es/form';

export interface FormItemProps {
  name?: string | string[];
  label?: string;
  required?: boolean;
  rules?: Rule[];
  tooltip?: string;
  extra?: React.ReactNode;
  help?: React.ReactNode;
  validateStatus?: '' | 'success' | 'warning' | 'error' | 'validating';
  hasFeedback?: boolean;
  labelCol?: { span?: number };
  wrapperCol?: { span?: number };
  noStyle?: boolean;
  hidden?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const FormItem: React.FC<FormItemProps> = ({
  name,
  label,
  required,
  rules,
  tooltip,
  extra,
  help,
  validateStatus,
  hasFeedback,
  labelCol,
  wrapperCol,
  noStyle,
  hidden,
  children,
  style,
  className,
}) => {
  const finalRules: Rule[] = [...(rules ?? [])];
  if (required) {
    finalRules.unshift({ required: true, message: `${label ?? 'Field'} is required` });
  }

  return (
    <Form.Item
      name={name}
      label={label}
      rules={finalRules.length > 0 ? finalRules : undefined}
      tooltip={tooltip}
      extra={extra}
      help={help}
      validateStatus={validateStatus}
      hasFeedback={hasFeedback}
      labelCol={labelCol}
      wrapperCol={wrapperCol}
      noStyle={noStyle}
      hidden={hidden}
      style={style}
      className={className}
    >
      {children}
    </Form.Item>
  );
};

export default FormItem;
