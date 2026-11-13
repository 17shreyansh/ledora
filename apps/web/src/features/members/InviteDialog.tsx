import { zodResolver } from '@hookform/resolvers/zod';
import { canGrantRole, createInvitationSchema, ORG_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type OrgRole } from '@ledora/shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useCreateInvitation } from '../../api/organizations';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { useNotify } from '../../components/NotifyProvider';
import { applyApiFieldErrors, hasFieldErrors } from '../../lib/formErrors';
import { muiField } from '../../lib/rhf';

const FIELDS = ['email', 'role'] as const;

/** Roles the current user may hand out, most privileged first. */
export function grantableRoles(actor: OrgRole): OrgRole[] {
  return ORG_ROLES.filter((role) => canGrantRole(actor, role));
}

function defaultRole(roles: OrgRole[]): OrgRole {
  for (const preferred of ['manager', 'analyst', 'viewer'] as const) if (roles.includes(preferred)) return preferred;
  return roles[roles.length - 1] ?? 'viewer';
}

export function InviteDialog({ open, onClose, orgId, actorRole }: { open: boolean; onClose: () => void; orgId: string; actorRole: OrgRole }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = useId();
  const notify = useNotify();
  const invite = useCreateInvitation(orgId);
  const roles = grantableRoles(actorRole);

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: { email: '', role: defaultRole(roles) },
  });

  const close = () => {
    if (invite.isPending) return;
    onClose();
    reset();
    invite.reset();
  };

  const onSubmit = handleSubmit((values) => {
    invite.mutate(values, {
      onSuccess: (created) => {
        notify(`Invitation sent to ${created.email}`);
        onClose();
        reset();
        invite.reset();
      },
      onError: (error) => applyApiFieldErrors(error, setError, FIELDS),
    });
  });

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      aria-labelledby={titleId}
      slotProps={{ paper: { component: 'form', onSubmit, noValidate: true } as object }}
    >
      <DialogTitle id={titleId}>Invite a teammate</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
          They’ll get an email with a link to join. Invitations expire after 7 days.
        </Typography>
        {invite.error && !hasFieldErrors(invite.error, FIELDS) ? <ApiErrorAlert error={invite.error} sx={{ mb: 5 }} /> : null}
        <Stack spacing={5}>
          <TextField
            label="Email address"
            type="email"
            placeholder="name@company.com"
            autoComplete="off"
            autoFocus
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            {...muiField(register('email'))}
          />
          <Controller
            control={control}
            name="role"
            render={({ field, fieldState }) => (
              <TextField
                select
                label="Role"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                inputRef={field.ref}
                name={field.name}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message ?? ROLE_DESCRIPTIONS[field.value]}
                slotProps={{
                  select: {
                    renderValue: (value) => ROLE_LABELS[value as OrgRole],
                    MenuProps: { slotProps: { paper: { sx: { maxWidth: 440 } } } },
                  },
                }}
              >
                {roles.map((role) => (
                  <MenuItem key={role} value={role} sx={{ alignItems: 'flex-start', py: 2 }}>
                    <Box sx={{ whiteSpace: 'normal' }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{ROLE_LABELS[role]}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {ROLE_DESCRIPTIONS[role]}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="neutral" onClick={close} disabled={invite.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={invite.isPending}>
          Send invitation
        </Button>
      </DialogActions>
    </Dialog>
  );
}
