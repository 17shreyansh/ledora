import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@ledora/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useLocation, useSearchParams } from 'react-router';
import { useLogin } from '../../api/auth';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { PasswordField } from '../../components/PasswordField';
import { applyApiFieldErrors, hasFieldErrors } from '../../lib/formErrors';
import { safeReturnTo, withReturnTo } from '../../lib/returnTo';
import { muiField } from '../../lib/rhf';
import { AuthFooter, AuthHeading } from './AuthLayout';

function readNotice(state: unknown): string | null {
  if (typeof state === 'object' && state !== null && 'notice' in state) {
    const notice = (state as { notice: unknown }).notice;
    return typeof notice === 'string' ? notice : null;
  }
  return null;
}

const FIELDS = ['email', 'password'] as const;

export function LoginPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const notice = readNotice(location.state);
  const returnTo = safeReturnTo(params.get('returnTo'));
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: params.get('email') ?? '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onError: (error) => {
        applyApiFieldErrors(error, setError, FIELDS);
      },
    });
  });

  const showFormError = login.error && !hasFieldErrors(login.error, FIELDS);

  return (
    <>
      <AuthHeading title="Sign in to Ledora" description="Welcome back. Enter your details to continue." />
      {notice ? (
        <Alert severity="success" sx={{ mb: 5 }}>
          {notice}
        </Alert>
      ) : null}
      {showFormError ? <ApiErrorAlert error={login.error} sx={{ mb: 5 }} /> : null}
      <Box component="form" noValidate onSubmit={onSubmit}>
        <Stack spacing={5}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus={!params.get('email')}
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            {...muiField(register('email'))}
          />
          <Box>
            <PasswordField
              label="Password"
              autoComplete="current-password"
              autoFocus={Boolean(params.get('email'))}
              error={Boolean(errors.password)}
              helperText={errors.password?.message}
              {...muiField(register('password'))}
            />
            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Link component={RouterLink} to="/forgot-password" variant="body2">
                Forgot password?
              </Link>
            </Box>
          </Box>
          <Button type="submit" variant="contained" size="large" fullWidth loading={login.isPending}>
            Sign in
          </Button>
        </Stack>
      </Box>
      <AuthFooter>
        New to Ledora?{' '}
        <Link component={RouterLink} to={withReturnTo('/register', returnTo, params.get('email') ? { email: params.get('email') ?? '' } : undefined)}>
          Create an account
        </Link>
      </AuthFooter>
    </>
  );
}

export default LoginPage;
