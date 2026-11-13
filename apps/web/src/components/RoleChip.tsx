import { ROLE_LABELS, type OrgRole } from '@ledora/shared';
import Chip from '@mui/material/Chip';
import { blue, purple, slate } from '../theme/tokens';

const ROLE_STYLES: Record<OrgRole, { bg: string; fg: string; border: string }> = {
  owner: { bg: purple[50], fg: purple[700], border: purple[200] },
  admin: { bg: blue[50], fg: blue[800], border: blue[100] },
  manager: { bg: '#EEF7F5', fg: '#0B5E50', border: '#C7E6DF' },
  analyst: { bg: '#FFF7EB', fg: '#7A4A00', border: '#F3DDB4' },
  viewer: { bg: slate[50], fg: slate[600], border: slate[150] },
};

export function RoleChip({ role, size = 'small' }: { role: OrgRole; size?: 'small' | 'medium' }) {
  const style = ROLE_STYLES[role];
  return (
    <Chip
      label={ROLE_LABELS[role]}
      size={size}
      sx={{ bgcolor: style.bg, color: style.fg, border: `1px solid ${style.border}` }}
    />
  );
}
