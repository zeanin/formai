import type { Context, Next } from 'koa';
import { ACL } from './acl';

function mergeFilters(existing: any, additional: any): any {
  if (!existing) return additional;
  if (!additional) return existing;
  return { $and: [existing, additional] };
}

export function aclMiddleware(acl: ACL) {
  return async (ctx: Context & { state: any; action: any }, next: Next) => {
    const { resourceName, actionName } = ctx.action || {};

    // Skip if no action context (non-resource routes)
    if (!resourceName || !actionName) {
      await next();
      return;
    }

    const roleName = ctx.state.currentRole;

    // If no role, check if action is publicly allowed
    if (!roleName) {
      if (!acl.checkCondition('public', ctx)) {
        ctx.status = 401;
        ctx.body = { errors: [{ message: 'Authentication required', code: 'UNAUTHORIZED' }] };
        return;
      }
      await next();
      return;
    }

    const permission = acl.can(roleName, resourceName, actionName);

    if (permission === false) {
      ctx.status = 403;
      ctx.body = { errors: [{ message: 'Access denied', code: 'FORBIDDEN' }] };
      return;
    }

    // Apply fixed params (field filtering, data scope)
    if (permission && typeof permission === 'object') {
      if (!ctx.action.params) {
        ctx.action.params = {};
      }

      if (permission.filter) {
        // Merge filter into action params
        ctx.action.params.filter = mergeFilters(ctx.action.params.filter, permission.filter);
      }
      if (permission.own && ctx.state.currentUser) {
        // Add createdById filter
        const ownFilter = { createdById: ctx.state.currentUser.id };
        ctx.action.params.filter = mergeFilters(ctx.action.params.filter, ownFilter);
      }
      if (permission.fields) {
        ctx.action.params.fields = permission.fields;
      }
      if (permission.whitelist) {
        ctx.action.params.whitelist = permission.whitelist;
      }
      if (permission.blacklist) {
        ctx.action.params.blacklist = permission.blacklist;
      }
    }

    await next();
  };
}
