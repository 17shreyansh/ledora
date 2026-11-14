import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import RadioButtonUncheckedOutlined from '@mui/icons-material/RadioButtonUncheckedOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useMemo, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { useSession } from '../../api/auth';
import { useAuditLogs, useInvitations, useMembers } from '../../api/organizations';
import { useWebsites } from '../../api/websites';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { RoleChip } from '../../components/RoleChip';
import { SectionCard } from '../../components/SectionCard';
import { withAcceptedInvitations } from '../../lib/auditSentence';
import { formatDate } from '../../lib/format';
import { timeZoneLabel } from '../../lib/timezones';
import { ActivityItem } from '../activity/ActivityItem';
import { useAuditContext } from '../activity/useAuditContext';
import { useCurrentOrg } from './OrgContext';
import { PlanUsageCard } from './PlanUsageCard';
import { visuallyHidden } from '../../lib/a11y';

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '160px minmax(0, 1fr)' },
        gap: { xs: 0.5, sm: 4 },
        py: 3,
        '& + &': { borderTop: 1, borderColor: 'divider' },
      }}
    >
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box component="dd" sx={{ m: 0, minWidth: 0, fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>
        {children}
      </Box>
    </Box>
  );
}

function Stat({ label, value, loading }: { label: string; value: number | string | null; loading: boolean }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {loading ? (
        <Skeleton variant="text" width={40} height={32} sx={{ mt: 1 }} />
      ) : (
        <Typography
          sx={{ mt: 1, fontSize: 26, lineHeight: '32px', fontWeight: 600, letterSpacing: '-0.02em', color: 'navy.950', fontVariantNumeric: 'tabular-nums' }}
        >
          {value ?? '—'}
        </Typography>
      )}
    </Box>
  );
}

function ChecklistItem({ done, title, description, action }: { done: boolean; title: string; description: string; action?: ReactNode }) {
  return (
    <Box component="li" sx={{ display: 'flex', gap: 3, py: 3, '& + &': { borderTop: 1, borderColor: 'divider' } }}>
      {done ? (
        <CheckCircleOutlined sx={{ color: 'success.main', fontSize: 20, mt: 0.25 }} aria-hidden />
      ) : (
        <RadioButtonUncheckedOutlined sx={{ color: 'slate.300', fontSize: 20, mt: 0.25 }} aria-hidden />
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: done ? 'text.secondary' : 'text.primary' }}>
          {title}
          <Box component="span" sx={visuallyHidden}>
            {done ? ' (done)' : ' (to do)'}
          </Box>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
        {!done && action ? <Box sx={{ mt: 2 }}>{action}</Box> : null}
      </Box>
    </Box>
  );
}


export function OverviewPage() {
  const { org, can } = useCurrentOrg();
  const session = useSession();
  const canInvite = can('members.invite');
  const canAudit = can('audit.read');
  const members = useMembers(org.id);
  const invitations = useInvitations(org.id, canInvite);
  const audit = useAuditLogs(org.id, canAudit);
  const websites = useWebsites(org.id);
  const canManageWebsites = can('websites.manage');
  const auditContext = useAuditContext();

  const memberItems = members.data?.pages.flatMap((p) => p.items) ?? [];
  const memberCount = members.data ? `${memberItems.length}${members.hasNextPage ? '+' : ''}` : null;
  const pendingCount = invitations.data?.length ?? null;
  const firstPage = audit.data?.pages[0]?.items;
  const recent = firstPage?.slice(0, 6) ?? [];
  const recentContext = useMemo(() => withAcceptedInvitations(auditContext, firstPage ?? []), [auditContext, firstPage]);

  const emailVerified = Boolean(session.data?.user.emailVerified);
  const invitedSomeone = memberItems.length > 1 || (pendingCount ?? 0) > 0;
  const siteList = websites.data ?? [];
  const notInstalled = siteList.find((w) => w.installation.status !== 'verified');
  const steps = [
    { key: 'verify', done: emailVerified, title: 'Verify your email', description: 'Confirms your address so you can create and join organizations.' },
    { key: 'org', done: true, title: 'Create your organization', description: `${org.name} is ready.` },
    // Website steps come from real data; if the list can't be loaded we leave them out rather than guess.
    ...(websites.data
      ? [
          {
            key: 'website',
            done: siteList.length > 0,
            title: 'Add your first website',
            description: canManageWebsites
              ? 'Tell Ledora which site you want to count visits for.'
              : 'Ask an owner, admin or manager to add your website.',
            action: canManageWebsites ? (
              <Button component={RouterLink} to={`/o/${org.id}/websites?add=1`} variant="outlined" color="neutral" size="small">
                Add a website
              </Button>
            ) : undefined,
          },
          {
            key: 'install',
            done: siteList.some((w) => w.installation.status === 'verified'),
            title: 'Install Ledora on your website',
            description: 'Paste a one-line snippet on your site. It’s confirmed as soon as the first visit arrives.',
            action: notInstalled ? (
              <Button
                component={RouterLink}
                to={`/o/${org.id}/websites/${notInstalled.id}/install`}
                variant="outlined"
                color="neutral"
                size="small"
              >
                View install steps
              </Button>
            ) : undefined,
          },
        ]
      : []),
    ...(canInvite
      ? [
          {
            key: 'invite',
            done: invitedSomeone,
            title: 'Invite a teammate',
            description: 'Bring in the people you work with and choose what each can do.',
            action: (
              <Button component={RouterLink} to={`/o/${org.id}/members?invite=1`} variant="outlined" color="neutral" size="small">
                Invite a teammate
              </Button>
            ),
          },
        ]
      : []),
  ];
  const completed = steps.filter((s) => s.done).length;
  const stepsLoading = websites.isPending || (canInvite && (members.isPending || invitations.isPending));

  return (
    <>
      <PageHeader title={org.name} description="Your organization at a glance." />
      <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' }, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 5, minWidth: 0 }}>
          <SectionCard
            title="Organization"
            action={
              can('org.update') ? (
                <Button component={RouterLink} to={`/o/${org.id}/settings`} variant="outlined" color="neutral" size="small">
                  Edit settings
                </Button>
              ) : undefined
            }
            sx={{ '& dl': { m: 0 } }}
          >
            <Box component="dl" sx={{ my: -3 }}>
              <DetailRow label="Name">{org.name}</DetailRow>
              <DetailRow label="Address">ledora.com/{org.slug}</DetailRow>
              <DetailRow label="Time zone">{timeZoneLabel(org.timezone)}</DetailRow>
              <DetailRow label="Your role">
                <RoleChip role={org.role} />
              </DetailRow>
              <DetailRow label="Created">
                <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatDate(org.createdAt)}
                </Box>
              </DetailRow>
            </Box>
          </SectionCard>

          {canAudit ? (
            <SectionCard
              title="Recent activity"
              description="Changes made in this organization."
              action={
                recent.length > 0 ? (
                  <Link component={RouterLink} to={`/o/${org.id}/activity`} variant="body2">
                    View all activity
                  </Link>
                ) : undefined
              }
              disablePadding
            >
              {audit.isPending ? (
                <Box sx={{ px: 5, py: 4, display: 'grid', gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 3 }}>
                      <Skeleton variant="circular" width={28} height={28} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="70%" height={20} />
                        <Skeleton variant="text" width={80} height={16} sx={{ mt: 1 }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : audit.isError ? (
                <Box sx={{ p: 5 }}>
                  <ApiErrorAlert error={audit.error} title="Couldn’t load recent activity" />
                </Box>
              ) : recent.length === 0 ? (
                <EmptyState compact icon={<HistoryOutlined />} title="No activity yet" description="Changes to members and settings will appear here." />
              ) : (
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, py: 1 }}>
                  {recent.map((entry) => (
                    <ActivityItem key={entry.id} entry={entry} context={recentContext} />
                  ))}
                </Box>
              )}
            </SectionCard>
          ) : null}
        </Box>

        <Box sx={{ display: 'grid', gap: 5, minWidth: 0 }}>
          <SectionCard
            title="Getting started"
            description={
              stepsLoading ? undefined : completed === steps.length ? 'All done. Nice work.' : `${completed} of ${steps.length} complete`
            }
          >
            {stepsLoading ? (
              <Box sx={{ display: 'grid', gap: 3 }}>
                <Skeleton variant="text" height={20} />
                <Skeleton variant="text" height={20} />
                <Skeleton variant="text" height={20} />
              </Box>
            ) : (
              <>
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, my: -3 }}>
                  {steps.map(({ key, ...step }) => (
                    <ChecklistItem key={key} {...step} />
                  ))}
                </Box>
                {websites.isError ? (
                  <ApiErrorAlert error={websites.error} title="Couldn’t check your websites" sx={{ mt: 5 }} />
                ) : null}
              </>
            )}
          </SectionCard>

          <PlanUsageCard orgId={org.id} />

          <SectionCard
            title="Team"
            action={
              <Link component={RouterLink} to={`/o/${org.id}/members`} variant="body2">
                Manage
              </Link>
            }
          >
            {members.isError ? (
              <ApiErrorAlert error={members.error} title="Couldn’t load members" />
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: canInvite ? '1fr 1fr' : '1fr', gap: 4 }}>
                <Stat label="Members" value={memberCount} loading={members.isPending} />
                {canInvite ? (
                  <Stat label="Pending invitations" value={pendingCount} loading={invitations.isPending} />
                ) : null}
              </Box>
            )}
          </SectionCard>
        </Box>
      </Box>
    </>
  );
}

export default OverviewPage;
