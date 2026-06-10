import type { BaseTrigger, TriggerConfig } from './base';

/**
 * Schedule trigger — fires on a cron-like interval.
 *
 * config:
 *   cron:      string   — expression like "0 * * * *" (minute-level granularity)
 *                         or a plain interval string like "5m", "1h", "30s"
 *   timezone?: string   — IANA timezone (informational only; not currently applied)
 *
 * The implementation uses a simple polling approach with setInterval, so cron
 * patterns are approximated to their interval equivalent.  For production use
 * replace this with a proper cron library.
 */
export class ScheduleTrigger implements BaseTrigger {
  readonly type = 'schedule';

  private timers = new Map<string, ReturnType<typeof setInterval>>();

  register(
    workflowId: string,
    config: TriggerConfig,
    fire: (context: Record<string, any>) => Promise<void>,
  ): void {
    const { cron } = config as { cron: string; timezone?: string };
    if (!cron) return;

    const intervalMs = parseCron(cron);
    if (intervalMs <= 0) return;

    const timer = setInterval(async () => {
      await fire({ scheduledAt: new Date().toISOString(), cron });
    }, intervalMs);

    this.timers.set(workflowId, timer);
  }

  unregister(workflowId: string): void {
    const timer = this.timers.get(workflowId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(workflowId);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Very lightweight cron/interval parser.
 * Supports:
 *   - shorthand: "30s", "5m", "2h", "1d"
 *   - simplified cron (only the minute field is inspected): e.g. every-5-min notation
 */
function parseCron(cron: string): number {
  const trimmed = cron.trim();

  // Shorthand
  const shortMatch = trimmed.match(/^(\d+)(s|m|h|d)$/i);
  if (shortMatch) {
    const n = parseInt(shortMatch[1], 10);
    switch (shortMatch[2].toLowerCase()) {
      case 's': return n * 1_000;
      case 'm': return n * 60_000;
      case 'h': return n * 3_600_000;
      case 'd': return n * 86_400_000;
    }
  }

  // 5-field cron — extract the minutes field
  const parts = trimmed.split(/\s+/);
  if (parts.length === 5) {
    const minuteField = parts[0];
    // */N → every N minutes
    const stepMatch = minuteField.match(/^\*\/(\d+)$/);
    if (stepMatch) return parseInt(stepMatch[1], 10) * 60_000;
    // single number → every X minutes from start of hour (approximate)
    const n = parseInt(minuteField, 10);
    if (!isNaN(n)) return n * 60_000;
  }

  // Default: every minute
  return 60_000;
}
