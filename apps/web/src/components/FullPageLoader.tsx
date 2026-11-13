import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

export function FullPageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <Box role="status" aria-live="polite" sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress size={24} aria-label={label} />
    </Box>
  );
}
