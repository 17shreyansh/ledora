import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema } from '@ledora/shared';
import LinkOffOutlined from '@mui/icons-material/LinkOffOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { useResetPassword } from '../../api/auth';
import { ApiError } from '../../api/client';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { PasswordField } from '../../components/PasswordField';
import { applyApiFieldErrors, hasFieldErrors } from '../../lib/formErrors';
import { muiField } from '../../lib/rhf';
import { AuthFooter, AuthHeading } from './AuthLayout';
import { StatusIcon } from './StatusIcon';

const formSchema = resetPasswordSchema
  .pick({ password: true })
  .extend({ confirmPassword: z.string().min(1, 'Confirm your new password') })
  .refine((v) => v.password === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const reset = useResetPassword();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(formSchema), defaultValues: { password: '', confirmPassword: '' } });

  const tokenLooksValid = resetPasswordSchema.shape.token.safeParse(token).success;
  const tokenRejected = reset.error instanceof ApiError && (reset.error.code === 'TOKEN_INVALID' || Boolean(reset.error.fields?.token));

  if (!tokenLooksValid || tokenRejected) {
    return (
      <>
        <StatusIcon tone="warning">
          <LinkOffOutlined />
        </StatusIcon>
        <AuthHeading
          title="This reset link doesn’t work"
          description={
            tokenRejected
              ? 'The link is invalid, has expired, or was already used. Request a new one and use the latest email we send.'
              : 'The link is incomplete. Open it straight from the email, or request a new one.'
          }
        />
        <Button component={RouterLink} to="/forgot-password" variant="contained" size="large" fullWidth>
          Request a new link
        </Button>
        <AuthFooter>
          <Link component={RouterLink} to="/login">
            Back to sign in
          </Link>
        </AuthFooter>
      </>
    );
  }

  const onSubmit = handleSubmit(({ password }) => {
    reset.mutate(
      { token, password },
      {
        onSuccess: () =>
          void navigate('/login', {
            replace: true,
            state: { notice: 'Your password has been reset. Sign in with your new password.' },
          }),
        onError: (error) => applyApiFieldErrors(error, setError, ['password']),
      },
    );
  });

  return (
    <>
      <AuthHeading
        title="Choose a new password"
        description="For your security, you’ll be signed out everywhere once the password is changed."
      />
      {reset.error && !hasFieldErrors(reset.error, ['password']) ? <ApiErrorAlert error={reset.error} sx={{ mb: 5 }} /> : null}
      <Box component="form" noValidate onSubmit={onSubmit}>
        <Stack spacing={5}>
          <PasswordField
            label="New password"
            autoComplete="new-password"
            autoFocus
            error={Boolean(errors.password)}
            helperText={errors.password?.message ?? 'Use at least 10 characters.'}
            {...muiField(register('password'))}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            error={Boolean(errors.confirmPassword)}
            helperText={errors.confirmPassword?.message}
            {...muiField(register('confirmPassword'))}
          />
          <Button type="submit" variant="contained" size="large" fullWidth loading={reset.isPending}>
            Reset password
          </Button>
        </Stack>
      </Box>
    </>
  );
}

export default ResetPasswordPage;
