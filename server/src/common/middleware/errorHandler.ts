import type { ApiErrorBody } from '@ledora/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger.js';
import { AppError } from '../errors/AppError.js';
import { validationError } from '../validation.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(AppError.notFound('Route not found'));
};

function normalize(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return validationError(err);
  const e = err as { type?: string; status?: number; statusCode?: number };
  // Errors raised by express.json() / body parsing.
  if (e?.type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  if (e?.type === 'entity.parse.failed') return AppError.badRequest('Request body is not valid JSON');
  if (e?.type === 'encoding.unsupported' || e?.type === 'charset.unsupported') return AppError.badRequest('Unsupported encoding');
  return null;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const known = normalize(err);
  if (!known) {
    logger.error({ err, method: req.method, path: req.path }, 'Unhandled error');
  } else if (known.status >= 500) {
    logger.error({ err, code: known.code }, known.message);
  }
  const appErr = known ?? new AppError(500, 'INTERNAL', 'Something went wrong on our side. Please try again.');
  const body: ApiErrorBody = {
    error: {
      code: appErr.code,
      message: appErr.message,
      ...(appErr.fields ? { fields: appErr.fields } : {}),
      requestId: req.requestId,
    },
  };
  if (res.headersSent) return;
  res.status(appErr.status).json(body);
};
