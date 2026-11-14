import { hasPermission, type OrganizationWithRoleDto, type Permission } from '@ledora/shared';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import GroupOutlined from '@mui/icons-material/GroupOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import LanguageOutlined from '@mui/icons-material/LanguageOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Suspense, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useParams } from 'react-router';
import { useMyOrganizations, useSession } from '../api/auth';
import { getLastOrgId } from '../lib/lastOrg';
import { layout, navy, purple, slate } from '../theme/tokens';
import { FullPageLoader } from './FullPageLoader';
import { Logo } from './Logo';
import { OrgSwitcher } from './OrgSwitcher';
import { UserMenu } from './UserMenu';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  end?: boolean;
  permission?: Permission;
}

function navItems(orgId: string): NavItem[] {
  return [
    { label: 'Overview', to: `/o/${orgId}`, icon: <SpaceDashboardOutlined />, end: true },
    { label: 'Websites', to: `/o/${orgId}/websites`, icon: <LanguageOutlined />, permission: 'websites.read' },
    { label: 'Members', to: `/o/${orgId}/members`, icon: <GroupOutlined /> },
    { label: 'Activity', to: `/o/${orgId}/activity`, icon: <HistoryOutlined />, permission: 'audit.read' },
    { label: 'Settings', to: `/o/${orgId}/settings`, icon: <SettingsOutlined />, permission: 'org.update' },
  ];
}

function SidebarNav({ org, onNavigate }: { org: OrganizationWithRoleDto; onNavigate?: () => void }) {
  const items = navItems(org.id).filter((item) => !item.permission || hasPermission(org.role, item.permission));
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
      {items.map((item) => (
        <li key={item.to}>
          <Box
            component={NavLink}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 2.5,
              height: 36,
              px: 2.5,
              borderRadius: '8px',
              fontSize: 14,
              fontWeight: 500,
              color: slate[300],
              textDecoration: 'none',
              transition: 'background-color 120ms, color 120ms',
              '& svg': { fontSize: 19, color: slate[400] },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: 'common.white' },
              '&:focus-visible': { outline: `2px solid ${purple[300]}`, outlineOffset: 1 },
              '&.active': {
                bgcolor: 'rgba(255,255,255,0.09)',
                color: 'common.white',
                '& svg': { color: purple[300] },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: -12,
                  top: 9,
                  bottom: 9,
                  width: 3,
                  borderRadius: '0 3px 3px 0',
                  bgcolor: purple[300],
                },
              },
            }}
          >
            {item.icon}
            {item.label}
          </Box>
        </li>
      ))}
    </Box>
  );
}

function SidebarContent({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  const params = useParams();
  const session = useSession();
  const orgs = useMyOrganizations(Boolean(session.data?.user.emailVerified));
  const list = orgs.data ?? [];
  const wantedId = params.orgId ?? getLastOrgId();
  const currentOrg = list.find((o) => o.id === wantedId) ?? (params.orgId ? null : (list[0] ?? null));

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: navy[950],
        color: slate[300],
        width: layout.sidebarWidth,
      }}
    >
      <Box sx={{ px: 5, pt: 5, pb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo size={26} tone="light" />
        {onClose ? (
          <IconButton onClick={onClose} aria-label="Close navigation" size="small" sx={{ color: slate[300], '&:hover': { color: 'common.white', bgcolor: 'rgba(255,255,255,0.08)' } }}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        ) : null}
      </Box>
      <Box sx={{ px: 3, pb: 4 }}>
        <OrgSwitcher organizations={list} currentOrg={currentOrg} loading={orgs.isPending && Boolean(session.data?.user.emailVerified)} onNavigate={onNavigate} />
      </Box>
      <Box component="nav" aria-label="Main" sx={{ px: 3, flex: 1, overflowY: 'auto' }}>
        {currentOrg ? <SidebarNav org={currentOrg} onNavigate={onNavigate} /> : null}
      </Box>
      <Box sx={{ px: 3, py: 3, borderTop: `1px solid ${navy[800]}` }}>
        {session.data ? <UserMenu user={session.data.user} onNavigate={onNavigate} /> : null}
      </Box>
    </Box>
  );
}

/**
 * Signed-in layout: a fixed navy sidebar on desktop; on smaller screens a top bar
 * that opens the same sidebar as a temporary drawer.
 */
export function AppShell() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: 8,
          top: -48,
          zIndex: 2000,
          px: 3,
          py: 2,
          bgcolor: 'common.white',
          borderRadius: '8px',
          boxShadow: 3,
          fontWeight: 500,
          '&:focus': { top: 8 },
        }}
      >
        Skip to content
      </Box>
      {isDesktop ? (
        <Box
          component="aside"
          aria-label="Sidebar"
          sx={{ width: layout.sidebarWidth, flexShrink: 0, position: 'fixed', inset: '0 auto 0 0', zIndex: theme.zIndex.drawer }}
        >
          <SidebarContent />
        </Box>
      ) : (
        <>
          <AppBar
            position="fixed"
            sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', color: 'text.primary' }}
          >
            <Toolbar sx={{ minHeight: `${layout.appBarHeight}px !important`, px: { xs: 2, sm: 4 }, gap: 2 }}>
              <IconButton
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                aria-controls="mobile-navigation"
                aria-expanded={mobileOpen}
                color="neutral"
              >
                <MenuOutlined />
              </IconButton>
              <Logo size={24} />
            </Toolbar>
          </AppBar>
          <Drawer
            id="mobile-navigation"
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: false }}
            slotProps={{ paper: { sx: { bgcolor: navy[950] }, 'aria-label': 'Navigation' } as object }}
          >
            <SidebarContent onNavigate={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
          </Drawer>
        </>
      )}
      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flex: 1,
          minWidth: 0,
          ml: isDesktop ? `${layout.sidebarWidth}px` : 0,
          pt: isDesktop ? 0 : `${layout.appBarHeight}px`,
          outline: 'none',
        }}
      >
        <Box sx={{ maxWidth: layout.contentMaxWidth, mx: 'auto', px: { xs: 4, sm: 6, md: 10 }, py: { xs: 6, md: 10 } }}>
          <Suspense fallback={<FullPageLoader />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
}

