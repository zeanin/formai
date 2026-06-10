import { ActionHandler, ActionOptions, ResourceOptions } from '@formai/shared';

export class Resource {
  name: string;
  private actions: Map<string, ActionHandler> = new Map();
  private middlewares: any[] = [];

  constructor(options: ResourceOptions) {
    this.name = options.name;
    this.middlewares = options.middlewares ?? [];

    if (options.actions) {
      for (const [actionName, actionDef] of Object.entries(options.actions)) {
        if (typeof actionDef === 'function') {
          this.actions.set(actionName, actionDef as ActionHandler);
        } else {
          this.actions.set(actionName, (actionDef as ActionOptions).handler);
        }
      }
    }
  }

  getAction(name: string): ActionHandler | undefined {
    return this.actions.get(name);
  }

  setAction(name: string, handler: ActionHandler): void {
    this.actions.set(name, handler);
  }

  getMiddlewares(): any[] {
    return this.middlewares;
  }
}
