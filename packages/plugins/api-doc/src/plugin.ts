import { Plugin } from '@formai/plugin';
import { specAction } from './actions/spec';
import { uiAction } from './actions/ui';

export default class ApiDocPlugin extends Plugin {
  async load(): Promise<void> {
    // Register the doc resource for spec and UI endpoints
    this.registerResource({
      name: 'doc',
      actions: {
        spec: specAction,
        ui: uiAction,
      },
    });
  }

  async install(): Promise<void> {
    // No setup required
  }
}
