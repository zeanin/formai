import React from 'react';
import { Layout, Typography, Space } from 'antd';

const { Content } = Layout;
const { Title, Text } = Typography;

export interface PageProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  extra?: React.ReactNode;
}

export const Page: React.FC<PageProps> = ({ title, subtitle, children, style, extra }) => {
  return (
    <Layout style={{ minHeight: '100%', background: 'transparent', ...style }}>
      {(title || subtitle) && (
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #f0f0f0',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Space direction="vertical" size={0}>
            {title && (
              <Title level={4} style={{ margin: 0 }}>
                {title}
              </Title>
            )}
            {subtitle && <Text type="secondary">{subtitle}</Text>}
          </Space>
          {extra && <div>{extra}</div>}
        </div>
      )}
      <Content style={{ padding: 24 }}>{children}</Content>
    </Layout>
  );
};

export default Page;
