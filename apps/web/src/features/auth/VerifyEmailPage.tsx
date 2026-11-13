import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import LinkOffOutlined from '@mui/icons-material/LinkOffOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { useSession, useVerifyEmail } from '../../api/auth';
import { ApiError } from '../../api/client';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { AuthHeading } from './AuthLayout';
import { StatusIcon } from './StatusIcon';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const session = useSession();
  // Wait for the session probe so a signed-in request carries its CSRF token.
  const verify = useVerifyEmail(token, !session.isPending);
  const user = session.data?.user;

  if (!token) {
    return (
      <>
        <StatusIcon tone="warning">
          <LinkOffOutlined />
        </StatusIcon>
        <AuthHeading title="This link is incomplete" description="Open the verification link straight from the email we sent you." />
        <Button component={RouterLink} to={user ? '/check-email' : '/login'} variant="contained" size="large" fullWidth>
          {user ? 'Send a new link' : 'Sign in'}
        </Button>
      </>
    );
  }

  if (verify.isPending) {
    return (
      <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <CircularProgress size={20} />
        <Typography>Verifying your email address…</Typography>
      </Box>
    );
  }

  if (verify.isError) {
    const invalid = verify.error instanceof ApiError && verify.error.code === 'TOKEN_INVALID';
    const alreadyVerified = Boolean(user?.emailVerified);
    return (
      <>
        <StatusIcon tone="warning">
          <LinkOffOutlined />
        </StatusIcon>
        <AuthHeading
          title={alreadyVerified ? 'Your email is already verified' : 'We couldn’t verify your email'}
          description={
            alreadyVerified
              ? 'This link has already been used. You’re all set.'
              : invalid
                ? 'This verification link is invalid or has expired. Links can only be used once, and only the newest one works.'
                : undefined
          }
        />
        {!invalid && !alreadyVerified ? <ApiErrorAlert error={verify.error} sx={{ mb: 5 }} /> : null}
        {alreadyVerified ? (
          <Button component={RouterLink} to="/" variant="contained" size="large" fullWidth>
            Continue
          </Button>
        ) : user ? (
          <Button component={RouterLink} to="/check-email" variant="contained" size="large" fullWidth>
            Send a new link
          </Button>
        ) : (
          <Button component={RouterLink} to="/login" variant="contained" size="large" fullWidth>
            Sign in to request a new link
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      <StatusIcon tone="success">
        <CheckCircleOutlined />
      </StatusIcon>
      <AuthHeading
        title="Email verified"
        description={user ? 'Thanks for confirming your address. You can now create or join organizations.' : 'Thanks for confirming your address. Sign in to continue.'}
      />
      <Button component={RouterLink} to={user ? '/' : '/login'} variant="contained" size="large" fullWidth>
        Continue
      </Button>
    </>
  );
}

export default VerifyEmailPage;
