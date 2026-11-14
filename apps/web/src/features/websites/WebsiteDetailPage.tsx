import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useId } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { useWebsite } from '../../api/websites';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { useCurrentOrg } from '../organizations/OrgContext';
import { PageSkeleton } from '../organizations/OrgLayout';
import { InstallationStatusChip } from './InstallationStatusChip';
import { InstallTab } from './InstallTab';
import { WebsiteSettingsTab } from './WebsiteSettingsTab';

const TABS = [
  { value: 'install', label: 'Install' },
  { value: 'settings', label: 'Settings' },
] as const;
type TabValue = (typeof TABS)[number]['value'];

function BackLink({ orgId }: { orgId: string }) {
  return (
    <Link
      component={RouterLink}
      to={`/o/${orgId}/websites`}
      variant="body2"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 3, color: 'text.secondary', '& svg': { fontSize: 16 } }}
    >
      <ArrowBackOutlined aria-hidden />
      Websites
    </Link>
  );
}

export function WebsiteDetailPage() {
  const { org } = useCurrentOrg();
  const { websiteId = '', tab } = useParams();
  const website = useWebsite(org.id, websiteId);
  const tabsId = useId();

  if (website.isPending) return <PageSkeleton />;
  if (website.isError) {
    if (website.error instanceof ApiError && website.error.status === 404) {
      return (
        <>
          <BackLink orgId={org.id} />
          <Card>
            <EmptyState
              icon={<SearchOffOutlined />}
              title="Website not found"
              description="It may have been deleted, or the link is out of date."
              action={
                <Button component={RouterLink} to={`/o/${org.id}/websites`} variant="outlined" color="neutral">
                  Back to websites
                </Button>
              }
            />
          </Card>
        </>
      );
    }
    return (
      <>
        <BackLink orgId={org.id} />
        <ApiErrorAlert
          error={website.error}
          title="Couldn’t load this website"
          action={
            <Button color="inherit" size="small" onClick={() => void website.refetch()}>
              Retry
            </Button>
          }
        />
      </>
    );
  }

  const site = website.data;
  const fallback: TabValue = site.installation.status === 'verified' ? 'settings' : 'install';
  const active: TabValue = TABS.some((t) => t.value === tab) ? (tab as TabValue) : fallback;
  const base = `/o/${org.id}/websites/${site.id}`;

  return (
    <>
      <BackLink orgId={org.id} />
      <PageHeader
        title={site.name}
        description={
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box component="span" sx={{ wordBreak: 'break-all' }}>
              {site.domain}
            </Box>
            <InstallationStatusChip installation={site.installation} />
          </Box>
        }
      />
      <Tabs value={active} aria-label="Website sections" sx={{ mt: -2, mb: 6 }}>
        {TABS.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            label={t.label}
            id={`${tabsId}-tab-${t.value}`}
            aria-controls={`${tabsId}-panel-${t.value}`}
            component={RouterLink}
            to={`${base}/${t.value}`}
            replace
          />
        ))}
      </Tabs>
      <Box role="tabpanel" id={`${tabsId}-panel-${active}`} aria-labelledby={`${tabsId}-tab-${active}`}>
        {active === 'install' ? (
          <InstallTab website={site} settingsHref={`${base}/settings`} />
        ) : (
          <WebsiteSettingsTab website={site} installHref={`${base}/install`} />
        )}
      </Box>
    </>
  );
}

export default WebsiteDetailPage;
