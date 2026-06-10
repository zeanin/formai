export interface PluginOptions {
  name: string;
  version?: string;
  displayName?: string;
  description?: string;
  dependencies?: string[];
  enabled?: boolean;
}

export type PluginStatus = 'pending' | 'loaded' | 'installed' | 'enabled' | 'disabled' | 'error';
