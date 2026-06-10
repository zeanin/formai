import { Plugin } from '@formai/plugin';
import { themesCollection } from './collections/themes';
import * as themeActions from './actions/themes';
import { THEME_PRESETS } from './types';

export default class ThemeEditorPlugin extends Plugin {
  async load(): Promise<void> {
    this.defineCollection(themesCollection);

    this.registerResource({
      name: 'themes',
      actions: {
        list: themeActions.list,
        get: themeActions.get,
        create: themeActions.create,
        update: themeActions.update,
        destroy: themeActions.destroy,
        setDefault: themeActions.setDefault,
        css: themeActions.getCss,
      },
    });
  }

  async install(): Promise<void> {
    const repo = this.db.getRepository('themes');

    // Seed built-in presets
    for (const [preset, config] of Object.entries(THEME_PRESETS)) {
      const existing = await repo.findOne({ filter: { name: preset } });
      if (!existing) {
        await repo.create({
          values: {
            name: preset,
            config,
            isDefault: preset === 'light',
          },
        });
      }
    }
  }
}
