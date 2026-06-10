import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler } from '../middleware/error-handler';
import { actionParams } from '../middleware/action-params';
import { dataWrapping } from '../middleware/data-wrapping';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(overrides: any = {}): any {
  const emitMock = vi.fn();
  return {
    status: 200,
    body: undefined,
    method: 'GET',
    query: {},
    request: { body: undefined },
    action: { resourceName: '', actionName: '', params: {} },
    app: { emit: emitMock },
    ...overrides,
  };
}

// ─── errorHandler middleware ─────────────────────────────────────────────────

describe('errorHandler', () => {
  it('calls next() when no error is thrown', async () => {
    const ctx = makeCtx();
    const next = vi.fn().mockResolvedValue(undefined);
    await errorHandler(ctx, next);
    expect(next).toHaveBeenCalled();
    expect(ctx.body).toBeUndefined();
  });

  it('catches thrown errors and sets status/body', async () => {
    const ctx = makeCtx();
    const err = new Error('Something went wrong');
    const next = vi.fn().mockRejectedValue(err);

    await errorHandler(ctx, next);

    expect(ctx.status).toBe(500);
    expect(ctx.body.errors[0].message).toBe('Something went wrong');
    expect(ctx.body.errors[0].code).toBe('INTERNAL_ERROR');
  });

  it('uses err.status when available', async () => {
    const ctx = makeCtx();
    const err: any = new Error('Not found');
    err.status = 404;
    const next = vi.fn().mockRejectedValue(err);

    await errorHandler(ctx, next);

    expect(ctx.status).toBe(404);
  });

  it('uses err.statusCode as fallback', async () => {
    const ctx = makeCtx();
    const err: any = new Error('Forbidden');
    err.statusCode = 403;
    const next = vi.fn().mockRejectedValue(err);

    await errorHandler(ctx, next);

    expect(ctx.status).toBe(403);
  });

  it('uses err.code in response body', async () => {
    const ctx = makeCtx();
    const err: any = new Error('Bad request');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    const next = vi.fn().mockRejectedValue(err);

    await errorHandler(ctx, next);

    expect(ctx.body.errors[0].code).toBe('VALIDATION_ERROR');
  });

  it('emits error event on ctx.app', async () => {
    const ctx = makeCtx();
    const err = new Error('Oops');
    const next = vi.fn().mockRejectedValue(err);

    await errorHandler(ctx, next);

    expect(ctx.app.emit).toHaveBeenCalledWith('error', err, ctx);
  });
});

// ─── actionParams middleware ──────────────────────────────────────────────────

describe('actionParams', () => {
  const next = vi.fn(async () => {});
  beforeEach(() => next.mockClear());

  it('parses page and pageSize from query', async () => {
    const ctx = makeCtx({ query: { page: '2', pageSize: '15' } });
    await actionParams(ctx, next);
    expect(ctx.action.params.page).toBe(2);
    expect(ctx.action.params.pageSize).toBe(15);
  });

  it('parses filter JSON string from query', async () => {
    const filter = { name: 'Alice' };
    const ctx = makeCtx({ query: { filter: JSON.stringify(filter) } });
    await actionParams(ctx, next);
    expect(ctx.action.params.filter).toEqual(filter);
  });

  it('parses comma-separated fields into array', async () => {
    const ctx = makeCtx({ query: { fields: 'id,name,email' } });
    await actionParams(ctx, next);
    expect(ctx.action.params.fields).toEqual(['id', 'name', 'email']);
  });

  it('parses comma-separated sort', async () => {
    const ctx = makeCtx({ query: { sort: '-createdAt,name' } });
    await actionParams(ctx, next);
    expect(ctx.action.params.sort).toEqual(['-createdAt', 'name']);
  });

  it('merges body values for POST requests', async () => {
    const ctx = makeCtx({
      method: 'POST',
      request: { body: { values: { title: 'Hello' } } },
    });
    await actionParams(ctx, next);
    expect(ctx.action.params.values).toEqual({ title: 'Hello' });
  });

  it('wraps entire body as values when no explicit values key', async () => {
    const ctx = makeCtx({
      method: 'POST',
      request: { body: { title: 'Hello', count: 1 } },
    });
    await actionParams(ctx, next);
    expect(ctx.action.params.values).toEqual({ title: 'Hello', count: 1 });
  });

  it('does not merge body for GET requests', async () => {
    const ctx = makeCtx({
      method: 'GET',
      request: { body: { values: { title: 'Ignored' } } },
    });
    await actionParams(ctx, next);
    expect(ctx.action.params.values).toBeUndefined();
  });

  it('calls next()', async () => {
    const ctx = makeCtx();
    await actionParams(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it('initialises ctx.action if missing', async () => {
    const ctx = makeCtx();
    delete ctx.action;
    await actionParams(ctx, next);
    expect(ctx.action).toBeDefined();
    expect(ctx.action.params).toBeDefined();
  });
});

// ─── dataWrapping middleware ──────────────────────────────────────────────────

describe('dataWrapping', () => {
  const next = vi.fn(async () => {});
  beforeEach(() => next.mockClear());

  it('wraps plain object body in { data }', async () => {
    const ctx = makeCtx({ body: { id: 1, name: 'Alice' } });
    await dataWrapping(ctx, next);
    expect(ctx.body).toEqual({ data: { id: 1, name: 'Alice' } });
  });

  it('wraps array body in { data }', async () => {
    const ctx = makeCtx({ body: [1, 2, 3] });
    await dataWrapping(ctx, next);
    expect(ctx.body).toEqual({ data: [1, 2, 3] });
  });

  it('does not re-wrap body that already has a data key', async () => {
    const wrapped = { data: [1, 2, 3], meta: { count: 3 } };
    const ctx = makeCtx({ body: wrapped });
    await dataWrapping(ctx, next);
    expect(ctx.body).toBe(wrapped);
  });

  it('does not re-wrap body that already has an errors key', async () => {
    const errBody = { errors: [{ message: 'Bad' }] };
    const ctx = makeCtx({ body: errBody });
    await dataWrapping(ctx, next);
    expect(ctx.body).toBe(errBody);
  });

  it('does nothing when body is undefined', async () => {
    const ctx = makeCtx({ body: undefined });
    await dataWrapping(ctx, next);
    expect(ctx.body).toBeUndefined();
  });

  it('does nothing when body is null', async () => {
    const ctx = makeCtx({ body: null });
    await dataWrapping(ctx, next);
    expect(ctx.body).toBeNull();
  });

  it('calls next()', async () => {
    const ctx = makeCtx({ body: { x: 1 } });
    await dataWrapping(ctx, next);
    expect(next).toHaveBeenCalled();
  });
});
