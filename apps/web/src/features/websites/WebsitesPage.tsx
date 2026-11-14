import type { UsageDto, WebsiteDto } from '@ledora/shared';
import AddOutlined from '@mui/icons-material/AddOutlined';
import LanguageOutlined from '@mui/icons-material/LanguageOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { useUsage, useWebsites } from '../../api/websites';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { formatDate, formatDateTime, formatRelative } from '../../lib/format';
import { useCurrentOrg } from '../organizations/OrgContext';
import { AddWebsiteDialog } from './AddWebsiteDialog';
import { InstallationStatusChip } from './InstallationStatusChip';

export function websiteLimitReached(usage: UsageDto | undefined): boolean {
  return Boolean(usage && usage.usage.websites >= usage.limits.websites);
}

/** "Last seen 5 minutes ago" / "Waiting for the first visit", with the exact time on hover. */
export function LastSeen({ installation }: { installation: WebsiteDto['installation'] }) {
  if (!installation.lastSeenAt) {
    return (
      <Typography variant="body2" color="text.secondary" component="span">
        Waiting for the first visit
      </Typography>
    );
  }
  return (
    <Typography variant="body2" color="text.secondary" component="span">
      Last seen{' '}
      <Box component="time" dateTime={installation.lastSeenAt} title={formatDateTime(installation.lastSeenAt)}>
        {formatRelative(installation.lastSeenAt)}
      </Box>
    </Typography>
  );
}

function AddWebsiteButton({ usage, onClick }: { usage: UsageDto | undefined; onClick: () => void }) {
  const usageId = useId();
  const atLimit = websiteLimitReached(usage);
  const button = (
    <Button
      variant="contained"
      startIcon={<AddOutlined />}
      onClick={onClick}
      disabled={atLimit}
      aria-describedby={usage ? usageId : undefined}
    >
      Add website
    </Button>
  );
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
      {usage ? (
        <Typography id={usageId} variant="body2" color={atLimit ? 'warning.main' : 'text.secondary'} sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {usage.usage.websites} of {usage.limits.websites} {usage.limits.websites === 1 ? 'website' : 'websites'}
          {atLimit ? ' · plan limit reached' : ''}
        </Typography>
      ) : null}
      {atLimit && usage ? (
        <Tooltip
          title={`Your ${usage.plan.name} plan includes ${usage.limits.websites} ${usage.limits.websites === 1 ? 'website' : 'websites'}. Remove one you no longer use to add another.`}
        >
          {/* Disabled buttons don't fire mouse events, so the tooltip listens on a wrapper. */}
          <span>{button}</span>
        </Tooltip>
      ) : (
        button
      )}
    </Box>
  );
}

function TableSkeleton() {
  return (
    <>
      {[0, 1, 2].map((r) => (
        <TableRow key={r}>
          <TableCell>
            <Skeleton variant="text" width="50%" height={20} />
          </TableCell>
          <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
            <Skeleton variant="text" width="60%" height={20} />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width={90} height={20} />
          </TableCell>
          <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
            <Skeleton variant="text" width={70} height={20} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function WebsitesTable({ orgId, websites }: { orgId: string; websites: WebsiteDto[] }) {
  return (
    <TableContainer>
      <Table aria-label="Websites">
        <TableHead>
          <TableRow>
            <TableCell>Website</TableCell>
            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Domain</TableCell>
            <TableCell>Installation</TableCell>
            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Added</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {websites.map((website) => (
            <TableRow key={website.id} hover>
              <TableCell sx={{ maxWidth: 0, width: { xs: '50%', sm: '30%' } }}>
                <Link
                  component={RouterLink}
                  to={`/o/${orgId}/websites/${website.id}`}
                  sx={{ fontWeight: 500, color: 'text.primary', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {website.name}
                </Link>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ display: { xs: 'block', sm: 'none' } }}>
                  {website.domain}
                </Typography>
              </TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, color: 'text.secondary', wordBreak: 'break-all' }}>
                {website.domain}
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, alignItems: { xs: 'flex-start', lg: 'center' }, gap: { xs: 1, lg: 2 } }}>
                  <InstallationStatusChip installation={website.installation} />
                  <LastSeen installation={website.installation} />
                </Box>
              </TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatDate(website.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function WebsitesPage() {
  const { org, can } = useCurrentOrg();
  const canManage = can('websites.manage');
  const websites = useWebsites(org.id);
  const usage = useUsage(org.id);
  const [params, setParams] = useSearchParams();
  const addOpen = canManage && params.get('add') === '1';

  const setAddOpen = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set('add', '1');
    else next.delete('add');
    setParams(next, { replace: true });
  };

  const list = websites.data ?? [];
  const addButton = canManage ? <AddWebsiteButton usage={usage.data} onClick={() => setAddOpen(true)} /> : undefined;

  return (
    <>
      <PageHeader
        title="Websites"
        description="The sites Ledora collects visits from. Add a website, put its snippet on your pages, and Ledora takes it from there."
        actions={list.length > 0 ? addButton : undefined}
      />

      {websites.isError && !websites.data ? (
        <ApiErrorAlert
          error={websites.error}
          title="Couldn’t load websites"
          action={
            <Button color="inherit" size="small" onClick={() => void websites.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !websites.isPending && list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LanguageOutlined />}
            title="No websites yet"
            description={
              canManage
                ? 'Adding a website gives you a short piece of code to put on your site. Once it’s there, Ledora counts visits and page views from that site — nothing is collected until then.'
                : 'Once someone on your team adds a website and installs Ledora on it, it will appear here.'
            }
            action={addButton}
          />
        </Card>
      ) : (
        <SectionCard
          title="Your websites"
          description={websites.data ? `${list.length} ${list.length === 1 ? 'website' : 'websites'}` : undefined}
          disablePadding
        >
          {websites.isPending ? (
            <TableContainer>
              <Table aria-label="Websites" aria-busy="true">
                <TableBody>
                  <TableSkeleton />
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <WebsitesTable orgId={org.id} websites={list} />
          )}
        </SectionCard>
      )}

      {canManage ? <AddWebsiteDialog open={addOpen} onClose={() => setAddOpen(false)} orgId={org.id} usage={usage.data} /> : null}
    </>
  );
}

export default WebsitesPage;
