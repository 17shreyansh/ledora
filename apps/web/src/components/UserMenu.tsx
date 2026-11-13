import type { UserDto } from '@ledora/shared';
import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLogout } from '../api/auth';
import { initials } from '../lib/format';
import { navy, purple, slate } from '../theme/tokens';
import { useNotify } from './NotifyProvider';

export function UserMenu({ user, onNavigate }: { user: UserDto; onNavigate?: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const logout = useLogout();
  const notify = useNotify();
  const menuId = useId();
  const buttonId = useId();

  const signOut = () => {
    setAnchor(null);
    onNavigate?.();
    logout.mutate(undefined, {
      onSuccess: () => notify('You’ve been signed out.', 'info'),
      onSettled: () => void navigate('/login', { replace: true }),
    });
  };

  return (
    <>
      <ButtonBase
        id={buttonId}
        aria-haspopup="menu"
        aria-controls={anchor ? menuId : undefined}
        aria-expanded={anchor ? 'true' : undefined}
        aria-label={`Account menu for ${user.name}`}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 2.5,
          p: 2,
          borderRadius: '8px',
          textAlign: 'left',
          color: 'common.white',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
          '&.Mui-focusVisible': { outline: `2px solid ${purple[300]}`, outlineOffset: 2 },
        }}
      >
        <Avatar sx={{ width: 30, height: 30, bgcolor: navy[700], color: 'common.white' }}>{initials(user.name)}</Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: 'common.white', lineHeight: '18px' }}>
            {user.name}
          </Typography>
          <Typography noWrap sx={{ fontSize: 12, color: slate[300], lineHeight: '16px' }}>
            {user.email}
          </Typography>
        </Box>
        <MoreHorizOutlined sx={{ fontSize: 18, color: slate[400] }} />
      </ButtonBase>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 232, mt: -1 } }, list: { 'aria-labelledby': buttonId } }}
      >
        <Box sx={{ px: 2.5, py: 2 }}>
          <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
            {user.name}
          </Typography>
          <Typography noWrap variant="caption" component="div">
            {user.email}
          </Typography>
        </Box>
        <Divider sx={{ my: 1 }} />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onNavigate?.();
            void navigate('/account');
          }}
        >
          <ListItemIcon>
            <AccountCircleOutlined />
          </ListItemIcon>
          Account
        </MenuItem>
        <MenuItem onClick={signOut} disabled={logout.isPending}>
          <ListItemIcon>
            <LogoutOutlined />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
