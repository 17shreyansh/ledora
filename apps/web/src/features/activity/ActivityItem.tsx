import type { AuditLogDto } from '@ledora/shared';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { describeAuditEntry, type AuditContext } from '../../lib/auditSentence';
import { formatDateTime, formatRelative, initials } from '../../lib/format';
import { navy, slate } from '../../theme/tokens';

export function ActivityItem({ entry, context, showAbsolute = false }: { entry: AuditLogDto; context: AuditContext; showAbsolute?: boolean }) {
  const parts = describeAuditEntry(entry, context);
  const actorName = entry.actor.type === 'system' ? 'Ledora' : (entry.actor.name ?? '?');
  const absolute = formatDateTime(entry.createdAt);
  return (
    <Box component="li" sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', py: 3, px: { xs: 4, sm: 5 }, '& + &': { borderTop: 1, borderColor: 'divider' } }}>
      <Avatar
        aria-hidden
        sx={{
          width: 28,
          height: 28,
          fontSize: 11,
          mt: 0.25,
          ...(entry.actor.type === 'system' ? { bgcolor: navy[950], color: 'common.white' } : {}),
        }}
      >
        {initials(actorName)}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 14, lineHeight: '20px', color: slate[700], wordBreak: 'break-word' }}>
          {parts.map((part, i) =>
            typeof part === 'string' ? (
              <span key={i}>{part}</span>
            ) : (
              <Box component="span" key={i} sx={{ fontWeight: 600, color: 'text.primary' }}>
                {part.strong}
              </Box>
            ),
          )}
        </Typography>
        <Typography variant="caption" component="div" sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
          <Tooltip title={absolute}>
            <Box component="time" dateTime={entry.createdAt} sx={{ cursor: 'default' }}>
              {formatRelative(entry.createdAt)}
            </Box>
          </Tooltip>
          {showAbsolute ? (
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {' · '}
              {absolute}
            </Box>
          ) : null}
        </Typography>
      </Box>
    </Box>
  );
}
