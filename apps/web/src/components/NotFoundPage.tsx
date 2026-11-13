import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { Logo } from './Logo';

export function NotFoundPage() {
  return (
    <Box component="main" sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 4 }}>
      <Box sx={{ textAlign: 'center', maxWidth: 420 }}>
        <Logo size={28} />
        <Typography variant="overline" component="p" color="text.secondary" sx={{ mt: 10 }}>
          404
        </Typography>
        <Typography variant="h1" sx={{ mt: 1 }}>
          Page not found
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 2, mb: 6 }}>
          The page you’re looking for doesn’t exist or has moved.
        </Typography>
        <Button component={RouterLink} to="/" variant="contained">
          Go to Ledora
        </Button>
      </Box>
    </Box>
  );
}

export default NotFoundPage;
