import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const LOGO_SRC = '/ledora-logo.svg';

/** The brand mark, rendered from the original SVG as-is (never recoloured or redrawn). */
export function LogoMark({ size = 28, decorative = true }: { size?: number; decorative?: boolean }) {
  return (
    <Box
      component="img"
      src={LOGO_SRC}
      alt={decorative ? '' : 'Ledora'}
      width={size}
      height={size}
      sx={{ display: 'block', flexShrink: 0, width: size, height: size }}
    />
  );
}

/** Logo mark plus the "Ledora" wordmark set in Inter. */
export function Logo({ size = 28, tone = 'dark' }: { size?: number; tone?: 'dark' | 'light' }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 2.5 }}>
      <LogoMark size={size} />
      <Typography
        component="span"
        sx={{
          fontSize: Math.round(size * 0.66),
          fontWeight: 650,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: tone === 'light' ? 'common.white' : 'navy.950',
        }}
      >
        Ledora
      </Typography>
    </Box>
  );
}
