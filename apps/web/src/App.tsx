import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { Suspense, type ReactNode } from 'react';
import { FullPageLoader } from './components/FullPageLoader';
import { NotifyProvider } from './components/NotifyProvider';
import { theme } from './theme';

/** Global providers shared by the app and by tests. */
export function AppProviders({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <NotifyProvider>
          <Suspense fallback={<FullPageLoader />}>{children}</Suspense>
        </NotifyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
