import { ROLE_LABELS, type OrganizationWithRoleDto } from '@ledora/shared';
import AddOutlined from '@mui/icons-material/AddOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import UnfoldMoreOutlined from '@mui/icons-material/UnfoldMoreOutlined';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { navy, purple, slate } from '../theme/tokens';

export function OrgAvatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: '6px',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        bgcolor: purple[600],
        color: 'common.white',
        fontSize: Math.round(size * 0.46),
        fontWeight: 650,
        lineHeight: 1,
      }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </Box>
  );
}

export function OrgSwitcher({
  organizations,
  currentOrg,
  loading,
  onNavigate,
}: {
  organizations: OrganizationWithRoleDto[];
  currentOrg: OrganizationWithRoleDto | null;
  loading: boolean;
  onNavigate?: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const menuId = useId();
  const buttonId = useId();

  const go = (path: string) => {
    setAnchor(null);
    onNavigate?.();
    void navigate(path);
  };

  if (loading) {
    return <Skeleton variant="rounded" height={48} sx={{ bgcolor: navy[800] }} />;
  }

  return (
    <>
      <ButtonBase
        id={buttonId}
        aria-haspopup="menu"
        aria-controls={anchor ? menuId : undefined}
        aria-expanded={anchor ? 'true' : undefined}
        aria-label={currentOrg ? `Current organization: ${currentOrg.name}. Switch organization` : 'Choose an organization'}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 2.5,
          p: 2,
          borderRadius: '8px',
          textAlign: 'left',
          border: `1px solid ${navy[700]}`,
          bgcolor: navy[900],
          color: 'common.white',
          transition: 'background-color 120ms',
          '&:hover': { bgcolor: navy[850] },
          '&.Mui-focusVisible': { outline: `2px solid ${purple[300]}`, outlineOffset: 2 },
        }}
      >
        {currentOrg ? <OrgAvatar name={currentOrg.name} /> : null}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, color: 'common.white', lineHeight: '18px' }}>
            {currentOrg?.name ?? 'No organization'}
          </Typography>
          <Typography noWrap sx={{ fontSize: 12, color: slate[300], lineHeight: '16px' }}>
            {currentOrg ? ROLE_LABELS[currentOrg.role] : 'Create one to get started'}
          </Typography>
        </Box>
        <UnfoldMoreOutlined sx={{ fontSize: 18, color: slate[400] }} />
      </ButtonBase>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 264, mt: 1 } }, list: { 'aria-labelledby': buttonId } }}
      >
        <Typography variant="overline" component="div" sx={{ px: 2.5, pt: 1.5, pb: 1, color: 'text.secondary' }}>
          Organizations
        </Typography>
        {organizations.map((org) => {
          const selected = org.id === currentOrg?.id;
          return (
            <MenuItem key={org.id} selected={selected} onClick={() => go(`/o/${org.id}`)} sx={{ gap: 2.5 }}>
              <OrgAvatar name={org.name} size={24} />
              <ListItemText
                primary={org.name}
                secondary={ROLE_LABELS[org.role]}
                slotProps={{
                  primary: { noWrap: true, sx: { fontWeight: 500 } },
                  secondary: { sx: { fontSize: 12 } },
                }}
                sx={{ my: 0, minWidth: 0 }}
              />
              {selected ? <CheckOutlined sx={{ fontSize: 18, color: 'primary.main' }} aria-label="Current" /> : null}
            </MenuItem>
          );
        })}
        {organizations.length > 0 ? <Divider sx={{ my: 1 }} /> : null}
        <MenuItem onClick={() => go('/onboarding/organization')}>
          <ListItemIcon>
            <AddOutlined />
          </ListItemIcon>
          Create organization
        </MenuItem>
      </Menu>
    </>
  );
}
