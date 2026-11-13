import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import { Suspense, useEffect, useMemo } from 'react';
import { Link as RouterLink, Outlet, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { useOrganization } from '../../api/organizations';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { EmptyState } from '../../components/EmptyState';
import { FullPageLoader } from '../../components/FullPageLoader';
import { clearLastOrgId, setLastOrgId } from '../../lib/lastOrg';
import { makeOrgContext, OrgContext } from './OrgContext';

export function PageSkeleton() {
  return (
    <Box aria-busy="true" aria-label="Loading">
      <Skeleton variant="text" width={220} height={32} />
      <Skeleton variant="text" width={360} height={20} sx={{ mt: 1.5, mb: 6 }} />
      <Skeleton variant="rounded" height={180} sx={{ borderRadius: '12px' }} />
      <Skeleton variant="rounded" height={240} sx={{ mt: 4, borderRadius: '12px' }} />
    </Box>
  );
}

/** Loads the organization in the URL and provides it (with the viewer's role) to its pages. */
export function OrgLayout() {
  const { orgId = '' } = useParams();
  const org = useOrganization(orgId);
  const value = useMemo(() => (org.data ? makeOrgContext(org.data) : null), [org.data]);

  useEffect(() => {
    if (org.data) setLastOrgId(org.data.id);
  }, [org.data]);

  useEffect(() => {
    if (org.error instanceof ApiError && org.error.status === 404) clearLastOrgId(orgId);
  }, [org.error, orgId]);

  if (org.isPending) return <PageSkeleton />;
  if (org.isError) {
    if (org.error instanceof ApiError && org.error.status === 404) {
      return (
        <Card>
          <EmptyState
            icon={<SearchOffOutlined />}
            title="Organization not found"
            description="It may have been deleted, or you are no longer a member. Ask an admin for a new invitation if you need access."
            action={
              <Button component={RouterLink} to="/" variant="contained">
                Go to my workspace
              </Button>
            }
          />
        </Card>
      );
    }
    return (
      <ApiErrorAlert
        error={org.error}
        title="We couldn’t load this organization"
        action={
          <Button color="inherit" size="small" onClick={() => void org.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <OrgContext.Provider value={value}>
      <Suspense fallback={<FullPageLoader />}>
        <Outlet />
      </Suspense>
    </OrgContext.Provider>
  );
}
