import mongoose from 'mongoose';
import { logger } from '../common/logger.js';

// NoSQL-injection posture: every request input is parsed by a Zod schema into primitive
// types before it reaches a query, and Express 5's "simple" query parser never yields nested
// objects. Global `sanitizeFilter` is deliberately NOT enabled because it also rewrites the
// server's own `$in`/`$ne` operators. See docs/SECURITY.md.
mongoose.set('strictQuery', true);

export async function connectDatabase(uri: string, opts: { autoIndex: boolean }): Promise<typeof mongoose> {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
  await mongoose.connect(uri, {
    autoIndex: opts.autoIndex,
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 50,
  });
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export async function pingDatabase(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return false;
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}
