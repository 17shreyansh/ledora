import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useUsage } from '../../api/websites';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { SectionCard } from '../../components/SectionCard';

const numberFormat = new Intl.NumberFormat();

/** "2026-11" → "November 2026" (the usage period is a UTC calendar month). */
export function formatPeriod(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function UsageRow({ label, used, limit, showBar = false }: { label: string; used: number; limit: number; showBar?: boolean }) {
  const ratio = limit > 0 ? used / limit : 0;
  const percent = Math.min(100, Math.round(ratio * 100));
  const color = ratio >= 1 ? 'error' : ratio >= 0.8 ? 'warning' : 'primary';
  const text = `${numberFormat.format(used)} of ${numberFormat.format(limit)}`;
  return (
    <Box sx={{ py: 2.5, '& + &': { borderTop: 1, borderColor: 'divider' } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, alignItems: 'baseline' }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: ratio > 1 ? 'error.main' : 'text.primary', whiteSpace: 'nowrap' }}
        >
          {text}
        </Typography>
      </Box>
      {showBar ? (
        <LinearProgress
          variant="determinate"
          value={percent}
          color={color}
          aria-label={label}
          aria-valuetext={`${text} (${percent}%)`}
          sx={{ mt: 1.5, height: 4 }}
        />
      ) : null}
    </Box>
  );
}

/** Compact view of the organization's plan limits and what's been used this month. */
export function PlanUsageCard({ orgId }: { orgId: string }) {
  const usage = useUsage(orgId);
  const data = usage.data;
  return (
    <SectionCard
      title="Plan usage"
      description={data ? `${data.plan.name} plan · ${formatPeriod(data.period)}` : undefined}
    >
      {usage.isError && !data ? (
        <ApiErrorAlert
          error={usage.error}
          title="Couldn’t load plan usage"
          action={
            <Button color="inherit" size="small" onClick={() => void usage.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !data ? (
        <Box sx={{ display: 'grid', gap: 3 }} aria-busy="true" aria-label="Loading plan usage">
          <Skeleton variant="text" height={20} />
          <Skeleton variant="text" height={20} />
          <Skeleton variant="text" height={20} />
        </Box>
      ) : (
        <>
          <Box sx={{ my: -2.5 }}>
            <UsageRow label="Websites" used={data.usage.websites} limit={data.limits.websites} />
            <UsageRow label="Events this month" used={data.usage.monthlyEvents} limit={data.limits.monthlyEvents} showBar />
            <UsageRow label="Team members" used={data.usage.teamMembers} limit={data.limits.teamMembers} />
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 4 }}>
            Analytics are kept for {numberFormat.format(data.limits.analyticsRetentionDays)} days. Event counts reset at the start of each
            month (UTC).
          </Typography>
        </>
      )}
    </SectionCard>
  );
}
