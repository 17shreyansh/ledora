import mongoose, { type ClientSession } from 'mongoose';

/**
 * Runs `fn` in a MongoDB transaction with the driver's automatic retry of transient
 * errors (write conflicts, primary step-downs). `fn` may run more than once and must
 * therefore be free of side effects outside the session (no emails, no queue jobs).
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
