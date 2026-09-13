import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';

let interval = null;

export function startPrintroveSyncScheduler() {
  if (!env.printrove.email || !env.printrove.password) {
    logger.warn('[PRINTROVE] Scheduler not started — credentials missing');
    return;
  }
  // Poll every 30 minutes
  const period = 30 * 60 * 1000;
  if (interval) clearInterval(interval);

  const tick = async () => {
    try {
      const { syncAllPending } = await import('./sync.js');
      logger.info('[PRINTROVE] Scheduler tick — syncing pending orders');
      const results = await syncAllPending({ limit: 20 });
      if (results.length) logger.info(`[PRINTROVE] Sync tick done: ${results.length} orders`);
    } catch (e) {
      logger.error('[PRINTROVE] Scheduler tick failed', e.message);
    }
  };

  // First tick after 2 minutes
  setTimeout(tick, 2 * 60 * 1000);
  interval = setInterval(tick, period);
  // Prevent blocking exit
  if (interval.unref) interval.unref();
  logger.info('[PRINTROVE] Sync scheduler started (30m interval)');
}

export function stopPrintroveScheduler() {
  if (interval) clearInterval(interval);
}
