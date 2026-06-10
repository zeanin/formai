import type { ThemeConfig } from '../types';

/**
 * Service for applying themes and generating CSS custom properties.
 */
export class ThemeService {
  /**
   * Generate a CSS string of custom properties from a ThemeConfig.
   */
  generateCssVariables(config: ThemeConfig): string {
    const vars: string[] = [];

    // Color variables
    if (config.colors) {
      const c = config.colors;
      if (c.primary) vars.push(`  --color-primary: ${c.primary};`);
      if (c.primaryHover) vars.push(`  --color-primary-hover: ${c.primaryHover};`);
      if (c.primaryActive) vars.push(`  --color-primary-active: ${c.primaryActive};`);
      if (c.background) vars.push(`  --color-bg: ${c.background};`);
      if (c.surface) vars.push(`  --color-surface: ${c.surface};`);
      if (c.border) vars.push(`  --color-border: ${c.border};`);
      if (c.text) vars.push(`  --color-text: ${c.text};`);
      if (c.textSecondary) vars.push(`  --color-text-secondary: ${c.textSecondary};`);
      if (c.error) vars.push(`  --color-error: ${c.error};`);
      if (c.warning) vars.push(`  --color-warning: ${c.warning};`);
      if (c.success) vars.push(`  --color-success: ${c.success};`);
    }

    // Font variables
    if (config.fonts) {
      const f = config.fonts;
      if (f.family) vars.push(`  --font-family: ${f.family};`);
      if (f.sizeBase) vars.push(`  --font-size-base: ${f.sizeBase}px;`);
      if (f.sizeSmall) vars.push(`  --font-size-sm: ${f.sizeSmall}px;`);
      if (f.sizeLarge) vars.push(`  --font-size-lg: ${f.sizeLarge}px;`);
      if (f.lineHeight) vars.push(`  --line-height: ${f.lineHeight};`);
      if (f.fontWeightNormal) vars.push(`  --font-weight-normal: ${f.fontWeightNormal};`);
      if (f.fontWeightBold) vars.push(`  --font-weight-bold: ${f.fontWeightBold};`);
    }

    // Spacing variables
    if (config.spacing) {
      const s = config.spacing;
      if (s.xs !== undefined) vars.push(`  --spacing-xs: ${s.xs}px;`);
      if (s.sm !== undefined) vars.push(`  --spacing-sm: ${s.sm}px;`);
      if (s.md !== undefined) vars.push(`  --spacing-md: ${s.md}px;`);
      if (s.lg !== undefined) vars.push(`  --spacing-lg: ${s.lg}px;`);
      if (s.xl !== undefined) vars.push(`  --spacing-xl: ${s.xl}px;`);
    }

    // Border radius variables
    if (config.borderRadius) {
      const r = config.borderRadius;
      if (r.sm !== undefined) vars.push(`  --border-radius-sm: ${r.sm}px;`);
      if (r.md !== undefined) vars.push(`  --border-radius-md: ${r.md}px;`);
      if (r.lg !== undefined) vars.push(`  --border-radius-lg: ${r.lg}px;`);
      if (r.pill !== undefined) vars.push(`  --border-radius-pill: ${r.pill}px;`);
    }

    return `:root {\n${vars.join('\n')}\n}`;
  }

  /**
   * Deep merge two ThemeConfig objects.
   */
  mergeConfig(base: ThemeConfig, overrides: Partial<ThemeConfig>): ThemeConfig {
    return {
      colors: { ...base.colors, ...(overrides.colors || {}) },
      fonts: { ...base.fonts, ...(overrides.fonts || {}) },
      spacing: { ...base.spacing, ...(overrides.spacing || {}) },
      borderRadius: { ...base.borderRadius, ...(overrides.borderRadius || {}) },
    };
  }
}
