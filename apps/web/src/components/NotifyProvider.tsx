import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Severity = 'success' | 'info' | 'error';
interface Notice {
  id: number;
  message: string;
  severity: Severity;
}

type Notify = (message: string, severity?: Severity) => void;

const NotifyContext = createContext<Notify | null>(null);

/** App-wide snackbar for success/failure confirmations. */
export function NotifyProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [open, setOpen] = useState(false);

  const notify = useCallback<Notify>((message, severity = 'success') => {
    setNotice({ id: Date.now(), message, severity });
    setOpen(true);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <NotifyContext.Provider value={value}>
      {children}
      <Snackbar
        key={notice?.id}
        open={open}
        autoHideDuration={notice?.severity === 'error' ? 8000 : 5000}
        onClose={(_event, reason) => {
          if (reason !== 'clickaway') setOpen(false);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={notice?.severity ?? 'success'}
          variant="standard"
          sx={{ minWidth: 280, boxShadow: 4, alignItems: 'center' }}
        >
          {notice?.message}
        </Alert>
      </Snackbar>
    </NotifyContext.Provider>
  );
}

export function useNotify(): Notify {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error('useNotify must be used inside <NotifyProvider>');
  return ctx;
}
