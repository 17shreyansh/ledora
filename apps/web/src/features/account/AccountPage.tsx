import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, updateProfileSchema, type UserDto } from '@ledora/shared';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink } from 'react-router';
import { z } from 'zod';
import { useChangePassword, useSession, useUpdateProfile } from '../../api/auth';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { FullPageLoader } from '../../components/FullPageLoader';
import { useNotify } from '../../components/NotifyProvider';
import { PageHeader } from '../../components/PageHeader';
import { PasswordField } from '../../components/PasswordField';
import { SectionCard } from '../../components/SectionCard';
import { applyApiFieldErrors, hasFieldErrors } from '../../lib/formErrors';
import { formatDate } from '../../lib/format';
import { muiField } from '../../lib/rhf';
import { status } from '../../theme/tokens';

function ProfileForm({ user }: { user: UserDto }) {
  const update = useUpdateProfile();
  const notify = useNotify();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(updateProfileSchema), defaultValues: { name: user.name } });

  useEffect(() => {
    reset({ name: user.name });
  }, [user.name, reset]);

  const onSubmit = handleSubmit((values) => {
    update.mutate(values, {
      onSuccess: () => notify('Profile updated'),
      onError: (error) => applyApiFieldErrors(error, setError, ['name']),
    });
  });

  return (
    <Box component="form" noValidate onSubmit={onSubmit}>
      <SectionCard
        title="Profile"
        description="How you appear to your teammates."
        footer={
          <Button type="submit" variant="contained" disabled={!isDirty} loading={update.isPending}>
            Save profile
          </Button>
        }
      >
        {update.error && !hasFieldErrors(update.error, ['name']) ? <ApiErrorAlert error={update.error} sx={{ mb: 5 }} /> : null}
        <Stack spacing={6} sx={{ maxWidth: 560 }}>
          <TextField
            label="Full name"
            autoComplete="name"
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
            {...muiField(register('name'))}
          />
          <Box>
            <TextField
              label="Email"
              value={user.email}
              helperText="Your sign-in address. It can’t be changed yet."
              slotProps={{
                htmlInput: { readOnly: true },
                input: {
                  sx: { bgcolor: 'slate.50', color: 'text.secondary' },
                  endAdornment: user.emailVerified ? (
                    <Chip
                      icon={<CheckCircleOutlined />}
                      label="Verified"
                      size="small"
                      sx={{ bgcolor: status.success.bg, color: status.success.main, border: `1px solid ${status.success.border}`, '& .MuiChip-icon': { color: status.success.main, fontSize: 14 } }}
                    />
                  ) : (
                    <Chip
                      icon={<ErrorOutlineOutlined />}
                      label="Not verified"
                      size="small"
                      sx={{ bgcolor: status.warning.bg, color: status.warning.main, border: `1px solid ${status.warning.border}`, '& .MuiChip-icon': { color: status.warning.main, fontSize: 14 } }}
                    />
                  ),
                },
              }}
            />
            {!user.emailVerified ? (
              <Typography variant="body2" sx={{ mt: 2 }}>
                <Link component={RouterLink} to="/check-email">
                  Verify your email address
                </Link>
              </Typography>
            ) : null}
          </Box>
          <Typography variant="caption">Member since {formatDate(user.createdAt)}</Typography>
        </Stack>
      </SectionCard>
    </Box>
  );
}

const passwordFormSchema = changePasswordSchema
  .extend({
    currentPassword: z.string().min(1, 'Enter your current password').max(256),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

const PASSWORD_FIELDS = ['currentPassword', 'newPassword'] as const;

function PasswordForm() {
  const change = useChangePassword();
  const notify = useNotify();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) => {
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          reset();
          notify('Password changed. Other sessions have been signed out.');
        },
        onError: (error) => applyApiFieldErrors(error, setError, PASSWORD_FIELDS),
      },
    );
  });

  return (
    <Box component="form" noValidate onSubmit={onSubmit}>
      <SectionCard
        title="Password"
        description="Changing your password signs you out on every other device."
        footer={
          <Button type="submit" variant="contained" loading={change.isPending}>
            Change password
          </Button>
        }
      >
        {change.error && !hasFieldErrors(change.error, PASSWORD_FIELDS) ? <ApiErrorAlert error={change.error} sx={{ mb: 5 }} /> : null}
        <Stack spacing={6} sx={{ maxWidth: 560 }}>
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            error={Boolean(errors.currentPassword)}
            helperText={errors.currentPassword?.message}
            {...muiField(register('currentPassword'))}
          />
          <PasswordField
            label="New password"
            autoComplete="new-password"
            error={Boolean(errors.newPassword)}
            helperText={errors.newPassword?.message ?? 'Use at least 10 characters.'}
            {...muiField(register('newPassword'))}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            error={Boolean(errors.confirmPassword)}
            helperText={errors.confirmPassword?.message}
            {...muiField(register('confirmPassword'))}
          />
        </Stack>
      </SectionCard>
    </Box>
  );
}

export function AccountPage() {
  const session = useSession();
  const user = session.data?.user;
  if (!user) return <FullPageLoader />;
  return (
    <>
      <PageHeader title="Account" description="Your personal details and sign-in settings." />
      <Box sx={{ display: 'grid', gap: 5 }}>
        <ProfileForm user={user} />
        <PasswordForm />
      </Box>
    </>
  );
}

export default AccountPage;
