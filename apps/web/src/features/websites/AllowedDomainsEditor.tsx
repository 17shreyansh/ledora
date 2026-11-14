import { domainPatternSchema, MAX_ALLOWED_DOMAINS } from '@ledora/shared';
import AddOutlined from '@mui/icons-material/AddOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import PublicOutlined from '@mui/icons-material/PublicOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useId, useState, type KeyboardEvent } from 'react';

/**
 * Checks one entry for the allowed-domains list. Returns the normalized pattern, or a message
 * explaining why it can't be added.
 */
export function validateDomainEntry(input: string, current: readonly string[]): { value: string } | { error: string } {
  if (!input.trim()) return { error: 'Enter a domain, e.g. example.com' };
  const parsed = domainPatternSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Enter a domain like example.com or *.example.com' };
  if (current.includes(parsed.data)) return { error: `${parsed.data} is already in the list` };
  if (current.length >= MAX_ALLOWED_DOMAINS) {
    return { error: `You can allow up to ${MAX_ALLOWED_DOMAINS} domains. Remove one first, or use a wildcard like *.example.com.` };
  }
  return { value: parsed.data };
}

export function AllowedDomainsEditor({
  value,
  onChange,
  readOnly = false,
  error,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
  error?: string | undefined;
}) {
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const listId = useId();

  const add = () => {
    const result = validateDomainEntry(draft, value);
    if ('error' in result) {
      setDraftError(result.error);
      return;
    }
    onChange([...value, result.value]);
    setDraft('');
    setDraftError(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    }
  };

  const onlyOne = value.length <= 1;

  return (
    <Box>
      <Box
        component="ul"
        id={listId}
        aria-label="Allowed domains"
        sx={{ listStyle: 'none', m: 0, p: 0, border: 1, borderColor: error ? 'error.main' : 'divider', borderRadius: '8px', overflow: 'hidden' }}
      >
        {value.map((domain) => (
          <Box
            component="li"
            key={domain}
            sx={{ display: 'flex', alignItems: 'center', gap: 3, pl: 3, pr: 1, minHeight: 40, '& + &': { borderTop: 1, borderColor: 'divider' } }}
          >
            <PublicOutlined aria-hidden sx={{ fontSize: 16, color: 'slate.400' }} />
            <Typography sx={{ fontSize: 14, flex: 1, minWidth: 0, wordBreak: 'break-all', py: 2 }}>
              {domain}
              {domain.startsWith('*.') ? (
                <Typography component="span" variant="body2" color="text.secondary">
                  {' '}
                  — {domain.slice(2)} and all its subdomains
                </Typography>
              ) : null}
            </Typography>
            {readOnly ? null : (
              <IconButton
                size="small"
                aria-label={`Remove ${domain}`}
                title={onlyOne ? 'At least one domain is required' : undefined}
                disabled={onlyOne}
                onClick={() => onChange(value.filter((d) => d !== domain))}
              >
                <CloseOutlined fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}
        {value.length === 0 ? (
          <Box component="li" sx={{ px: 3, py: 3 }}>
            <Typography variant="body2" color="text.secondary">
              No domains yet. Add at least one.
            </Typography>
          </Box>
        ) : null}
      </Box>
      {error ? (
        <Typography role="alert" variant="body2" color="error" sx={{ mt: 1.5, fontSize: 12 }}>
          {error}
        </Typography>
      ) : null}

      {readOnly ? null : (
        <Box sx={{ display: 'flex', gap: 2, mt: 4, alignItems: 'flex-start', flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField
            label="Add a domain"
            placeholder="blog.example.com or *.example.com"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (draftError) setDraftError(null);
            }}
            onKeyDown={onKeyDown}
            autoComplete="off"
            error={Boolean(draftError)}
            helperText={draftError ?? `${value.length} of ${MAX_ALLOWED_DOMAINS} domains used.`}
            slotProps={{ htmlInput: { spellCheck: false, autoCapitalize: 'none' } }}
            sx={{ flex: 1, maxWidth: { sm: 420 } }}
          />
          <Button variant="outlined" color="neutral" startIcon={<AddOutlined />} onClick={add} sx={{ mt: { sm: '24px' }, flexShrink: 0 }}>
            Add domain
          </Button>
        </Box>
      )}
    </Box>
  );
}
