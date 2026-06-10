import React from 'react';
import { Row, Col } from 'antd';

export interface GridProps {
  children?: React.ReactNode;
  cols?: number;
  gap?: number;
  style?: React.CSSProperties;
}

export interface GridRowProps {
  children?: React.ReactNode;
  gutter?: number | [number, number];
  style?: React.CSSProperties;
}

export interface GridColProps {
  span?: number;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const GridRow: React.FC<GridRowProps> = ({ children, gutter = 16, style }) => {
  return (
    <Row gutter={gutter} style={style}>
      {children}
    </Row>
  );
};

const GridCol: React.FC<GridColProps> = ({ span = 12, xs, sm, md, lg, xl, children, style }) => {
  return (
    <Col span={span} xs={xs} sm={sm} md={md} lg={lg} xl={xl} style={style}>
      {children}
    </Col>
  );
};

type GridComponent = React.FC<GridProps> & {
  Row: React.FC<GridRowProps>;
  Col: React.FC<GridColProps>;
};

const GridBase: React.FC<GridProps> = ({ children, cols = 2, gap = 16, style }) => {
  const colSpan = Math.floor(24 / cols);
  return (
    <Row gutter={gap} style={style}>
      {React.Children.map(children, (child) => {
        if (!child || !React.isValidElement(child)) return child;

        const childProps = child.props as any;
        const schema = childProps?.schema;
        const componentName = schema?.['x-component'] || childProps?.['x-component'];

        const isColumn =
          componentName === 'Grid.Col' ||
          componentName === 'Grid.Column' ||
          child.type === GridCol ||
          (typeof child.type === 'object' && (child.type as any)?.name === 'GridCol');

        if (isColumn) {
          return child;
        }

        return <Col span={colSpan}>{child}</Col>;
      })}
    </Row>
  );
};

export const Grid = GridBase as GridComponent;
Grid.Row = GridRow;
Grid.Col = GridCol;

export default Grid;
