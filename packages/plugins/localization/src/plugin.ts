import { Plugin } from '@formai/plugin';
import { translationsCollection } from './collections/translations';
import * as translationActions from './actions/translations';

export default class LocalizationPlugin extends Plugin {
  async load(): Promise<void> {
    // Register the translations collection
    this.defineCollection(translationsCollection);

    // Register resource actions
    this.registerResource({
      name: 'translations',
      actions: {
        list: translationActions.list,
        getByLocale: translationActions.getByLocale,
        bulkImport: translationActions.bulkImport,
        export: translationActions.exportTranslations,
      },
    });
  }

  async install(): Promise<void> {
    const repo = this.db.getRepository('translations');

    // Seed default English translations
    const defaultTranslations = [
      { locale: 'en-US', namespace: 'common', key: 'appName', value: 'Formai' },
      { locale: 'en-US', namespace: 'common', key: 'welcome', value: 'Welcome' },
      { locale: 'en-US', namespace: 'common', key: 'login', value: 'Login' },
      { locale: 'en-US', namespace: 'common', key: 'logout', value: 'Logout' },
      { locale: 'en-US', namespace: 'common', key: 'register', value: 'Register' },
      { locale: 'en-US', namespace: 'common', key: 'save', value: 'Save' },
      { locale: 'en-US', namespace: 'common', key: 'cancel', value: 'Cancel' },
      { locale: 'en-US', namespace: 'common', key: 'delete', value: 'Delete' },
      { locale: 'en-US', namespace: 'common', key: 'edit', value: 'Edit' },
      { locale: 'en-US', namespace: 'common', key: 'create', value: 'Create' },
      { locale: 'en-US', namespace: 'common', key: 'search', value: 'Search' },
      { locale: 'en-US', namespace: 'common', key: 'noData', value: 'No data' },
      { locale: 'en-US', namespace: 'common', key: 'confirm', value: 'Confirm' },
      { locale: 'en-US', namespace: 'common', key: 'loading', value: 'Loading...' },
      { locale: 'en-US', namespace: 'common', key: 'error', value: 'Error' },
      { locale: 'en-US', namespace: 'common', key: 'success', value: 'Success' },
      { locale: 'en-US', namespace: 'menu', key: 'dashboard', value: 'Dashboard' },
      { locale: 'en-US', namespace: 'menu', key: 'settings', value: 'Settings' },
      { locale: 'en-US', namespace: 'menu', key: 'users', value: 'Users' },
      { locale: 'en-US', namespace: 'menu', key: 'collections', value: 'Collections' },
    ];

    for (const entry of defaultTranslations) {
      const existing = await repo.findOne({
        filter: { locale: entry.locale, namespace: entry.namespace, key: entry.key },
      });
      if (!existing) {
        await repo.create({ values: entry });
      }
    }
  }
}
