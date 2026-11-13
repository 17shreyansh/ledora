import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { useSession } from '../api/auth';
import { ApiErrorAlert } from '../components/ApiErrorAlert';
import { FullPageLoader } from '../components/FullPageLoader';
import { safeReturnTo, withReturnTo } from '../lib/returnTo';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { wasSignedOutIntentionally } from './signOutState';

function SessionError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', mt: 20, px: 4 }}>
      <ApiErrorAlert
        error={error}
        title="We couldn’t load your session"
        action={
          <Button color="inherit" size="small" onClick={retry}>
            Retry
          </Button>
        }
      />
    </Box>
  );
}

/** Renders children only for signed-in users; otherwise sends them to sign in and back. */
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();
  if (session.isPending) return <FullPageLoader />;
  if (session.isError) return <SessionError error={session.error} retry={() => void session.refetch()} />;
  if (!session.data) {
    const here = `${location.pathname}${location.search}`;
    const target = wasSignedOutIntentionally() || here === '/' ? '/login' : withReturnTo('/login', here);
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}

/** Requires a verified email address (creating or joining organizations needs one). */
export function RequireVerified() {
  const session = useSession();
  const location = useLocation();
  if (session.data && !session.data.user.emailVerified) {
    return <Navigate to={withReturnTo('/check-email', `${location.pathname}${location.search}`)} replace />;
  }
  return <Outlet />;
}

/** Sign-in/up pages: signed-in users are sent on to where they were going. */
export function PublicOnly() {
  const session = useSession();
  const [params] = useSearchParams();
  if (session.isPending) return <FullPageLoader />;
  if (session.data) {
    const returnTo = safeReturnTo(params.get('returnTo'));
    if (!session.data.user.emailVerified) return <Navigate to={withReturnTo('/check-email', returnTo)} replace />;
    return <Navigate to={returnTo ?? '/'} replace />;
  }
  // A failed session probe (network) still lets people reach the sign-in form.
  return <Outlet />;
}
