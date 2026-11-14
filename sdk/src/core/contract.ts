/**
 * The only bridge to the shared ingestion contract. Imported by relative path so that
 * esbuild bundles just this dependency-free file (never zod or @ledora/shared's index).
 */
export { INGEST_LIMITS, INGEST_SCHEMA_VERSION, SITE_KEY_PATTERN } from '../../../packages/shared/src/ingest-contract';
export type {
  IngestBatch,
  IngestEvent,
  IngestResponse,
  PropValue,
  PublicSiteConfig,
} from '../../../packages/shared/src/ingest-contract';
