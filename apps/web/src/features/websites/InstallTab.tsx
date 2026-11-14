import type { WebsiteDto } from '@ledora/shared';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import CodeOutlined from '@mui/icons-material/CodeOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import WebOutlined from '@mui/icons-material/WebOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { queryKeys } from '../../api/queryKeys';
import { useWebsite, useWebsiteStats } from '../../api/websites';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { CopyButton } from '../../components/CopyButton';
import { SectionCard } from '../../components/SectionCard';
import { visuallyHidden } from '../../lib/a11y';
import { formatDateTime, formatRelative } from '../../lib/format';
import { buildInstallSnippet } from '../../lib/sdkSnippet';
import { purple, status as statusColors } from '../../theme/tokens';
import { useCurrentOrg } from '../organizations/OrgContext';

const STATS_REFRESH_MS = 30_000;
const numberFormat = new Intl.NumberFormat();
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });

function Step({ number, title, children, last = false }: { number: number; title: string; children: ReactNode; last?: boolean }) {
  return (
    <Box component="li" sx={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', columnGap: 4, position: 'relative' }}>
      <Box
        aria-hidden
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: purple[50],
          color: purple[700],
          border: `1px solid ${purple[200]}`,
          fontSize: 13,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {number}
      </Box>
      {last ? null : (
        <Box aria-hidden sx={{ position: 'absolute', left: 13.5, top: 34, bottom: 6, width: '1px', bgcolor: 'divider' }} />
      )}
      <Box sx={{ minWidth: 0, pb: last ? 0 : 7 }}>
        <Typography variant="h4" component="h3" sx={{ lineHeight: '28px' }}>
          <Box component="span" sx={visuallyHidden}>
            {`Step ${number}: `}
          </Box>
          {title}
        </Typography>
        <Box sx={{ mt: 2 }}>{children}</Box>
      </Box>
    </Box>
  );
}

function SnippetBlock({ snippet }: { snippet: string }) {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: '8px', bgcolor: 'slate.25', overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: 3,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          HTML
        </Typography>
        <CopyButton text={snippet} label="Copy snippet" copiedMessage="Snippet copied. Paste it into your site’s header." />
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          px: 4,
          py: 3,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 13,
          lineHeight: '20px',
          color: 'navy.950',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        <code data-testid="install-snippet">{snippet}</code>
      </Box>
    </Box>
  );
}

function Note({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 3, p: 3, border: 1, borderColor: 'divider', borderRadius: '8px', minWidth: 0 }}>
      <Box aria-hidden sx={{ color: 'slate.500', '& svg': { fontSize: 18 }, mt: 0.25 }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {children}
        </Typography>
      </Box>
    </Box>
  );
}

function StatTile({ label, value, loading, sub }: { label: string; value: ReactNode; loading: boolean; sub?: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {loading ? (
        <Skeleton variant="text" width={48} height={28} sx={{ mt: 1 }} />
      ) : (
        <Typography sx={{ mt: 0.5, fontSize: 20, lineHeight: '28px', fontWeight: 600, color: 'navy.950', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </Typography>
      )}
      {sub ? (
        <Typography variant="caption" color="text.secondary" component="p">
          {sub}
        </Typography>
      ) : null}
    </Box>
  );
}

function DomainList({ domains }: { domains: string[] }) {
  return (
    <>
      {domains.map((d, i) => (
        <span key={d}>
          {i > 0 ? (i === domains.length - 1 ? ' and ' : ', ') : null}
          <Box component="strong" sx={{ fontWeight: 600, wordBreak: 'break-all' }}>
            {d}
          </Box>
        </span>
      ))}
    </>
  );
}

function VerificationPanel({ website: initial, settingsHref }: { website: WebsiteDto; settingsHref: string }) {
  const { org } = useCurrentOrg();
  const queryClient = useQueryClient();
  // Polls every few seconds while not installed; stops by itself once verified or when this tab closes.
  const live = useWebsite(org.id, initial.id, { pollUntilVerified: true });
  const website = live.data ?? initial;
  const verified = website.installation.status === 'verified';
  const stats = useWebsiteStats(org.id, website.id, { refetchInterval: STATS_REFRESH_MS });
  const [checking, setChecking] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);

  // When the status flips to verified, refresh the numbers and the websites list right away.
  const previousStatus = useRef(website.installation.status);
  useEffect(() => {
    if (previousStatus.current !== 'verified' && website.installation.status === 'verified') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.websiteStats(org.id, website.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.websites(org.id), exact: true });
    }
    previousStatus.current = website.installation.status;
  }, [org.id, queryClient, website.id, website.installation.status]);

  const checkNow = async () => {
    setChecking(true);
    try {
      await Promise.all([live.refetch(), stats.refetch()]);
    } finally {
      setChecking(false);
      setCheckedOnce(true);
    }
  };

  const lastChecked = live.dataUpdatedAt ? timeFormat.format(new Date(live.dataUpdatedAt)) : null;
  const statsData = stats.data;

  return (
    <SectionCard
      title="Verification"
      description={verified ? 'Ledora is receiving visits from this website.' : 'We check for the first visit automatically.'}
      action={
        <Button
          variant="outlined"
          color="neutral"
          size="small"
          startIcon={<RefreshOutlined />}
          loading={checking}
          loadingPosition="start"
          onClick={() => void checkNow()}
        >
          Check now
        </Button>
      }
    >
      <Box aria-live="polite" aria-atomic="true">
        {verified ? (
          <Box
            sx={{
              display: 'flex',
              gap: 3,
              p: 4,
              borderRadius: '8px',
              bgcolor: statusColors.success.bg,
              border: `1px solid ${statusColors.success.border}`,
            }}
          >
            <CheckCircleOutlined sx={{ color: statusColors.success.main, fontSize: 22 }} aria-hidden />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14, color: '#0A4F33' }}>Ledora is installed</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: '#0A4F33' }}>
                {website.installation.firstSeenAt ? (
                  <>
                    First visit received{' '}
                    <time dateTime={website.installation.firstSeenAt}>{formatDateTime(website.installation.firstSeenAt)}</time>
                  </>
                ) : (
                  'Visits are arriving'
                )}
                {website.installation.sdkVersion ? ` · SDK version ${website.installation.sdkVersion}` : ''}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 3, p: 4, borderRadius: '8px', bgcolor: 'slate.25', border: 1, borderColor: 'divider' }}>
            <Box
              aria-hidden
              sx={{
                mt: '6px',
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: purple[500],
                flexShrink: 0,
                animation: 'ledora-pulse 1.6s ease-in-out infinite',
                '@keyframes ledora-pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Waiting for the first visit</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {checkedOnce && !checking ? 'No visits yet. ' : ''}
                This updates on its own every few seconds while this page is open
                {lastChecked ? (
                  <>
                    {' '}
                    (last checked <time>{lastChecked}</time>)
                  </>
                ) : null}
                .
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {live.isError ? <ApiErrorAlert error={live.error} title="Couldn’t check the installation" sx={{ mt: 4 }} /> : null}

      <Box sx={{ mt: 5 }}>
        <Typography variant="overline" color="text.secondary" component="h3" sx={{ display: 'block', mb: 3 }}>
          Last 24 hours
        </Typography>
        {stats.isError ? (
          <ApiErrorAlert error={stats.error} title="Couldn’t load recent numbers" />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 4 }}>
            <StatTile label="Page views" loading={stats.isPending} value={statsData ? numberFormat.format(statsData.pageviewsLast24h) : '—'} />
            <StatTile label="All events" loading={stats.isPending} value={statsData ? numberFormat.format(statsData.eventsLast24h) : '—'} />
            <StatTile
              label="Last event"
              loading={stats.isPending}
              value={
                statsData?.lastEventAt ? (
                  <time dateTime={statsData.lastEventAt} title={formatDateTime(statsData.lastEventAt)}>
                    {formatRelative(statsData.lastEventAt)}
                  </time>
                ) : (
                  'None yet'
                )
              }
            />
          </Box>
        )}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 5 }}>
        Only visits to <DomainList domains={website.allowedDomains} /> are accepted.{' '}
        <Link component={RouterLink} to={settingsHref}>
          Change allowed domains
        </Link>
      </Typography>
    </SectionCard>
  );
}

export function InstallTab({ website, settingsHref }: { website: WebsiteDto; settingsHref: string }) {
  const snippet = buildInstallSnippet(website.siteKey);
  const { consentRequired, respectDoNotTrack } = website.tracking;

  return (
    <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' }, alignItems: 'start' }}>
      <SectionCard
        title={`Install Ledora on ${website.name}`}
        description="Three steps, about five minutes. You don’t need to be a developer."
      >
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          <Step number={1} title="Copy your snippet">
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              This one line of code is unique to {website.name}. It tells Ledora which website a visit belongs to.
            </Typography>
            <SnippetBlock snippet={snippet} />
          </Step>
          <Step number={2} title="Paste it on every page of your site">
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Put it just before the closing{' '}
              <Box component="code" sx={{ fontSize: 12, px: 1, py: 0.25, bgcolor: 'slate.50', border: 1, borderColor: 'divider', borderRadius: '4px' }}>
                {'</head>'}
              </Box>{' '}
              tag, so it’s on every page you want counted.
            </Typography>
            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <Note icon={<WebOutlined />} title="Using a website builder or CMS">
                Look for a setting called “Custom code”, “Header code” or “Code injection” (WordPress, Shopify, Wix, Squarespace and
                Webflow all have one) and paste the snippet into the header section.
              </Note>
              <Note icon={<CodeOutlined />} title="Working with a developer">
                Send them the snippet. It belongs in the shared page template, before {'</head>'}. It loads asynchronously, so it doesn’t
                hold up the page.
              </Note>
            </Box>
          </Step>
          <Step number={3} title="Open your website to verify" last>
            <Typography variant="body2" color="text.secondary">
              Visit any page of your site in a normal browser window. As soon as Ledora receives that first visit — yours counts — this
              website is marked as verified. Nothing is marked verified until a real visit arrives.
            </Typography>
            {consentRequired || respectDoNotTrack ? (
              <Alert severity="info" sx={{ mt: 3 }}>
                {consentRequired
                  ? 'This website asks visitors for consent first, so a visit is only recorded after someone accepts tracking. '
                  : ''}
                {respectDoNotTrack
                  ? 'If your browser sends Do Not Track or Global Privacy Control, your own visit won’t be counted — try another browser if verification doesn’t happen.'
                  : ''}
              </Alert>
            ) : null}
          </Step>
        </Box>
      </SectionCard>

      <VerificationPanel website={website} settingsHref={settingsHref} />
    </Box>
  );
}
