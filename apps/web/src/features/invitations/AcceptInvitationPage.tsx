import { ROLE_DESCRIPTIONS } from '@ledora/shared';
import GroupAddOutlined from '@mui/icons-material/GroupAddOutlined';
import LinkOffOutlined from '@mui/icons-material/LinkOffOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router';
import { useLogout, useSession } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useAcceptInvitation, useInvitationPreview } from '../../api/organizations';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { RoleChip } from '../../components/RoleChip';
import { formatDate } from '../../lib/format';
import { withReturnTo } from '../../lib/returnTo';
import { AuthHeading } from '../auth/AuthLayout';
import { StatusIcon } from '../auth/StatusIcon';

export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const here = `/invitations/accept?token=${encodeURIComponent(token)}`;
  const session = useSession();
  // Preview is a POST; wait for the session so a signed-in request carries its CSRF token.
  const preview = useInvitationPreview(token, !session.isPending);
  const accept = useAcceptInvitation();
  const logout = useLogout();
  const navigate = useNavigate();
  const user = session.data?.user ?? null;

  if (!token || (preview.isError && preview.error instanceof ApiError && preview.error.status === 400)) {
    return (
      <>
        <StatusIcon tone="warning">
          <LinkOffOutlined />
        </StatusIcon>
        <AuthHeading
          title="This invitation isn’t valid"
          description="It may have expired, been revoked, or already been used. Ask the person who invited you to send a new one."
        />
        <Button component={RouterLink} to="/" variant="outlined" color="neutral" size="large" fullWidth>
          Go to Ledora
        </Button>
      </>
    );
  }

  if (session.isPending || preview.isPending) {
    return (
      <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <CircularProgress size={20} />
        <Typography>Loading invitation…</Typography>
      </Box>
    );
  }

  if (preview.isError) {
    return (
      <ApiErrorAlert
        error={preview.error}
        title="We couldn’t load this invitation"
        action={
          <Button color="inherit" size="small" onClick={() => void preview.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const invite = preview.data;
  const emailMatches = user ? user.email.toLowerCase() === invite.email.toLowerCase() : false;

  const header = (
    <>
      <StatusIcon tone="brand">
        <GroupAddOutlined />
      </StatusIcon>
      <AuthHeading
        title={`Join ${invite.organizationName}`}
        description={
          <>
            You’ve been invited to join <strong>{invite.organizationName}</strong> on Ledora.
          </>
        }
      />
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: '12px', p: 4, mb: 6, display: 'grid', gap: 2.5 }}>
        <Row label="Invited email">
          <Typography sx={{ fontWeight: 500, wordBreak: 'break-all' }}>{invite.email}</Typography>
        </Row>
        <Row label="Role">
          <RoleChip role={invite.role} />
        </Row>
        <Typography variant="body2" color="text.secondary">
          {ROLE_DESCRIPTIONS[invite.role]}
        </Typography>
        <Typography variant="caption">Expires {formatDate(invite.expiresAt)}</Typography>
      </Box>
    </>
  );

  if (!user) {
    return (
      <>
        {header}
        <Stack spacing={3}>
          <Button component={RouterLink} to={withReturnTo('/login', here, { email: invite.email })} variant="contained" size="large" fullWidth>
            Sign in to accept
          </Button>
          <Button
            component={RouterLink}
            to={withReturnTo('/register', here, { email: invite.email })}
            variant="outlined"
            color="neutral"
            size="large"
            fullWidth
          >
            Create an account
          </Button>
        </Stack>
      </>
    );
  }

  if (!emailMatches) {
    return (
      <>
        {header}
        <Alert severity="warning" sx={{ mb: 5 }}>
          This invitation was sent to <strong>{invite.email}</strong>, but you’re signed in as <strong>{user.email}</strong>. Sign in with
          the invited address to accept it.
        </Alert>
        <Stack spacing={3}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            loading={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSettled: () => void navigate(withReturnTo('/login', here, { email: invite.email }), { replace: true }),
              })
            }
          >
            Sign out and switch account
          </Button>
          <Button component={RouterLink} to="/" variant="outlined" color="neutral" size="large" fullWidth>
            Not now
          </Button>
        </Stack>
      </>
    );
  }

  if (!user.emailVerified) {
    return (
      <>
        {header}
        <Alert severity="info" sx={{ mb: 5 }}>
          Verify your email address before joining. We’ll bring you back here afterwards.
        </Alert>
        <Button component={RouterLink} to={withReturnTo('/check-email', here)} variant="contained" size="large" fullWidth>
          Verify my email
        </Button>
      </>
    );
  }

  return (
    <>
      {header}
      {accept.error ? <ApiErrorAlert error={accept.error} sx={{ mb: 5 }} /> : null}
      <Stack spacing={3}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          loading={accept.isPending}
          onClick={() =>
            accept.mutate(token, {
              onSuccess: ({ organization }) => void navigate(`/o/${organization.id}`, { replace: true }),
            })
          }
        >
          Accept and join
        </Button>
        <Button component={RouterLink} to="/" variant="outlined" color="neutral" size="large" fullWidth disabled={accept.isPending}>
          Not now
        </Button>
      </Stack>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Box>
  );
}

export default AcceptInvitationPage;
