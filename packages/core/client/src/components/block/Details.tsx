import React from 'react';
import { Descriptions, Typography } from 'antd';

export interface DetailsFieldProps {
  label: string;
  dataIndex: string;
  render?: (value: any, record: Record<string, any>) => React.ReactNode;
  span?: number;
}

export interface DetailsProps {
  dataSource?: Record<string, any>;
  fields?: DetailsFieldProps[];
  title?: React.ReactNode;
  bordered?: boolean;
  column?: number;
  size?: 'default' | 'middle' | 'small';
  layout?: 'horizontal' | 'vertical';
  colon?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const Details: React.FC<DetailsProps> = ({
  dataSource = {},
  fields,
  title,
  bordered = true,
  column = 2,
  size = 'default',
  layout = 'horizontal',
  colon = true,
  style,
  children,
}) => {
  const items = fields?.map((field) => {
    const value = dataSource[field.dataIndex];
    return {
      key: field.dataIndex,
      label: field.label,
      children: field.render ? field.render(value, dataSource) : (
        <Typography.Text>{value !== undefined && value !== null ? String(value) : '-'}</Typography.Text>
      ),
      span: field.span,
    };
  });

  return (
    <Descriptions
      title={title}
      bordered={bordered}
      column={column}
      size={size}
      layout={layout}
      colon={colon}
      items={items}
      style={style}
    >
      {!fields && children}
    </Descriptions>
  );
};

export default Details;
