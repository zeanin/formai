import type { NodeHandler, WorkflowNode, JobResult } from './base';
import type { ExecutionContext } from '../engine/context';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * HTTP Request node — calls an external API.
 *
 * config:
 *   url:       string
 *   method?:   HttpMethod (default: GET)
 *   headers?:  Record<string, string>
 *   body?:     any
 *   timeout?:  number (ms, default: 30_000)
 */
export class HttpRequestNode implements NodeHandler {
  readonly type = 'http-request';

  async execute(node: WorkflowNode, _context: ExecutionContext): Promise<JobResult> {
    const {
      url,
      method = 'GET',
      headers = {},
      body,
      timeout = 30_000,
    } = node.config ?? {};

    if (!url) {
      return { status: 'rejected', result: { error: 'url is required' } };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const fetchOptions: RequestInit = {
        method: (method as HttpMethod).toUpperCase(),
        headers: { 'Content-Type': 'application/json', ...headers },
        signal: controller.signal,
      };

      if (body && method !== 'GET') {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        responseHeaders[k] = v;
      });

      let data: any;
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        status: response.ok ? 'resolved' : 'rejected',
        result: { status: response.status, data, headers: responseHeaders },
      };
    } catch (err: any) {
      return { status: 'rejected', result: { error: err.message } };
    } finally {
      clearTimeout(timer);
    }
  }
}
