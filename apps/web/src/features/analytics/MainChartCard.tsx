import type { AnalyticsOverviewDto } from '@ledora/shared';
import TableChartOutlined from '@mui/icons-material/TableChartOutlined';
import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { lazy, Suspense, useId, useMemo, useState } from 'react';
import { SectionCard } from '../../components/SectionCard';
import { visuallyHidden } from '../../lib/a11y';
import { chart, purple, radii, slate } from '../../theme/tokens';
import { buildChartRows, METRIC_LABELS, type ChartRow, type SeriesMetric } from './chartData';
import { formatExact, formatPeriod } from './format';

const TimeseriesChart = lazy(() => import('./TimeseriesChart'));

const CHART_HEIGHT = 280;
const METRICS: SeriesMetric[] = ['visitors', 'pageviews', 'sessions'];

function LegendItem({ label, detail, dashed, color }: { label: string; detail?: string; dashed?: boolean; color: string }) {
  return (
    <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 12, color: slate[600] }}>
      <Box component="span" aria-hidden sx={{ width: 16, borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
      <span>{label}</span>
      {detail ? (
        <Box component="span" sx={{ color: slate[500] }}>
          {detail}
        </Box>
      ) : null}
    </Box>
  );
}

/** The chart's data as a table: visually hidden for screen readers, or shown on request. */
export function SeriesTable({
  rows,
  metricLabel,
  compare,
  caption,
  visible,
  unit,
}: {
  unit: 'hour' | 'day';
  rows: ChartRow[];
  metricLabel: string;
  compare: boolean;
  caption: string;
  visible: boolean;
}) {
  return (
    <TableContainer sx={visible ? { maxHeight: CHART_HEIGHT + 24, overflowY: 'auto' } : visuallyHidden} data-testid="series-table">
      <Table stickyHeader={visible}>
        <Box component="caption" sx={visuallyHidden}>
          {caption}
        </Box>
        <TableHead>
          <TableRow>
            <TableCell>{unit === 'hour' ? 'Hour' : 'Date'}</TableCell>
            <TableCell align="right">{metricLabel}</TableCell>
            {compare ? <TableCell>Previous period</TableCell> : null}
            {compare ? <TableCell align="right">Previous {metricLabel.toLowerCase()}</TableCell> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.t}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.longLabel}</TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatExact(row.value)}
              </TableCell>
              {compare ? <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{row.previousLabel ?? '—'}</TableCell> : null}
              {compare ? (
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                  {row.previous === null ? '—' : formatExact(row.previous)}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function MainChartCard({ overview, compare }: { overview: AnalyticsOverviewDto; compare: boolean }) {
  const [metric, setMetric] = useState<SeriesMetric>('visitors');
  const [showTable, setShowTable] = useState(false);
  const descriptionId = useId();
  const comparing = compare && Boolean(overview.previousSeries && overview.previousRange);
  const rows = useMemo(() => buildChartRows(overview, metric, comparing), [overview, metric, comparing]);
  const metricLabel = METRIC_LABELS[metric];
  const { range, previousRange } = overview;
  const unit = range.granularity === 'hour' ? 'hour' : 'day';
  const period = formatPeriod(range.fromDate, range.toDate);
  const previousPeriod = previousRange ? formatPeriod(previousRange.fromDate, previousRange.toDate) : '';
  const peak = rows.reduce<ChartRow | null>((best, r) => (best === null || r.value > best.value ? r : best), null);
  const caption = `${metricLabel} per ${unit}, ${period} (${range.timezone})${comparing ? `, compared with ${previousPeriod}` : ''}`;
  const summary =
    `${caption}. ${rows.length} ${unit}s` +
    (peak ? `; highest ${formatExact(peak.value)} on ${peak.longLabel}` : '') +
    `. The data table below lists every value.`;

  return (
    <SectionCard
      title={`${metricLabel} over time`}
      description={`${unit === 'hour' ? 'Hourly' : 'Daily'} · ${period} · ${range.timezone}`}
      action={
        <ToggleButtonGroup
          exclusive
          size="small"
          value={metric}
          onChange={(_, next: SeriesMetric | null) => next && setMetric(next)}
          aria-label="Metric"
          sx={{
            bgcolor: slate[50],
            p: 0.5,
            borderRadius: `${radii.md}px`,
            border: `1px solid ${slate[150]}`,
            gap: 0.5,
            '& .MuiToggleButton-root': {
              border: 0,
              borderRadius: `${radii.sm}px !important`,
              px: 2.5,
              py: 0.5,
              height: 28,
              fontSize: 13,
              fontWeight: 500,
              textTransform: 'none',
              color: slate[600],
              '&.Mui-selected': { bgcolor: 'common.white', color: 'navy.950', boxShadow: '0 1px 2px rgba(7,18,37,0.08)', '&:hover': { bgcolor: 'common.white' } },
            },
          }}
        >
          {METRICS.map((m) => (
            <ToggleButton key={m} value={m}>
              {METRIC_LABELS[m]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap', mb: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
            {formatExact(overview.totals[metric])}
          </Box>{' '}
          {metricLabel.toLowerCase()} in this period
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {comparing ? (
            <Box component="ul" aria-label="Legend" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <LegendItem label="This period" color={chart.series} />
              <LegendItem label="Previous period" detail={previousPeriod} dashed color={chart.comparison} />
            </Box>
          ) : null}
          <Button
            size="small"
            color="neutral"
            variant="text"
            startIcon={showTable ? <ShowChartOutlined /> : <TableChartOutlined />}
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
          >
            {showTable ? 'Chart' : 'Table'}
          </Button>
        </Box>
      </Box>

      {!showTable ? (
        <Box role="img" aria-describedby={descriptionId} aria-label={`${metricLabel} chart`} sx={{ height: CHART_HEIGHT, mx: -1 }}>
          <Suspense fallback={<Box sx={{ height: CHART_HEIGHT, borderRadius: `${radii.md}px`, bgcolor: purple[50], opacity: 0.4 }} />}>
            <TimeseriesChart rows={rows} metricLabel={metricLabel} compare={comparing} height={CHART_HEIGHT} />
          </Suspense>
        </Box>
      ) : null}
      <Box id={descriptionId} sx={visuallyHidden}>
        {summary}
      </Box>
      <SeriesTable unit={unit} rows={rows} metricLabel={metricLabel} compare={comparing} caption={caption} visible={showTable} />
    </SectionCard>
  );
}
