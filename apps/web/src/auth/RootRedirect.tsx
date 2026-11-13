import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { Navigate } from 'react-router';
import { useMyOrganizations, useSession } from '../api/auth';
import { ApiErrorAlert } from '../components/ApiErrorAlert';
import { FullPageLoader } from '../components/FullPageLoader';
import { getLastOrgId } from '../lib/lastOrg';

/**
 * `/` decides where a user belongs: sign in → verify email → create an organization →
 * the organization they used last (or their first one).
 */
export function RootRedirect() {
  const session = useSession();
  const user = session.data?.user;
  const orgs = useMyOrganizations(Boolean(user?.emailVerified));

  if (session.isPending) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.emailVerified) return <Navigate to="/check-email" replace />;
  if (orgs.isPending) return <FullPageLoader />;
  if (orgs.isError) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', mt: 20, px: 4 }}>
        <ApiErrorAlert
          error={orgs.error}
          title="We couldn’t load your organizations"
          action={
            <Button color="inherit" size="small" onClick={() => void orgs.refetch()}>
              Retry
            </Button>
          }
        />
      </Box>
    );
  }
  const list = orgs.data;
  if (list.length === 0) return <Navigate to="/onboarding/organization" replace />;
  const last = getLastOrgId();
  const target = list.find((o) => o.id === last) ?? list[0]!;
  return <Navigate to={`/o/${target.id}`} replace />;
}
