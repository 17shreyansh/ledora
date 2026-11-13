import Box from '@mui/material/Box';
import type { ReactNode } from 'react';
import { blue, purple, status } from '../../theme/tokens';

const TONES = {
  info: { bg: blue[50], fg: blue[700], border: '#C9DAFC' },
  brand: { bg: purple[50], fg: purple[600], border: purple[200] },
  success: { bg: status.success.bg, fg: status.success.main, border: status.success.border },
  error: { bg: status.error.bg, fg: status.error.main, border: status.error.border },
  warning: { bg: status.warning.bg, fg: status.warning.main, border: status.warning.border },
} as const;

/** A small tinted icon tile above auth-page headings (e.g. "Check your inbox"). */
export function StatusIcon({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  const t = TONES[tone];
  return (
    <Box
      aria-hidden
      sx={{
        width: 44,
        height: 44,
        borderRadius: '12px',
        display: 'grid',
        placeItems: 'center',
        bgcolor: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        mb: 5,
        '& svg': { fontSize: 22 },
      }}
    >
      {children}
    </Box>
  );
}
