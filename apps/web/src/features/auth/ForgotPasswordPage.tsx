import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@ledora/shared';
import MarkEmailReadOutlined from '@mui/icons-material/MarkEmailReadOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useForm } from 'react-hook-form';
import { Link as RouterLink } from 'react-router';
import { useForgotPassword } from '../../api/auth';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { applyApiFieldErrors, hasFieldErrors } from '../../lib/formErrors';
import { muiField } from '../../lib/rhf';
import { AuthFooter, AuthHeading } from './AuthLayout';
import { StatusIcon } from './StatusIcon';

export function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit((values) => {
    forgot.mutate(values, { onError: (error) => applyApiFieldErrors(error, setError, ['email']) });
  });

  if (forgot.isSuccess) {
    return (
      <>
        <StatusIcon tone="info">
          <MarkEmailReadOutlined />
        </StatusIcon>
        <AuthHeading
          title="Check your inbox"
          description={
            <>
              If an account exists for <strong>{getValues('email')}</strong>, we’ve sent a link to reset your password. The link
              expires soon, so use it shortly.
            </>
          }
        />
        <Button component={RouterLink} to="/login" variant="outlined" color="neutral" size="large" fullWidth>
          Back to sign in
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 5, textAlign: 'center' }}>
          Didn’t get it? Check spam, or{' '}
          <Link component="button" type="button" onClick={() => forgot.reset()} sx={{ verticalAlign: 'baseline' }}>
            try another address
          </Link>
          .
        </Typography>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Reset your password" description="Enter the email you use for Ledora and we’ll send you a reset link." />
      {forgot.error && !hasFieldErrors(forgot.error, ['email']) ? <ApiErrorAlert error={forgot.error} sx={{ mb: 5 }} /> : null}
      <Box component="form" noValidate onSubmit={onSubmit}>
        <Stack spacing={5}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            {...muiField(register('email'))}
          />
          <Button type="submit" variant="contained" size="large" fullWidth loading={forgot.isPending}>
            Send reset link
          </Button>
        </Stack>
      </Box>
      <AuthFooter>
        Remembered it?{' '}
        <Link component={RouterLink} to="/login">
          Back to sign in
        </Link>
      </AuthFooter>
    </>
  );
}

export default ForgotPasswordPage;
