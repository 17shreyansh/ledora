import Box from '@mui/material/Box';
import Card, { type CardProps } from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import { useId, type ReactNode } from 'react';
import { status } from '../theme/tokens';

/** A titled card section: header (title, description, action) above its content. */
export function SectionCard({
  title,
  description,
  action,
  children,
  footer,
  tone = 'default',
  disablePadding = false,
  sx,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tone?: 'default' | 'danger';
  disablePadding?: boolean;
  sx?: CardProps['sx'];
}) {
  const headingId = useId();
  return (
    <Card component="section" aria-labelledby={headingId} sx={[{ ...(tone === 'danger' ? { borderColor: status.error.border } : {}) }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          columnGap: 3,
          rowGap: 2,
          px: { xs: 4, sm: 5 },
          py: 4,
          borderBottom: 1,
          borderColor: tone === 'danger' ? status.error.border : 'divider',
        }}
      >
        <Box sx={{ minWidth: 0, flex: '1 1 200px' }}>
          <Typography id={headingId} variant="h3" component="h2" sx={tone === 'danger' ? { color: 'error.main' } : undefined}>
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          ) : null}
        </Box>
        {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
      </Box>
      <Box sx={disablePadding ? undefined : { px: { xs: 4, sm: 5 }, py: 5 }}>{children}</Box>
      {footer ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
            px: { xs: 4, sm: 5 },
            py: 3,
            borderTop: 1,
            borderColor: tone === 'danger' ? status.error.border : 'divider',
            bgcolor: 'slate.25',
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
          }}
        >
          {footer}
        </Box>
      ) : null}
    </Card>
  );
}
