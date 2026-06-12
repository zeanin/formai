import React, { useState, useEffect, useCallback } from 'react';
import { Calendar as AntdCalendar, Badge, Spin, Card } from 'antd';
import type { Dayjs } from 'dayjs';
import { useAPIClient } from '../../providers/APIClientProvider';

export interface CalendarProps {
  collection?: string;
  dateField?: string; // e.g. 'createdAt' or 'dueDate'
  titleField?: string; // field to show as title, e.g. 'name'
  style?: React.CSSProperties;
  className?: string;
}

export const Calendar: React.FC<CalendarProps> = ({
  collection,
  dateField = 'createdAt',
  titleField = 'name',
  style,
  className,
}) => {
  const apiClient = useAPIClient();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!collection || !apiClient) return;
    setLoading(true);
    try {
      const res = await apiClient.request({
        url: `/api/${collection}`,
        method: 'GET',
        params: {
          pageSize: 200,
        },
      });
      setEvents(res?.data ?? []);
    } catch (err) {
      console.error('[Calendar] Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [collection, apiClient]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const getListData = (value: Dayjs) => {
    if (!collection) return [];
    const formattedDate = value.format('YYYY-MM-DD');
    return events
      .filter((item) => {
        const d = item[dateField];
        if (!d) return false;
        // Compare date part only
        const itemDateStr = String(d).split('T')[0];
        return itemDateStr === formattedDate;
      })
      .map((item) => ({
        type: item.status === 'completed' || item.status === 'active' ? 'success' : 'processing',
        content: String(item[titleField] || item.name || item.title || `Event #${item.id}`),
      }));
  };

  const dateCellRender = (value: Dayjs) => {
    const listData = getListData(value);
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {listData.map((item, index) => (
          <li key={index}>
            <Badge status={item.type as any} text={item.content} style={{ fontSize: 10, display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Card style={style} className={className} bodyStyle={{ padding: 12 }}>
      <Spin spinning={loading}>
        <AntdCalendar cellRender={dateCellRender} />
      </Spin>
    </Card>
  );
};

export default Calendar;
