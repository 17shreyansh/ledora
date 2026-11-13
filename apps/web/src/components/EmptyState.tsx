import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <Box sx={{ textAlign: 'center', px: 6, py: compact ? 8 : 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {icon ? (
        <Box
          aria-hidden
          sx={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'slate.50',
            border: 1,
            borderColor: 'divider',
            color: 'slate.500',
            mb: 3,
            '& svg': { fontSize: 20 },
          }}
        >
          {icon}
        </Box>
      ) : null}
      <Typography variant="h4" component="p">
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 420 }}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 4 }}>{action}</Box> : null}
    </Box>
  );
}
