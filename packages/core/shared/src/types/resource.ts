export type ActionName = 'list' | 'get' | 'create' | 'update' | 'destroy' | string;

export interface ActionParams {
  filter?: any;
  fields?: string[];
  appends?: string[];
  except?: string[];
  sort?: string[];
  page?: number;
  pageSize?: number;
  values?: Record<string, any>;
  filterByTk?: any;
  [key: string]: any;
}

export interface ActionContext {
  resourceName: string;
  actionName: ActionName;
  params: ActionParams;
  body?: any;
}

export interface ResourceOptions {
  name: string;
  actions?: Record<string, ActionHandler | ActionOptions>;
  middlewares?: any[];
  only?: ActionName[];
  except?: ActionName[];
}

export type ActionHandler = (ctx: any, next: () => Promise<void>) => Promise<void>;

export interface ActionOptions {
  handler: ActionHandler;
  middlewares?: any[];
}
