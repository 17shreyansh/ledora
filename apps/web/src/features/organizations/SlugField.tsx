import LinkOutlined from '@mui/icons-material/LinkOutlined';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { muiField } from '../../lib/rhf';

/**
 * Organization address (slug) input with a `ledora.com/` prefix and a live preview of the
 * resulting address.
 */
export function SlugField({
  registration,
  value,
  placeholder,
  error,
  helper,
  label = 'Organization address',
}: {
  registration: UseFormRegisterReturn<'slug'>;
  value: string;
  placeholder?: string;
  error?: string | undefined;
  helper?: ReactNode;
  label?: string;
}) {
  const shown = value.trim().toLowerCase() || placeholder || '';
  return (
    <Box>
      <TextField
        label={label}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        error={Boolean(error)}
        helperText={error ?? helper}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start" sx={{ mr: 0, '& p': { color: 'text.secondary', fontSize: 14 } }}>
                ledora.com/
              </InputAdornment>
            ),
          },
          htmlInput: { maxLength: 64 },
        }}
        {...muiField(registration)}
      />
      <Box
        sx={{
          mt: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          py: 2,
          borderRadius: '8px',
          bgcolor: 'slate.50',
          border: 1,
          borderColor: 'divider',
          fontSize: 13,
          color: 'text.secondary',
          minWidth: 0,
        }}
      >
        <LinkOutlined sx={{ fontSize: 16, color: 'slate.400', flexShrink: 0 }} aria-hidden />
        <Box component="span" sx={{ flexShrink: 0 }}>
          Preview:
        </Box>
        <Box component="span" sx={{ color: 'text.primary', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          ledora.com/{shown || '…'}
        </Box>
      </Box>
    </Box>
  );
}
