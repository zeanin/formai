import React from 'react';
import { Badge, Tag } from 'antd';

export type StatusPreset = 'active' | 'inactive' | 'pending' | 'cancelled' | 'completed' | 'draft' | 'error';

export interface StatusBadgeProps {
  value?: string;
  preset?: StatusPreset;
  /** Custom map from value → { color, label } */
  optionMap?: Record<string, { color: string; label?: string }>;
  /** Render as a dot+text Badge instead of a colored Tag */
  dot?: boolean;
  style?: React.CSSProperties;
}

const PRESET_MAP: Record<StatusPreset, { color: string; label: string }> = {
  active:    { color: 'success',   label: 'Active' },
  inactive:  { color: 'default',   label: 'Inactive' },
  pending:   { color: 'processing', label: 'Pending' },
  cancelled: { color: 'error',     label: 'Cancelled' },
  completed: { color: 'success',   label: 'Completed' },
  draft:     { color: 'warning',   label: 'Draft' },
  error:     { color: 'error',     label: 'Error' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  value,
  preset,
  optionMap,
  dot = false,
  style,
}) => {
  if (value == null && preset == null) return <span style={style}>-</span>;

  // Resolve config: optionMap > preset > value-as-preset
  let color = 'default';
  let label = value ?? preset ?? '';

  if (optionMap && value && optionMap[value]) {
    color = optionMap[value].color;
    label = optionMap[value].label ?? label;
  } else if (preset && PRESET_MAP[preset]) {
    color = PRESET_MAP[preset].color;
    label = PRESET_MAP[preset].label;
  } else if (value && PRESET_MAP[value as StatusPreset]) {
    const p = PRESET_MAP[value as StatusPreset];
    color = p.color;
    label = p.label;
  }

  if (dot) {
    const dotStatus = color as 'success' | 'processing' | 'error' | 'default' | 'warning';
    return <Badge status={dotStatus} text={label} style={style} />;
  }

  return <Tag color={color} style={style}>{label}</Tag>;
};

export default StatusBadge;
