/**
 * Creates every declared index. Run during deploys before new code takes traffic:
 *   npm run db:indexes -w @ledora/server
 * Uses createIndexes (additive). It never drops indexes; removing an index is a
 * deliberate, reviewed migration.
 */
import mongoose from 'mongoose';
import { createLogger, setLogger, logger } from '../common/logger.js';
import { loadConfig } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import '../database/models.js';
import { seedDefaultPlans } from '../modules/entitlements/plan.model.js';

async function main() {
  const config = loadConfig();
  setLogger(createLogger(config.LOG_LEVEL));
  await connectDatabase(config.MONGODB_URI, { autoIndex: false });
  for (const model of Object.values(mongoose.models)) {
    await model.createCollection().catch((err: { codeName?: string }) => {
      if (err.codeName !== 'NamespaceExists') throw err;
    });
    await model.createIndexes();
    logger.info({ collection: model.collection.collectionName }, 'Indexes ensured');
  }
  await seedDefaultPlans();
  logger.info('Default plans ensured (existing plans untouched)');
  await disconnectDatabase();
}

main().catch((err) => {
  logger.fatal({ err }, 'Index creation failed');
  process.exit(1);
});
