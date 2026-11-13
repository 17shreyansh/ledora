import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useMemo } from 'react';
import { timeZoneLabel, timeZoneOffset, timeZoneOptions } from '../lib/timezones';

export function TimeZoneField({
  value,
  onChange,
  onBlur,
  error,
  helperText,
  label = 'Time zone',
  disabled,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: boolean;
  helperText?: string | undefined;
  label?: string;
  disabled?: boolean;
  id?: string;
}) {
  const options = useMemo(() => {
    const list = timeZoneOptions();
    return value && !list.includes(value) ? [value, ...list] : list;
  }, [value]);

  return (
    <Autocomplete
      id={id}
      options={options}
      value={value || null}
      onChange={(_event, next) => {
        if (next) onChange(next);
      }}
      onBlur={onBlur}
      disabled={disabled}
      disableClearable={Boolean(value)}
      autoHighlight
      getOptionLabel={timeZoneLabel}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <span>{option.replace(/_/g, ' ')}</span>
            <Box component="span" sx={{ color: 'text.secondary', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
              {timeZoneOffset(option)}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => <TextField {...params} label={label} error={error} helperText={helperText} />}
    />
  );
}
