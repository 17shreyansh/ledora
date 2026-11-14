import type { Server } from 'node:http';
import { createLogger, logger, setLogger } from './common/logger.js';
import { loadConfig } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { createRedis } from './database/redis.js';
import { createEmailQueue } from './queues/queues.js';
import { createApp } from './app.js';
import { QueueMailDispatcher } from './services/mail/dispatcher.js';
import { seedDefaultPlans } from './modules/entitlements/plan.model.js';

async function main() {
  const config = loadConfig();
  setLogger(createLogger(config.LOG_LEVEL, !config.isProduction && process.stdout.isTTY));

  // Indexes are built at boot outside production; in production they are created
  // by the deploy step (see docs/DEPLOYMENT.md) so large builds never block startup.
  await connectDatabase(config.MONGODB_URI, { autoIndex: !config.isProduction });
  if (!config.isProduction) await seedDefaultPlans();
  const redis = createRedis(config.REDIS_URL, 'api');
  const emailQueue = createEmailQueue(createRedis(config.REDIS_URL, 'queue-email'));
  const { app } = createApp({ config, redis, mail: new QueueMailDispatcher(emailQueue) });

  const server: Server = app.listen(config.PORT, () => logger.info({ port: config.PORT }, 'Ledora API listening'));
  server.keepAliveTimeout = 65_000; // longer than typical proxy idle timeouts

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    const force = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15_000);
    force.unref();
    server.close();
    await Promise.allSettled([emailQueue.close(), redis.quit(), disconnectDatabase()]);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start API');
  process.exit(1);
});
