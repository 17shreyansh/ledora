import { zodResolver } from '@hookform/resolvers/zod';
import { createWebsiteSchema, type WebsiteDto } from '@ledora/shared';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import KeyOutlined from '@mui/icons-material/KeyOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useNavigate } from 'react-router';
import { z } from 'zod';
import { ApiError } from '../../api/client';
import { forgetWebsite, useDeleteWebsite, useRotateSiteKey, useUpdateWebsite } from '../../api/websites';
import { ApiErrorAlert } from '../../components/ApiErrorAlert';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CopyButton } from '../../components/CopyButton';
import { useNotify } from '../../components/NotifyProvider';
import { SectionCard } from '../../components/SectionCard';
import { applyApiFieldErrors, hasFieldErrors } from '../../lib/formErrors';
import { muiField } from '../../lib/rhf';
import { useCurrentOrg } from '../organizations/OrgContext';
import { AllowedDomainsEditor } from './AllowedDomainsEditor';
import { purple, shadows, slate } from '../../theme/tokens';
import { websiteErrorTitle } from './websiteErrors';

const nameSchema = z.object({ name: createWebsiteSchema.shape.name });
const NAME_FIELDS = ['name'] as const;

function GeneralSection({ website, canManage }: { website: WebsiteDto; canManage: boolean }) {
  const { org } = useCurrentOrg();
  const update = useUpdateWebsite(org.id, website.id);
  const notify = useNotify();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(nameSchema), defaultValues: { name: website.name } });

  useEffect(() => {
    reset({ name: website.name });
  }, [website.name, reset]);

  const onSubmit = handleSubmit((values) => {
    if (values.name === website.name) {
      reset({ name: website.name });
      return;
    }
    update.mutate(
      { name: values.name },
      {
        onSuccess: () => notify('Website name saved'),
        onError: (error) => applyApiFieldErrors(error, setError, NAME_FIELDS),
      },
    );
  });

  return (
    <Box component="form" noValidate onSubmit={onSubmit}>
      <SectionCard
        title="General"
        description="How this website is labelled inside Ledora."
        footer={
          canManage ? (
            <>
              <Button variant="outlined" color="neutral" disabled={!isDirty || update.isPending} onClick={() => reset({ name: website.name })}>
                Discard
              </Button>
              <Button type="submit" variant="contained" disabled={!isDirty} loading={update.isPending}>
                Save changes
              </Button>
            </>
          ) : undefined
        }
      >
        {update.error && !hasFieldErrors(update.error, NAME_FIELDS) ? (
          <ApiErrorAlert error={update.error} title={websiteErrorTitle(update.error)} sx={{ mb: 5 }} />
        ) : null}
        <Stack spacing={6} sx={{ maxWidth: 560 }}>
          <TextField
            label="Website name"
            autoComplete="off"
            disabled={!canManage}
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
            {...muiField(register('name'))}
          />
          <TextField
            label="Main domain"
            value={website.domain}
            disabled
            helperText="Set when the website was added. Use allowed domains below to accept visits from other addresses."
          />
        </Stack>
      </SectionCard>
    </Box>
  );
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** The first field message for `allowedDomains` or one of its entries (`allowedDomains.3`). */
function domainsFieldError(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || !error.fields) return undefined;
  const entry = Object.entries(error.fields).find(([path]) => path === 'allowedDomains' || path.startsWith('allowedDomains.'));
  return entry?.[1];
}

function AllowedDomainsSection({ website, canManage }: { website: WebsiteDto; canManage: boolean }) {
  const { org } = useCurrentOrg();
  const update = useUpdateWebsite(org.id, website.id);
  const notify = useNotify();
  const [domains, setDomains] = useState<string[]>(website.allowedDomains);
  const [saved, setSaved] = useState<string[]>(website.allowedDomains);

  // Pick up changes saved elsewhere (another tab, a teammate) when there are no local edits.
  if (!sameList(saved, website.allowedDomains)) {
    if (sameList(domains, saved)) setDomains(website.allowedDomains);
    setSaved(website.allowedDomains);
  }

  const dirty = !sameList(domains, website.allowedDomains);
  const fieldError = domainsFieldError(update.error);

  const save = () => {
    update.mutate({ allowedDomains: domains }, { onSuccess: () => notify('Allowed domains saved') });
  };

  return (
    <SectionCard
      title="Allowed domains"
      description="Ledora only accepts visits from pages on these domains. Visits from anywhere else are rejected, so nobody can send data with your site key from another site."
      footer={
        canManage ? (
          <>
            <Button
              variant="outlined"
              color="neutral"
              disabled={!dirty || update.isPending}
              onClick={() => {
                setDomains(website.allowedDomains);
                update.reset();
              }}
            >
              Discard
            </Button>
            <Button variant="contained" disabled={!dirty || domains.length === 0} loading={update.isPending} onClick={save}>
              Save domains
            </Button>
          </>
        ) : undefined
      }
    >
      {update.error && !fieldError ? <ApiErrorAlert error={update.error} title={websiteErrorTitle(update.error)} sx={{ mb: 5 }} /> : null}
      <Box sx={{ maxWidth: 640 }}>
        <AllowedDomainsEditor
          value={domains}
          onChange={(next) => {
            setDomains(next);
            if (update.error) update.reset();
          }}
          readOnly={!canManage}
          error={fieldError}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
          Add each address your site uses, such as <strong>example.com</strong> and <strong>www.example.com</strong>. To allow every
          subdomain at once, use a wildcard like <strong>*.example.com</strong> — it covers shop.example.com, blog.example.com and
          example.com itself.
        </Typography>
      </Box>
    </SectionCard>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: ReactNode;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start', justifyContent: 'space-between', py: 3, '& + &': { borderTop: 1, borderColor: 'divider' } }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography id={labelId} sx={{ fontSize: 14, fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography id={descriptionId} variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      </Box>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        slotProps={{ input: { 'aria-labelledby': labelId, 'aria-describedby': descriptionId } }}
        sx={{
          flexShrink: 0,
          mt: -1,
          '& .MuiSwitch-thumb': { bgcolor: 'common.white', boxShadow: shadows.sm },
          '& .MuiSwitch-track': { opacity: 1, bgcolor: slate[300] },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { opacity: 1, bgcolor: purple[500] },
          '& .MuiSwitch-switchBase.Mui-disabled + .MuiSwitch-track': { opacity: 0.45 },
        }}
      />
    </Box>
  );
}

function PrivacySection({ website, canManage }: { website: WebsiteDto; canManage: boolean }) {
  const { org } = useCurrentOrg();
  const update = useUpdateWebsite(org.id, website.id);
  const notify = useNotify();
  const pending = update.isPending ? update.variables?.tracking : undefined;
  const consentRequired = pending?.consentRequired ?? website.tracking.consentRequired;
  const respectDoNotTrack = pending?.respectDoNotTrack ?? website.tracking.respectDoNotTrack;

  const set = (change: { consentRequired?: boolean; respectDoNotTrack?: boolean }) => {
    update.mutate({ tracking: change }, { onSuccess: () => notify('Privacy settings saved') });
  };

  return (
    <SectionCard title="Privacy" description="Choose how Ledora behaves for visitors on this website. Changes apply to new visits right away.">
      {update.error ? <ApiErrorAlert error={update.error} title="Couldn’t save privacy settings" sx={{ mb: 4 }} /> : null}
      <Box sx={{ my: -3 }}>
        <ToggleRow
          label="Ask visitors for consent before tracking"
          description="Nothing is recorded for a visitor until your site tells Ledora they agreed, for example through your cookie banner."
          checked={consentRequired}
          disabled={!canManage || update.isPending}
          onChange={(checked) => set({ consentRequired: checked })}
        />
        <ToggleRow
          label="Respect Do Not Track / Global Privacy Control"
          description="Visitors whose browser asks not to be tracked are not counted at all."
          checked={respectDoNotTrack}
          disabled={!canManage || update.isPending}
          onChange={(checked) => set({ respectDoNotTrack: checked })}
        />
      </Box>
    </SectionCard>
  );
}

function SiteKeySection({ website, canManage, installHref }: { website: WebsiteDto; canManage: boolean; installHref: string }) {
  const { org } = useCurrentOrg();
  const rotate = useRotateSiteKey(org.id, website.id);
  const notify = useNotify();
  const [open, setOpen] = useState(false);

  const close = () => {
    if (rotate.isPending) return;
    setOpen(false);
    rotate.reset();
  };

  return (
    <SectionCard
      title="Site key"
      description="Identifies this website in your snippet. It’s public by design — it appears in your pages’ code — so it isn’t a password."
    >
      <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, gap: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 3,
            height: 40,
            border: 1,
            borderColor: 'divider',
            borderRadius: '8px',
            bgcolor: 'slate.25',
          }}
        >
          <KeyOutlined aria-hidden sx={{ fontSize: 16, color: 'slate.400' }} />
          <Box
            component="code"
            aria-label="Site key"
            sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {website.siteKey}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <CopyButton text={website.siteKey} label="Copy" ariaLabel="Copy site key" copiedMessage="Site key copied" sx={{ height: 40 }} />
          {canManage ? (
            <Button variant="outlined" color="neutral" onClick={() => setOpen(true)} sx={{ height: 40 }}>
              Rotate key
            </Button>
          ) : null}
        </Box>
      </Box>
      {canManage ? (
        <ConfirmDialog
          open={open}
          title="Rotate the site key?"
          description={
            <>
              Ledora creates a new key and <strong>the current key stops working immediately</strong>. Until you replace the snippet on{' '}
              {website.domain} with the new one, no visits will be recorded. Only rotate if you need to, for example if the key is being
              misused.
            </>
          }
          confirmLabel="Rotate key"
          destructive
          loading={rotate.isPending}
          error={rotate.error}
          onClose={close}
          onConfirm={() =>
            rotate.mutate(undefined, {
              onSuccess: () => {
                setOpen(false);
                rotate.reset();
                notify('New site key created. Update the snippet on your website now.', 'info');
              },
            })
          }
        />
      ) : null}
      {canManage ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          After rotating, copy the updated snippet from the{' '}
          <Link component={RouterLink} to={installHref}>
            Install tab
          </Link>{' '}
          and replace the old one on your site.
        </Typography>
      ) : null}
    </SectionCard>
  );
}

function DangerZone({ website }: { website: WebsiteDto }) {
  const { org } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const remove = useDeleteWebsite(org.id, website.id);
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const matches = confirmName.trim() === website.name;

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
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Delete this website</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Ledora stops accepting visits from it straight away, and it no longer counts towards your plan.
          </Typography>
        </Box>
        <Button variant="outlined" color="error" startIcon={<DeleteOutlined />} onClick={() => setOpen(true)} sx={{ flexShrink: 0 }}>
          Delete website
        </Button>
      </Box>
      <ConfirmDialog
        open={open}
        title={`Delete ${website.name}?`}
        description={
          <>
            The snippet on {website.domain} will stop working. Type <strong>{website.name}</strong> to confirm.
          </>
        }
        confirmLabel="Delete website"
        destructive
        loading={remove.isPending}
        confirmDisabled={!matches}
        error={remove.error}
        onClose={close}
        onConfirm={() =>
          remove.mutate(confirmName.trim(), {
            onSuccess: () => {
              notify(`${website.name} was deleted`);
              void navigate(`/o/${org.id}/websites`, { replace: true });
              forgetWebsite(queryClient, org.id, website.id);
            },
          })
        }
      >
        <TextField
          label="Website name"
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

export function WebsiteSettingsTab({ website, installHref }: { website: WebsiteDto; installHref: string }) {
  const { can } = useCurrentOrg();
  const canManage = can('websites.manage');
  return (
    <Box sx={{ display: 'grid', gap: 5 }}>
      {canManage ? null : (
        <Alert severity="info">You can view these settings. Owners, admins and managers can change them.</Alert>
      )}
      <GeneralSection website={website} canManage={canManage} />
      <AllowedDomainsSection website={website} canManage={canManage} />
      <PrivacySection website={website} canManage={canManage} />
      <SiteKeySection website={website} canManage={canManage} installHref={installHref} />
      {canManage ? <DangerZone website={website} /> : null}
    </Box>
  );
}
