import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';
import { useAuditLogs } from '../../api/organizations';
import { withAcceptedInvitations } from '../../lib/auditSentence';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { EmptyState } from '../../components/EmptyState';
import { NoAccess } from '../../components/NoAccess';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { useCurrentOrg } from '../organizations/OrgContext';
import { ActivityItem } from './ActivityItem';
import { useAuditContext } from './useAuditContext';

export function ActivityPage() {
  const { org, can } = useCurrentOrg();
  const allowed = can('audit.read');
  const audit = useAuditLogs(org.id, allowed);
  const baseContext = useAuditContext();
  const entries = useMemo(() => audit.data?.pages.flatMap((p) => p.items) ?? [], [audit.data]);
  const context = useMemo(() => withAcceptedInvitations(baseContext, entries), [baseContext, entries]);

  if (!allowed) return <NoAccess orgId={org.id} what="the activity log" />;

  return (
    <>
      <PageHeader title="Activity" description="A record of changes to this organization, its members and invitations." />
      <SectionCard
        title="Audit log"
        description={audit.data ? `Showing ${entries.length} ${entries.length === 1 ? 'event' : 'events'}, newest first` : undefined}
        action={
          <Button variant="outlined" color="neutral" size="small" onClick={() => void audit.refetch()} loading={audit.isRefetching && !audit.isFetchingNextPage}>
            Refresh
          </Button>
        }
        disablePadding
      >
        {audit.isPending ? (
          <Box sx={{ px: 5, py: 4, display: 'grid', gap: 5 }} aria-busy="true" aria-label="Loading activity">
            {[0, 1, 2, 3, 4].map((i) => (
              <Box key={i} sx={{ display: 'flex', gap: 3 }}>
                <Skeleton variant="circular" width={28} height={28} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width={`${60 - i * 6}%`} height={20} />
                  <Skeleton variant="text" width={160} height={16} sx={{ mt: 1 }} />
                </Box>
              </Box>
            ))}
          </Box>
        ) : audit.isError && !audit.data ? (
          <Box sx={{ p: 5 }}>
            <ApiErrorAlert
              error={audit.error}
              title="Couldn’t load activity"
              action={
                <Button color="inherit" size="small" onClick={() => void audit.refetch()}>
                  Retry
                </Button>
              }
            />
          </Box>
        ) : entries.length === 0 ? (
          <EmptyState icon={<HistoryOutlined />} title="No activity yet" description="Changes to members, invitations and settings will be recorded here." />
        ) : (
          <>
            <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, py: 1 }}>
              {entries.map((entry) => (
                <ActivityItem key={entry.id} entry={entry} context={context} showAbsolute />
              ))}
            </Box>
            <Box sx={{ p: 3, borderTop: 1, borderColor: 'divider', textAlign: 'center' }}>
              {audit.hasNextPage ? (
                <Button variant="outlined" color="neutral" size="small" onClick={() => void audit.fetchNextPage()} loading={audit.isFetchingNextPage}>
                  Load more
                </Button>
              ) : (
                <Typography variant="caption">You’ve reached the beginning of the log.</Typography>
              )}
            </Box>
            {audit.isError ? (
              <Box sx={{ px: 5, pb: 4 }}>
                <ApiErrorAlert error={audit.error} title="Couldn’t load activity" />
              </Box>
            ) : null}
          </>
        )}
      </SectionCard>
    </>
  );
}

export default ActivityPage;
