import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@ledora/shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { useRegister } from '../../api/auth';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { PasswordField } from '../../components/PasswordField';
import { applyApiFieldErrors, hasFieldErrors } from '../../lib/formErrors';
import { safeReturnTo, withReturnTo } from '../../lib/returnTo';
import { muiField } from '../../lib/rhf';
import { AuthFooter, AuthHeading } from './AuthLayout';

const FIELDS = ['name', 'email', 'password'] as const;

export function RegisterPage() {
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const prefilledEmail = params.get('email') ?? '';
  const registerUser = useRegister();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: prefilledEmail, password: '' },
  });

  // On success the session is stored and the PublicOnly guard moves the user on to /check-email.
  const onSubmit = handleSubmit((values) => {
    registerUser.mutate(values, {
      onError: (error) => {
        applyApiFieldErrors(error, setError, FIELDS);
      },
    });
  });

  const showFormError = registerUser.error && !hasFieldErrors(registerUser.error, FIELDS);

  return (
    <>
      <AuthHeading title="Create your account" description="Set up Ledora for your team in a couple of minutes." />
      {showFormError ? <ApiErrorAlert error={registerUser.error} sx={{ mb: 5 }} /> : null}
      <Box component="form" noValidate onSubmit={onSubmit}>
        <Stack spacing={5}>
          <TextField
            label="Full name"
            autoComplete="name"
            autoFocus
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
            {...muiField(register('name'))}
          />
          <TextField
            label="Work email"
            type="email"
            autoComplete="email"
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            {...muiField(register('email'))}
          />
          <PasswordField
            label="Password"
            autoComplete="new-password"
            error={Boolean(errors.password)}
            helperText={errors.password?.message ?? 'Use at least 10 characters. A short phrase works well.'}
            {...muiField(register('password'))}
          />
          <Button type="submit" variant="contained" size="large" fullWidth loading={registerUser.isPending}>
            Create account
          </Button>
        </Stack>
      </Box>
      <AuthFooter>
        Already have an account?{' '}
        <Link
          component={RouterLink}
          to={withReturnTo('/login', returnTo, prefilledEmail ? { email: prefilledEmail } : undefined)}
        >
          Sign in
        </Link>
      </AuthFooter>
    </>
  );
}

export default RegisterPage;
