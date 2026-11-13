import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  useDocumentTitle(title);
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'flex-end' },
        justifyContent: 'space-between',
        gap: 3,
        mb: 6,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h1">{title}</Typography>
        {description ? (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 640 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {actions ? <Box sx={{ display: 'flex', gap: 2, flexShrink: 0, flexWrap: 'wrap' }}>{actions}</Box> : null}
    </Box>
  );
}
