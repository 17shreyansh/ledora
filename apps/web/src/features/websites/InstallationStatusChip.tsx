import type { WebsiteDto } from '@ledora/shared';
import Chip from '@mui/material/Chip';
import { slate, status } from '../../theme/tokens';

/** "Verified" (green) once the server has received a real event from the site; otherwise "Not installed". */
export function InstallationStatusChip({ installation }: { installation: WebsiteDto['installation'] }) {
  const verified = installation.status === 'verified';
  const style = verified
    ? { bg: status.success.bg, fg: status.success.main, border: status.success.border, dot: status.success.main }
    : { bg: slate[50], fg: slate[600], border: slate[150], dot: slate[400] };
  return (
    <Chip
      component="span"
      size="small"
      label={verified ? 'Verified' : 'Not installed'}
      icon={
        <span
          aria-hidden
          style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: style.dot, display: 'inline-block', flexShrink: 0 }}
        />
      }
      sx={{
        bgcolor: style.bg,
        color: style.fg,
        border: `1px solid ${style.border}`,
        '& .MuiChip-icon': { ml: '7px', mr: '-2px' },
      }}
    />
  );
}
