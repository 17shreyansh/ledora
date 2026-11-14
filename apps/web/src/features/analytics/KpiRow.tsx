import type { AnalyticsTotals } from '@ledora/shared';
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined';
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '../../lib/a11y';
import { chart, navy, slate } from '../../theme/tokens';
import { computeDelta, formatCount, formatDecimal, formatDuration, formatExact, formatRatio, type Delta, type DeltaKind } from './format';

interface KpiSpec {
  key: keyof AnalyticsTotals;
  label: string;
  format: (value: number | null) => string;
  /** Exact value for the tooltip, when the tile shows a compact one. */
  exact?: (value: number | null) => string;
  kind?: DeltaKind;
  upIsGood?: boolean;
}

const count = (v: number | null) => (v === null ? '—' : formatCount(v));
const exactCount = (v: number | null) => (v === null ? '—' : formatExact(v));

export const PRIMARY_KPIS: KpiSpec[] = [
  { key: 'visitors', label: 'Visitors', format: count, exact: exactCount },
  { key: 'pageviews', label: 'Pageviews', format: count, exact: exactCount },
  { key: 'sessions', label: 'Sessions', format: count, exact: exactCount },
  { key: 'bounceRate', label: 'Bounce rate', format: formatRatio, kind: 'points', upIsGood: false },
  { key: 'avgSessionSeconds', label: 'Avg. session duration', format: formatDuration },
  { key: 'pagesPerSession', label: 'Pages per session', format: (v) => formatDecimal(v, 2) },
];

export const SECONDARY_KPIS: KpiSpec[] = [
  { key: 'newVisitors', label: 'New visitors', format: count, exact: exactCount },
  { key: 'events', label: 'Custom events', format: count, exact: exactCount },
];

export function DeltaBadge({ delta, size = 'medium' }: { delta: Delta; size?: 'small' | 'medium' }) {
  const color = delta.tone === 'good' ? chart.good : delta.tone === 'bad' ? chart.bad : slate[500];
  const Icon = delta.direction === 'up' ? ArrowUpwardOutlined : delta.direction === 'down' ? ArrowDownwardOutlined : null;
  return (
    <Box
      component="span"
      data-testid="kpi-delta"
      data-tone={delta.tone}
      data-direction={delta.direction}
      title={delta.description}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        color,
        fontSize: size === 'small' ? 12 : 13,
        lineHeight: '16px',
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {Icon ? <Icon aria-hidden sx={{ fontSize: size === 'small' ? 13 : 14 }} /> : null}
      <span aria-hidden>{delta.text}</span>
      <Box component="span" sx={visuallyHidden}>
        {delta.description}
      </Box>
    </Box>
  );
}

function StatTile({ spec, totals, previous, compare }: { spec: KpiSpec; totals: AnalyticsTotals; previous: AnalyticsTotals | null; compare: boolean }) {
  const value = totals[spec.key];
  const delta = computeDelta(value, previous ? previous[spec.key] : null, { kind: spec.kind, upIsGood: spec.upIsGood });
  const shown = spec.format(value);
  const exact = spec.exact?.(value);
  return (
    <Card component="li" data-testid={`kpi-${spec.key}`} sx={{ px: 4, py: 3.5, minWidth: 0, listStyle: 'none' }}>
      <Typography variant="body2" color="text.secondary" component="p" noWrap title={spec.label}>
        {spec.label}
      </Typography>
      <Typography
        component="p"
        title={exact && exact !== shown ? exact : undefined}
        sx={{ mt: 1, fontSize: 24, lineHeight: '30px', fontWeight: 600, letterSpacing: '-0.02em', color: navy[950] }}
      >
        {shown}
      </Typography>
      {compare ? (
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 16 }}>
          <DeltaBadge delta={delta} />
          <Typography component="span" sx={{ fontSize: 12, color: slate[400] }} aria-hidden>
            vs previous
          </Typography>
        </Box>
      ) : null}
    </Card>
  );
}

function SecondaryStat({ spec, totals, previous, compare }: { spec: KpiSpec; totals: AnalyticsTotals; previous: AnalyticsTotals | null; compare: boolean }) {
  const value = totals[spec.key];
  const delta = computeDelta(value, previous ? previous[spec.key] : null, { kind: spec.kind, upIsGood: spec.upIsGood });
  const shown = spec.format(value);
  const exact = spec.exact?.(value);
  return (
    <Box component="li" data-testid={`kpi-${spec.key}`} sx={{ display: 'flex', alignItems: 'baseline', gap: 2, listStyle: 'none' }}>
      <Typography variant="body2" color="text.secondary" component="span">
        {spec.label}
      </Typography>
      <Typography component="span" title={exact && exact !== shown ? exact : undefined} sx={{ fontSize: 14, fontWeight: 600, color: navy[950] }}>
        {shown}
      </Typography>
      {compare ? <DeltaBadge delta={delta} size="small" /> : null}
    </Box>
  );
}

export function KpiRow({ totals, previous, compare }: { totals: AnalyticsTotals; previous: AnalyticsTotals | null; compare: boolean }) {
  const comparing = compare && previous !== null;
  return (
    <Box component="section" aria-label="Key figures">
      <Box
        component="ul"
        sx={{
          m: 0,
          p: 0,
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' },
        }}
      >
        {PRIMARY_KPIS.map((spec) => (
          <StatTile key={spec.key} spec={spec} totals={totals} previous={previous} compare={comparing} />
        ))}
      </Box>
      <Box component="ul" sx={{ m: 0, p: 0, mt: 3, px: 1, display: 'flex', flexWrap: 'wrap', columnGap: 6, rowGap: 1.5 }}>
        {SECONDARY_KPIS.map((spec) => (
          <SecondaryStat key={spec.key} spec={spec} totals={totals} previous={previous} compare={comparing} />
        ))}
      </Box>
    </Box>
  );
}
