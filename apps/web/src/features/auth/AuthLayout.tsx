import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Suspense, type ReactNode } from 'react';
import { Link as RouterLink, Outlet } from 'react-router';
import { FullPageLoader } from '../../components/FullPageLoader';
import { Logo, LogoMark } from '../../components/Logo';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { navy, slate } from '../../theme/tokens';

/**
 * Two-column layout for sign-in and related pages: the form on the left, a calm navy brand
 * panel on the right (desktop only).
 */
export function AuthLayout() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)', lg: 'minmax(0, 7fr) minmax(0, 6fr)' } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', minWidth: 0 }}>
        <Box component="header" sx={{ px: { xs: 4, sm: 10 }, pt: { xs: 5, sm: 8 } }}>
          <Box component={RouterLink} to="/" aria-label="Ledora home" sx={{ display: 'inline-flex', borderRadius: '4px', textDecoration: 'none', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.light', outlineOffset: 4 } }}>
            <Logo size={28} />
          </Box>
        </Box>
        <Box
          component="main"
          sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: { xs: 4, sm: 10 }, py: { xs: 8, sm: 12 } }}
        >
          <Box sx={{ width: '100%', maxWidth: 400 }}>
            <Suspense fallback={<FullPageLoader />}>
              <Outlet />
            </Suspense>
          </Box>
        </Box>
      </Box>
      <Box
        component="aside"
        aria-hidden
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          bgcolor: navy[950],
          color: slate[300],
          px: { md: 12, lg: 20 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ maxWidth: 400 }}>
          <LogoMark size={64} />
          <Typography
            component="p"
            sx={{ mt: 8, fontSize: 26, lineHeight: '34px', fontWeight: 600, letterSpacing: '-0.022em', color: 'common.white' }}
          >
            Analytics, conversations and leads for your websites, in one calm workspace.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  useDocumentTitle(title);
  return (
    <Box sx={{ mb: 7 }}>
      <Typography variant="h1" sx={{ fontSize: 26, lineHeight: '32px' }}>
        {title}
      </Typography>
      {description ? (
        <Typography color="text.secondary" sx={{ mt: 2, fontSize: 14, lineHeight: '21px' }}>
          {description}
        </Typography>
      ) : null}
    </Box>
  );
}

export function AuthFooter({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mt: 7, textAlign: 'center' }}>
      {children}
    </Typography>
  );
}
