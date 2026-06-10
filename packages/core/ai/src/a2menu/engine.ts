import { z } from 'zod';
import type { LLMManager } from '../llm/manager';

export interface MenuItemSuggestion {
  title: string;
  type: 'page' | 'group' | 'link';
  path?: string;
  icon?: string;
  url?: string;
  children?: Omit<MenuItemSuggestion, 'children'>[];
}

export interface GeneratedMenus {
  menus: MenuItemSuggestion[];
}

const MenuItemSuggestionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    title: z.string().describe('Display name of the menu item'),
    type: z.enum(['page', 'group', 'link']),
    path: z.string().optional().describe('URL slug for pages, e.g. "orders", "customers"'),
    icon: z.string().optional().describe('An emoji icon, e.g. "📦", "👥"'),
    url: z.string().optional().describe('Full URL for external links, e.g. "https://..."'),
    children: z.array(
      z.object({
        title: z.string(),
        type: z.enum(['page', 'link']),
        path: z.string().optional(),
        icon: z.string().optional(),
        url: z.string().optional(),
      })
    ).optional().describe('Submenu items under a group'),
  })
);

const MenuDefinitionSchema = z.object({
  menus: z.array(MenuItemSuggestionSchema),
});

const SYSTEM_PROMPT = `You are an expert user interface and navigation designer for Formai.
Generate a recommended sidebar/navigation menu structure from natural language descriptions of the application or module.

Guidelines:
- Recommend 3 to 7 high-quality menu items that cover typical workflows (e.g. Dashboard, List, Settings).
- Use clear and professional names.
- Provide a corresponding emoji icon for each menu item.
- Provide a path slug for pages (e.g. "listings", "orders").
- Keep group nodes simple and put pages/links inside them if needed.`;

export class A2MenuEngine {
  constructor(private llm: LLMManager) {}

  async generateMenus(prompt: string): Promise<GeneratedMenus> {
    const userPrompt = `Generate a recommended navigation menu structure for the following app/module description:\n\n"${prompt}"\n\nRespond with ONLY the JSON object.`;

    const result = await this.llm.generate(MenuDefinitionSchema, userPrompt, {
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.3,
    });

    return result as GeneratedMenus;
  }
}
