import { Plugin } from '@formai/plugin';
import { chartsCollection } from './collections/charts';
import * as chartActions from './actions/charts';
import * as queryActions from './actions/query';

export default class DataVisualizationPlugin extends Plugin {
  async load(): Promise<void> {
    this.defineCollection(chartsCollection);

    this.registerResource({
      name: 'charts',
      actions: {
        list: chartActions.list,
        get: chartActions.get,
        create: chartActions.create,
        update: chartActions.update,
        destroy: chartActions.destroy,
        data: queryActions.data,
        query: queryActions.query,
      },
    });
  }

  async install(): Promise<void> {
    // No seed data required
  }
}
