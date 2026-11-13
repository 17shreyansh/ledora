import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { requestStore } from '../logger.js';

const INBOUND_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Assigns each request an id (reusing a well-formed inbound `X-Request-Id` from the
 * proxy so logs correlate end to end) and makes it available to every log line
 * written while handling the request.
 */
export const requestContext: RequestHandler = (req, res, next) => {
  const inbound = req.get('x-request-id');
  const id = inbound && INBOUND_ID.test(inbound) ? inbound : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  requestStore.run({ requestId: id }, next);
};
