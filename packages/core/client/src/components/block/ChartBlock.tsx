import React, { useState, useEffect } from 'react';
import { Card, Spin, Empty, Typography, Space, theme } from 'antd';
import { useAPIClient } from '../../providers/APIClientProvider';

export interface ChartBlockProps {
  collection?: string;
  chartType?: 'bar' | 'line' | 'pie' | 'donut';
  xField?: string;
  yField?: string;
  title?: string;
  style?: React.CSSProperties;
  className?: string;
}

export const ChartBlock: React.FC<ChartBlockProps> = ({
  collection,
  chartType = 'bar',
  xField = 'name',
  yField = 'amount',
  title,
  style,
  className,
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterState, setFilterState] = useState<any>({});
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const apiClient = useAPIClient();
  const { token } = theme.useToken();

  // Dynamic theme colors
  const gridColor = token.colorBorderSecondary;
  const axisColor = token.colorBorder;
  const labelColor = token.colorTextDescription;

  useEffect(() => {
    const handleFilterChange = (e: Event) => {
      const { collection: eventCollection, filter } = (e as CustomEvent).detail || {};
      if (eventCollection === collection) {
        setFilterState(filter || {});
      }
    };
    window.addEventListener('formai-filter-change', handleFilterChange);
    return () => window.removeEventListener('formai-filter-change', handleFilterChange);
  }, [collection]);

  useEffect(() => {
    if (collection && apiClient) {
      setLoading(true);
      apiClient
        .request({
          url: `/api/${collection}`,
          method: 'GET',
          params: {
            pageSize: 200,
            filter: filterState,
          },
        })
        .then((res) => {
          const rawData = res?.data || [];
          // Aggregate data based on xField and yField
          const aggregatedMap: Record<string, number> = {};
          rawData.forEach((item: any) => {
            const key = String(item[xField] ?? 'Unknown');
            const val = parseFloat(item[yField]) || 0;
            aggregatedMap[key] = (aggregatedMap[key] || 0) + val;
          });

          const formattedData = Object.entries(aggregatedMap).map(([name, value]) => ({
            name,
            value: Math.round(value * 100) / 100,
          }));
          setData(formattedData);
        })
        .catch((err) => {
          console.error('[ChartBlock] Failed to fetch chart data:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [collection, apiClient, filterState, xField, yField]);

  if (loading) {
    return (
      <Card title={title || `${collection?.toUpperCase()} Analytics`} style={style} className={className}>
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" tip="Loading chart data..." />
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card title={title || `${collection?.toUpperCase()} Analytics`} style={style} className={className}>
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="No chart data available" />
        </div>
      </Card>
    );
  }

  // Visual parameters
  const colors = [
    '#1677ff', '#52c41a', '#faad14', '#13c2c2', '#722ed1', 
    '#f5222d', '#2f54eb', '#fa8c16', '#eb2f96', '#fa541c'
  ];

  const maxVal = Math.max(...data.map(d => d.value), 1);

  // SVG dimensions
  const width = 500;
  const height = 240;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const renderBarChart = () => {
    const barCount = data.length;
    const spacing = 12;
    const barWidth = (chartWidth - spacing * (barCount - 1)) / barCount;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        {/* Gradients */}
        <defs>
          {data.map((_, i) => (
            <linearGradient id={`bar-grad-${i}`} key={i} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[i % colors.length]} />
              <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity={0.6} />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = paddingTop + chartHeight * (1 - ratio);
          const valLabel = Math.round(maxVal * ratio);
          return (
            <g key={i}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke={gridColor} strokeDasharray="4 4" />
              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill={labelColor}>{valLabel}</text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = paddingLeft + i * (barWidth + spacing);
          const barHeight = (d.value / maxVal) * chartHeight;
          const y = height - paddingBottom - barHeight;

          return (
            <g
              key={i}
              onMouseEnter={(e) => {
                setHoveredIndex(i);
                setTooltipPos({ x: x + barWidth / 2, y: y - 10 });
              }}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={`url(#bar-grad-${i})`}
                rx="4"
                ry="4"
                style={{
                  transition: 'all 0.2s',
                  transformOrigin: `${x + barWidth / 2}px ${height - paddingBottom}px`,
                  transform: hoveredIndex === i ? 'scaleY(1.03)' : 'scaleY(1)',
                }}
              />
              <text
                x={x + barWidth / 2}
                y={height - paddingBottom + 16}
                textAnchor="middle"
                fontSize="9"
                fill={labelColor}
                style={{
                  fontWeight: hoveredIndex === i ? 'bold' : 'normal',
                }}
              >
                {d.name.length > 8 ? `${d.name.substring(0, 6)}...` : d.name}
              </text>
            </g>
          );
        })}

        {/* X and Y axes */}
        <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke={axisColor} />
        <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} stroke={axisColor} />
      </svg>
    );
  };

  const renderLineChart = () => {
    const points = data.map((d, i) => {
      const x = paddingLeft + (i / (data.length - 1 || 1)) * chartWidth;
      const y = height - paddingBottom - (d.value / maxVal) * chartHeight;
      return { x, y, val: d.value, label: d.name };
    });

    // Make smooth curved line (Bezier Spline)
    let pathD = '';
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const dx = (p1.x - p0.x) / 2;
        pathD += ` C ${p0.x + dx} ${p0.y}, ${p1.x - dx} ${p1.y}, ${p1.x} ${p1.y}`;
      }
    }

    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = paddingTop + chartHeight * (1 - ratio);
          const valLabel = Math.round(maxVal * ratio);
          return (
            <g key={i}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke={gridColor} strokeDasharray="4 4" />
              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill={labelColor}>{valLabel}</text>
            </g>
          );
        })}

        {/* Path line */}
        <path d={pathD} fill="none" stroke="#1677ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Area under the path */}
        {points.length > 0 && (
          <path
            d={`${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`}
            fill="url(#area-grad)"
          />
        )}

        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1677ff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#1677ff" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Points and labels */}
        {points.map((p, i) => (
          <g
            key={i}
            onMouseEnter={() => {
              setHoveredIndex(i);
              setTooltipPos({ x: p.x, y: p.y - 10 });
            }}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 6 : 4}
              fill={token.colorBgContainer}
              stroke="#1677ff"
              strokeWidth="2"
              style={{ transition: 'all 0.1s' }}
            />
            <text x={p.x} y={height - paddingBottom + 16} textAnchor="middle" fontSize="9" fill={labelColor}>
              {p.label.length > 8 ? `${p.label.substring(0, 6)}...` : p.label}
            </text>
          </g>
        ))}

        {/* Axes */}
        <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke={axisColor} />
        <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} stroke={axisColor} />
      </svg>
    );
  };

  const renderPieChart = () => {
    const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
    const cx = width / 2 - 40;
    const cy = height / 2;
    const r = 80;

    let accumulatedAngle = 0;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        {data.map((d, i) => {
          const percentage = d.value / total;
          const angle = percentage * 360;

          // Compute coordinates
          const x1 = cx + r * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
          const y1 = cy + r * Math.sin((accumulatedAngle - 90) * Math.PI / 180);
          
          accumulatedAngle += angle;

          const x2 = cx + r * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
          const y2 = cy + r * Math.sin((accumulatedAngle - 90) * Math.PI / 180);

          const largeArcFlag = angle > 180 ? 1 : 0;
          const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

          // Hover pop effect coordinates
          const midAngle = accumulatedAngle - angle / 2 - 90;
          const popX = 8 * Math.cos(midAngle * Math.PI / 180);
          const popY = 8 * Math.sin(midAngle * Math.PI / 180);

          return (
            <g
              key={i}
              onMouseEnter={() => {
                setHoveredIndex(i);
                setTooltipPos({ x: cx + popX, y: cy + popY });
              }}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                cursor: 'pointer',
                transform: hoveredIndex === i ? `translate(${popX}px, ${popY}px)` : 'none',
                transition: 'all 0.2s',
              }}
            >
              <path d={pathD} fill={colors[i % colors.length]} stroke={token.colorBgContainer} strokeWidth="2" />
            </g>
          );
        })}

        {/* If donut mode, overlay a circle in the center */}
        {(chartType === 'donut' || chartType === 'pie') && chartType === 'donut' && (
          <>
            <circle cx={cx} cy={cy} r={r * 0.65} fill={token.colorBgContainer} />
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize="10" fill={token.colorTextDescription}>Total</text>
            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="14" fontWeight="bold" fill={token.colorText}>{total.toLocaleString()}</text>
          </>
        )}

        {/* Legends on the right side */}
        <g transform={`translate(${cx + r + 30}, 30)`}>
          {data.slice(0, 8).map((d, i) => {
            const percentage = Math.round((d.value / total) * 100);
            return (
              <g key={i} transform={`translate(0, ${i * 20})`}>
                <rect width="12" height="12" fill={colors[i % colors.length]} rx="2" />
                <text x="18" y="10" fontSize="10" fill={token.colorText} style={{ fontWeight: hoveredIndex === i ? 'bold' : 'normal' }}>
                  {d.name.length > 12 ? `${d.name.substring(0, 10)}...` : d.name} ({percentage}%)
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    );
  };

  return (
    <Card
      title={title || `${collection?.toUpperCase()} Analytics`}
      style={{
        borderRadius: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
        position: 'relative',
        overflow: 'visible',
        ...style
      }}
      className={className}
    >
      <div style={{ position: 'relative', height: 240, overflow: 'visible' }}>
        {chartType === 'bar' && renderBarChart()}
        {chartType === 'line' && renderLineChart()}
        {(chartType === 'pie' || chartType === 'donut') && renderPieChart()}

        {/* Hover Tooltip */}
        {hoveredIndex !== null && (
          <div
            style={{
              position: 'absolute',
              left: chartType === 'pie' || chartType === 'donut' ? (width / 2 - 40 + (hoveredIndex * 2)) : tooltipPos.x,
              top: chartType === 'pie' || chartType === 'donut' ? (height / 2 - 20) : tooltipPos.y,
              transform: 'translate(-50%, -100%)',
              background: token.colorBgElevated,
              border: `1px solid ${token.colorBorderSecondary}`,
              color: token.colorText,
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 100,
              pointerEvents: 'none',
              transition: 'all 0.1s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Typography.Text style={{ color: token.colorText, fontWeight: 'bold', display: 'block' }}>
              {data[hoveredIndex].name}
            </Typography.Text>
            <Typography.Text style={{ color: token.colorPrimary, display: 'block' }}>
              {yField.toUpperCase()}: {data[hoveredIndex].value.toLocaleString()}
            </Typography.Text>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ChartBlock;
