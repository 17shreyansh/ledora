import { Redis } from 'ioredis';
import { logger } from '../common/logger.js';

export function createRedis(url: string, name: string): Redis {
  const client = new Redis(url, {
    connectionName: `ledora:${name}`,
    // BullMQ requires this for blocking connections; harmless elsewhere.
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  client.on('error', (err) => logger.error({ err, connection: name }, 'Redis error'));
  return client;
}

export async function pingRedis(client: Redis): Promise<boolean> {
  try {
    return (await client.ping()) === 'PONG';
  } catch {
    return false;
  }
}
