import { zodResolver } from '@hookform/resolvers/zod';
import { createWebsiteSchema, isValidHostname, normalizeHostname, type UsageDto } from '@ledora/shared';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useCreateWebsite } from '../../api/websites';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { useNotify } from '../../components/NotifyProvider';
import { applyApiFieldErrors, hasFieldErrors } from '../../lib/formErrors';
import { muiField } from '../../lib/rhf';
import { isPlanLimitError, websiteErrorTitle } from './websiteErrors';

const FIELDS = ['name', 'domain'] as const;
const DOMAIN_HELP = 'Paste your site address, e.g. shop.example.com';

export function planLimitSentence(usage: UsageDto | undefined): string | null {
  if (!usage) return null;
  return `You’re using ${usage.usage.websites} of ${usage.limits.websites} ${usage.limits.websites === 1 ? 'website' : 'websites'} on the ${usage.plan.name} plan.`;
}

export function AddWebsiteDialog({
  open,
  onClose,
  orgId,
  usage,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  usage: UsageDto | undefined;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = useId();
  const notify = useNotify();
  const navigate = useNavigate();
  const create = useCreateWebsite(orgId);

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(createWebsiteSchema), defaultValues: { name: '', domain: '' } });
  const domain = useWatch({ control, name: 'domain' }) ?? '';
  const normalized = normalizeHostname(domain);
  const showNormalized = domain.trim() !== '' && normalized !== domain.trim().toLowerCase() && isValidHostname(normalized);

  const close = () => {
    if (create.isPending) return;
    onClose();
    reset();
    create.reset();
  };

  const onSubmit = handleSubmit((values) => {
    create.mutate(values, {
      onSuccess: (website) => {
        notify(`${website.name} was added`);
        onClose();
        reset();
        create.reset();
        void navigate(`/o/${orgId}/websites/${website.id}/install`);
      },
      onError: (error) => applyApiFieldErrors(error, setError, FIELDS),
    });
  });

  const planLimit = isPlanLimitError(create.error);
  const limitSentence = planLimit ? planLimitSentence(usage) : null;

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
      <DialogTitle id={titleId}>Add a website</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
          You’ll get a short code snippet to put on your site. Once a visitor opens a page with it, Ledora starts counting
          visits for this website.
        </Typography>
        {create.error && !hasFieldErrors(create.error, FIELDS) ? (
          <ApiErrorAlert
            error={create.error}
            title={websiteErrorTitle(create.error)}
            sx={{ mb: 5 }}
          />
        ) : null}
        {limitSentence ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: -3, mb: 5 }}>
            {limitSentence} Remove a website you no longer use to make room for this one.
          </Typography>
        ) : null}
        <Stack spacing={5}>
          <TextField
            label="Website name"
            placeholder="My online shop"
            autoComplete="off"
            autoFocus
            error={Boolean(errors.name)}
            helperText={errors.name?.message ?? 'Only shown inside Ledora, so pick something your team will recognise.'}
            {...muiField(register('name'))}
          />
          <TextField
            label="Website address"
            placeholder="shop.example.com"
            autoComplete="off"
            slotProps={{ htmlInput: { inputMode: 'url', spellCheck: false, autoCapitalize: 'none' } }}
            error={Boolean(errors.domain)}
            helperText={errors.domain?.message ?? (showNormalized ? `We’ll save this as ${normalized}` : DOMAIN_HELP)}
            {...muiField(register('domain'))}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="neutral" onClick={close} disabled={create.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={create.isPending}>
          Add website
        </Button>
      </DialogActions>
    </Dialog>
  );
}
