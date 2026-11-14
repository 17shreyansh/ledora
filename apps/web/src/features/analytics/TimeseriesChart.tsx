/*
 * The only module that imports Recharts. It is loaded with React.lazy, so Recharts and its
 * dependencies land in their own chunk and the rest of the app doesn't download them.
 */
import Box from '@mui/material/Box';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chart, navy, radii, shadows, slate } from '../../theme/tokens';
import type { ChartRow } from './chartData';
import { formatCount, formatExact } from './format';

export interface TimeseriesChartProps {
  rows: ChartRow[];
  metricLabel: string;
  compare: boolean;
  height: number;
}

function LineKey({ dashed, color }: { dashed?: boolean; color: string }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{ display: 'inline-block', width: 14, flexShrink: 0, borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }}
    />
  );
}

function ChartTooltip({ row, metricLabel, compare }: { row: ChartRow | undefined; metricLabel: string; compare: boolean }) {
  if (!row) return null;
  return (
    <Box
      sx={{
        bgcolor: 'common.white',
        border: `1px solid ${slate[150]}`,
        borderRadius: `${radii.md}px`,
        boxShadow: shadows.md,
        px: 3,
        py: 2.5,
        minWidth: 168,
        fontSize: 12,
        lineHeight: '16px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <LineKey color={chart.series} />
        <Box component="span" sx={{ fontWeight: 600, fontSize: 14, color: navy[950], fontVariantNumeric: 'tabular-nums' }}>
          {formatExact(row.value)}
        </Box>
        <Box component="span" sx={{ color: slate[500] }}>
          {metricLabel}
        </Box>
      </Box>
      <Box sx={{ color: slate[500], mt: 0.5, pl: '22px' }}>{row.longLabel}</Box>
      {compare && row.previousLabel !== null ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <LineKey dashed color={chart.comparison} />
            <Box component="span" sx={{ fontWeight: 600, fontSize: 14, color: navy[950], fontVariantNumeric: 'tabular-nums' }}>
              {row.previous === null ? '—' : formatExact(row.previous)}
            </Box>
            <Box component="span" sx={{ color: slate[500] }}>
              Previous
            </Box>
          </Box>
          <Box sx={{ color: slate[500], mt: 0.5, pl: '22px' }}>{row.previousLabel}</Box>
        </>
      ) : null}
    </Box>
  );
}

export function TimeseriesChart({ rows, metricLabel, compare, height }: TimeseriesChartProps) {
  const showDots = rows.length <= 2;
  const tick = { fill: chart.tick, fontSize: 12, fontVariantNumeric: 'tabular-nums' } as const;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer={false}>
        <CartesianGrid vertical={false} stroke={chart.grid} strokeWidth={1} />
        <XAxis
          dataKey="label"
          tick={tick}
          tickLine={false}
          axisLine={{ stroke: chart.axis }}
          interval="preserveStartEnd"
          minTickGap={24}
          tickMargin={8}
        />
        <YAxis
          tick={tick}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={44}
          tickFormatter={(v: number) => formatCount(v)}
        />
        <Tooltip
          cursor={{ stroke: slate[300], strokeWidth: 1 }}
          isAnimationActive={false}
          content={(props) => (
            <ChartTooltip row={props.active ? (props.payload?.[0]?.payload as ChartRow | undefined) : undefined} metricLabel={metricLabel} compare={compare} />
          )}
        />
        {compare ? (
          <Line
            type="linear"
            dataKey="previous"
            name="Previous period"
            stroke={chart.comparison}
            strokeWidth={2}
            strokeDasharray="4 4"
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 4, fill: chart.comparison, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
            connectNulls={false}
          />
        ) : null}
        <Area
          type="linear"
          dataKey="value"
          name={metricLabel}
          stroke={chart.series}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={chart.series}
          fillOpacity={chart.seriesFillOpacity}
          dot={showDots ? { r: 4, fill: chart.series, stroke: '#fff', strokeWidth: 2 } : false}
          activeDot={{ r: 4, fill: chart.series, stroke: '#fff', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default TimeseriesChart;
