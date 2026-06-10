export interface ColorConfig {
  primary: string;
  primaryHover?: string;
  primaryActive?: string;
  background: string;
  surface: string;
  border: string;
  text: string;
  textSecondary?: string;
  error?: string;
  warning?: string;
  success?: string;
}

export interface FontConfig {
  family: string;
  sizeBase: number;
  sizeSmall?: number;
  sizeLarge?: number;
  lineHeight?: number;
  fontWeightNormal?: number;
  fontWeightBold?: number;
}

export interface SpacingConfig {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface BorderRadiusConfig {
  sm: number;
  md: number;
  lg: number;
  pill?: number;
}

export interface ThemeConfig {
  colors: ColorConfig;
  fonts: FontConfig;
  spacing: SpacingConfig;
  borderRadius: BorderRadiusConfig;
}

export type ThemePreset = 'light' | 'dark' | 'compact';

// Built-in preset configurations
export const THEME_PRESETS: Record<ThemePreset, ThemeConfig> = {
  light: {
    colors: {
      primary: '#1677ff',
      primaryHover: '#4096ff',
      primaryActive: '#0958d9',
      background: '#f5f5f5',
      surface: '#ffffff',
      border: '#d9d9d9',
      text: '#000000d9',
      textSecondary: '#00000073',
      error: '#ff4d4f',
      warning: '#faad14',
      success: '#52c41a',
    },
    fonts: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', sizeBase: 14, sizeSmall: 12, sizeLarge: 16, lineHeight: 1.5714285714285714 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 4, md: 6, lg: 8, pill: 100 },
  },
  dark: {
    colors: {
      primary: '#1668dc',
      primaryHover: '#3c89e8',
      primaryActive: '#1554ad',
      background: '#141414',
      surface: '#1f1f1f',
      border: '#424242',
      text: '#ffffffd9',
      textSecondary: '#ffffff73',
      error: '#dc4446',
      warning: '#d89614',
      success: '#49aa19',
    },
    fonts: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', sizeBase: 14, sizeSmall: 12, sizeLarge: 16, lineHeight: 1.5714285714285714 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 4, md: 6, lg: 8, pill: 100 },
  },
  compact: {
    colors: {
      primary: '#1677ff',
      background: '#f5f5f5',
      surface: '#ffffff',
      border: '#d9d9d9',
      text: '#000000d9',
      error: '#ff4d4f',
      warning: '#faad14',
      success: '#52c41a',
    },
    fonts: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', sizeBase: 12, sizeSmall: 10, sizeLarge: 14, lineHeight: 1.42857142857143 },
    spacing: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16 },
    borderRadius: { sm: 2, md: 4, lg: 6, pill: 100 },
  },
};
