import { zodResolver } from '@hookform/resolvers/zod';
import { createOrganizationSchema, slugify, slugSchema, timeZoneSchema } from '@ledora/shared';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link as RouterLink, useNavigate } from 'react-router';
import { z } from 'zod';
import { useLogout, useMyOrganizations, useSession } from '../../api/auth';
import { useCreateOrganization } from '../../api/organizations';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { Logo } from '../../components/Logo';
import { TimeZoneField } from '../../components/TimeZoneField';
import { applyApiFieldErrors, hasFieldErrors } from '../../lib/formErrors';
import { muiField } from '../../lib/rhf';
import { browserTimeZone } from '../../lib/timezones';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { SlugField } from '../organizations/SlugField';

/** An empty address is allowed here (the server generates one); anything else must pass the shared slug rules. */
const optionalSlug = z.string().superRefine((value, ctx) => {
  if (value.trim() === '') return;
  const result = slugSchema.safeParse(value);
  if (!result.success) ctx.addIssue({ code: 'custom', message: result.error.issues[0]?.message ?? 'Invalid address' });
});

const formSchema = z.object({
  name: createOrganizationSchema.shape.name,
  slug: optionalSlug,
  timezone: timeZoneSchema,
});

const FIELDS = ['name', 'slug', 'timezone'] as const;

export function CreateOrganizationPage() {
  const navigate = useNavigate();
  const session = useSession();
  const orgs = useMyOrganizations();
  const create = useCreateOrganization();
  const logout = useLogout();
  const hasOrgs = (orgs.data?.length ?? 0) > 0;
  useDocumentTitle('Create organization');

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', slug: '', timezone: browserTimeZone() },
  });
  const [name, slug] = useWatch({ control, name: ['name', 'slug'] });
  const suggested = slugify(name ?? '');

  const onSubmit = handleSubmit((values) => {
    const body = createOrganizationSchema.parse({
      name: values.name,
      slug: values.slug.trim() ? values.slug : undefined,
      timezone: values.timezone,
    });
    create.mutate(body, {
      onSuccess: (org) => void navigate(`/o/${org.id}`, { replace: true }),
      onError: (error) => applyApiFieldErrors(error, setError, FIELDS),
    });
  });

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Box
        component="header"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 4, sm: 8 }, py: 5 }}
      >
        <Logo size={26} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {session.data ? (
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {session.data.user.email}
            </Typography>
          ) : null}
          <Button
            variant="text"
            color="neutral"
            size="small"
            onClick={() => logout.mutate(undefined, { onSettled: () => void navigate('/login', { replace: true }) })}
          >
            Sign out
          </Button>
        </Box>
      </Box>
      <Box component="main" sx={{ flex: 1, display: 'flex', justifyContent: 'center', px: 4, pt: { xs: 4, sm: 10 }, pb: 12 }}>
        <Box sx={{ width: '100%', maxWidth: 520 }}>
          {hasOrgs ? (
            <Button component={RouterLink} to="/" startIcon={<ArrowBackOutlined />} color="neutral" size="small" sx={{ mb: 4, ml: -2 }}>
              Back
            </Button>
          ) : null}
          <Typography variant="overline" color="primary" component="p" sx={{ mb: 2 }}>
            {hasOrgs ? 'New organization' : 'Welcome to Ledora'}
          </Typography>
          <Typography variant="h1">{hasOrgs ? 'Create an organization' : 'Create your organization'}</Typography>
          <Typography color="text.secondary" sx={{ mt: 2, mb: 7 }}>
            An organization is the shared workspace for your team. You can invite teammates once it’s set up.
          </Typography>
          <Card sx={{ p: { xs: 5, sm: 7 } }}>
            {create.error && !hasFieldErrors(create.error, FIELDS) ? <ApiErrorAlert error={create.error} sx={{ mb: 5 }} /> : null}
            <Box component="form" noValidate onSubmit={onSubmit}>
              <Stack spacing={6}>
                <TextField
                  label="Organization name"
                  placeholder="Acme Inc."
                  autoComplete="organization"
                  autoFocus
                  error={Boolean(errors.name)}
                  helperText={errors.name?.message ?? 'Usually your company or team name.'}
                  {...muiField(register('name'))}
                />
                <SlugField
                  registration={register('slug')}
                  value={slug ?? ''}
                  placeholder={suggested || 'your-team'}
                  error={errors.slug?.message}
                  helper={
                    slug?.trim()
                      ? 'Used in public links such as hosted forms.'
                      : 'Optional. Leave blank and we’ll create one from the name.'
                  }
                />
                <Controller
                  control={control}
                  name="timezone"
                  render={({ field, fieldState }) => (
                    <TimeZoneField
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={Boolean(fieldState.error)}
                      helperText={fieldState.error?.message ?? 'Used for reports and schedules. Detected from your browser.'}
                    />
                  )}
                />
                <Button type="submit" variant="contained" size="large" fullWidth loading={create.isPending}>
                  Create organization
                </Button>
              </Stack>
            </Box>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}

export default CreateOrganizationPage;
