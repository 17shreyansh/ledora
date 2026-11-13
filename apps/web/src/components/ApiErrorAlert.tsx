import Alert, { type AlertProps } from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

/** Shows an API error's message, with the request id in small print for support. */
export function ApiErrorAlert({
  error,
  title,
  action,
  sx,
}: {
  error: unknown;
  title?: string;
  action?: ReactNode;
  sx?: AlertProps['sx'];
}) {
  if (!error) return null;
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <Alert severity="error" action={action} sx={sx} role="alert">
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {errorMessage(error)}
      {requestId ? (
        <Box component="span" sx={{ display: 'block', mt: 0.5, fontSize: 11, opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>
          Request ID: {requestId}
        </Box>
      ) : null}
    </Alert>
  );
}
