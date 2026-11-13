import MarkEmailUnreadOutlined from '@mui/icons-material/MarkEmailUnreadOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useLogout, useResendVerification, useSession } from '../../api/auth';
import { ApiError } from '../../api/client';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { safeReturnTo } from '../../lib/returnTo';
import { AuthHeading } from './AuthLayout';
import { StatusIcon } from './StatusIcon';

const COOLDOWN_SECONDS = 60;

function useCountdown() {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) setUntil(null);
    }, 1000);
    return () => window.clearInterval(id);
  }, [until]);
  const remaining = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
  const start = (seconds: number) => {
    const t = Date.now();
    setNow(t);
    setUntil(t + seconds * 1000);
  };
  return { remaining, start };
}

export function CheckEmailPage() {
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const session = useSession();
  const resend = useResendVerification();
  const logout = useLogout();
  const navigate = useNavigate();
  const { remaining, start } = useCountdown();
  const [sent, setSent] = useState(false);
  const [notYet, setNotYet] = useState(false);
  const { refetch } = session;

  // When the user verifies in another tab and comes back, notice it straight away.
  useEffect(() => {
    const onFocus = () => void refetch();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refetch]);

  const user = session.data?.user;
  if (!user) return null; // RequireAuth handles the signed-out case.
  if (user.emailVerified) return <Navigate to={returnTo ?? '/'} replace />;

  const rateLimited = resend.error instanceof ApiError && resend.error.code === 'RATE_LIMITED';

  const onResend = () => {
    setSent(false);
    setNotYet(false);
    resend.mutate(undefined, {
      onSuccess: () => {
        setSent(true);
        start(COOLDOWN_SECONDS);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'RATE_LIMITED') start(COOLDOWN_SECONDS);
      },
    });
  };

  return (
    <>
      <StatusIcon tone="brand">
        <MarkEmailUnreadOutlined />
      </StatusIcon>
      <AuthHeading
        title="Verify your email"
        description={
          <>
            We sent a verification link to <strong>{user.email}</strong>. Open it to confirm your address — you’ll need a verified
            email to create or join an organization.
          </>
        }
      />
      {notYet && !sent ? (
        <Alert severity="info" sx={{ mb: 5 }}>
          Your address isn’t verified yet. Open the newest link in your inbox, then try again.
        </Alert>
      ) : null}
      {sent ? (
        <Alert severity="success" sx={{ mb: 5 }}>
          A new link is on its way. Only the newest link works.
        </Alert>
      ) : null}
      {rateLimited ? (
        <Alert severity="warning" sx={{ mb: 5 }}>
          {resend.error?.message}
        </Alert>
      ) : resend.error ? (
        <ApiErrorAlert error={resend.error} sx={{ mb: 5 }} />
      ) : null}
      <Stack spacing={3}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          loading={session.isRefetching}
          onClick={() =>
            void refetch().then((result) => {
              if (result.data?.user.emailVerified) void navigate(returnTo ?? '/', { replace: true });
              else setNotYet(true);
            })
          }
        >
          I’ve verified my email
        </Button>
        <Button
          variant="outlined"
          color="neutral"
          size="large"
          fullWidth
          onClick={onResend}
          loading={resend.isPending}
          disabled={remaining > 0}
        >
          {remaining > 0 ? `Resend email in ${remaining}s` : 'Resend verification email'}
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 7, textAlign: 'center' }}>
        Wrong address?{' '}
        <Link
          component="button"
          type="button"
          sx={{ verticalAlign: 'baseline' }}
          onClick={() => logout.mutate(undefined, { onSettled: () => void navigate('/register', { replace: true }) })}
        >
          Sign out and start again
        </Link>
      </Typography>
    </>
  );
}

export default CheckEmailPage;
