import { Database } from '@formai/database';

// Extend Koa context with application-specific types
declare module 'koa' {
  interface DefaultState {
    currentUser?: any;
    currentRole?: string;
  }
  interface DefaultContext {
    db: Database;
    action: {
      resourceName: string;
      actionName: string;
      params: Record<string, any>;
    };
  }
}
