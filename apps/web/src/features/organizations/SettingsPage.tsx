import { zodResolver } from '@hookform/resolvers/zod';
import {
  createOrganizationSchema,
  slugSchema,
  timeZoneSchema,
  updateOrganizationSchema,
  type OrganizationWithRoleDto,
} from '@ledora/shared';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { queryKeys } from '../../api/queryKeys';
import { useDeleteOrganization, useUpdateOrganization, type UpdateOrganizationBody } from '../../api/organizations';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { NoAccess } from '../../components/NoAccess';
import { useNotify } from '../../components/NotifyProvider';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { TimeZoneField } from '../../components/TimeZoneField';
import { applyApiFieldErrors, hasFieldErrors } from '../../lib/formErrors';
import { clearLastOrgId } from '../../lib/lastOrg';
import { muiField } from '../../lib/rhf';
import { useCurrentOrg } from './OrgContext';
import { SlugField } from './SlugField';

const formSchema = z.object({
  name: createOrganizationSchema.shape.name,
  slug: slugSchema,
  timezone: timeZoneSchema,
});
type FormValues = z.input<typeof formSchema>;
const FIELDS = ['name', 'slug', 'timezone'] as const;

function valuesOf(org: OrganizationWithRoleDto): FormValues {
  return { name: org.name, slug: org.slug, timezone: org.timezone };
}

function GeneralSettings({ org }: { org: OrganizationWithRoleDto }) {
  const update = useUpdateOrganization(org.id);
  const notify = useNotify();
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(formSchema), defaultValues: valuesOf(org) });
  const slug = useWatch({ control, name: 'slug' });
  const slugChanged = (slug ?? '').trim().toLowerCase() !== org.slug;

  // Keep the form in step with the saved organization (e.g. after saving, or a change elsewhere).
  useEffect(() => {
    reset(valuesOf(org));
  }, [org, reset]);

  const onSubmit = handleSubmit((values) => {
    const changes: UpdateOrganizationBody = {};
    if (values.name !== org.name) changes.name = values.name;
    if (values.slug !== org.slug) changes.slug = values.slug;
    if (values.timezone !== org.timezone) changes.timezone = values.timezone;
    const parsed = updateOrganizationSchema.safeParse(changes);
    if (!parsed.success) {
      reset(valuesOf(org));
      return;
    }
    update.mutate(parsed.data, {
      onSuccess: () => notify('Organization settings saved'),
      onError: (error) => applyApiFieldErrors(error, setError, FIELDS),
    });
  });

  return (
    <Box component="form" noValidate onSubmit={onSubmit}>
      <SectionCard
        title="General"
        description="Basic details shown to everyone in the organization."
        footer={
          <>
            <Button variant="outlined" color="neutral" disabled={!isDirty || update.isPending} onClick={() => reset(valuesOf(org))}>
              Discard
            </Button>
            <Button type="submit" variant="contained" disabled={!isDirty} loading={update.isPending}>
              Save changes
            </Button>
          </>
        }
      >
        {update.error && !hasFieldErrors(update.error, FIELDS) ? <ApiErrorAlert error={update.error} sx={{ mb: 5 }} /> : null}
        <Stack spacing={6} sx={{ maxWidth: 560 }}>
          <TextField
            label="Organization name"
            autoComplete="organization"
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
            {...muiField(register('name'))}
          />
          <Box>
            <SlugField
              registration={register('slug')}
              value={slug ?? ''}
              error={errors.slug?.message}
              helper="Lowercase letters, numbers and single hyphens."
            />
            {slugChanged ? (
              <Alert severity="warning" sx={{ mt: 3 }}>
                Changing the address updates your public links. Links that use <strong>ledora.com/{org.slug}</strong> will redirect to
                the new address, and the old address stays reserved for you.
              </Alert>
            ) : null}
          </Box>
          <Controller
            control={control}
            name="timezone"
            render={({ field, fieldState }) => (
              <TimeZoneField
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message ?? 'Used for reports and schedules.'}
              />
            )}
          />
        </Stack>
      </SectionCard>
    </Box>
  );
}

function DangerZone({ org }: { org: OrganizationWithRoleDto }) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const remove = useDeleteOrganization(org.id);
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const matches = confirmName.trim() === org.name;

  const close = () => {
    if (remove.isPending) return;
    setOpen(false);
    setConfirmName('');
    remove.reset();
  };

  return (
    <SectionCard title="Danger zone" tone="danger">
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 4, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
        <Box sx={{ maxWidth: 560 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Delete this organization</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Everyone loses access immediately. Its address stays reserved so public links can’t be taken over.
          </Typography>
        </Box>
        <Button variant="outlined" color="error" startIcon={<DeleteOutlined />} onClick={() => setOpen(true)} sx={{ flexShrink: 0 }}>
          Delete organization
        </Button>
      </Box>
      <ConfirmDialog
        open={open}
        title={`Delete ${org.name}?`}
        description={
          <>
            This removes the organization for all members. Type <strong>{org.name}</strong> to confirm.
          </>
        }
        confirmLabel="Delete organization"
        destructive
        loading={remove.isPending}
        confirmDisabled={!matches}
        error={remove.error}
        onClose={close}
        onConfirm={() =>
          remove.mutate(confirmName.trim(), {
            onSuccess: () => {
              clearLastOrgId(org.id);
              notify(`${org.name} was deleted`);
              void navigate('/', { replace: true });
              queryClient.removeQueries({ queryKey: queryKeys.org(org.id) });
              void queryClient.invalidateQueries({ queryKey: queryKeys.myOrganizations });
            },
          })
        }
      >
        <TextField
          label="Organization name"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          autoComplete="off"
          autoFocus
          sx={{ mt: 4 }}
        />
      </ConfirmDialog>
    </SectionCard>
  );
}

export function SettingsPage() {
  const { org, can } = useCurrentOrg();
  if (!can('org.update')) return <NoAccess orgId={org.id} what="organization settings" />;
  return (
    <>
      <PageHeader title="Settings" description={`Manage ${org.name}’s details.`} />
      <Box sx={{ display: 'grid', gap: 5 }}>
        <GeneralSettings org={org} />
        {can('org.delete') ? <DangerZone org={org} /> : null}
      </Box>
    </>
  );
}

export default SettingsPage;
