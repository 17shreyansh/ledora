import type { UseFormRegisterReturn } from 'react-hook-form';

/** Adapts `register()` for MUI inputs, which take the DOM ref as `inputRef`. */
export function muiField<TName extends string>(registration: UseFormRegisterReturn<TName>) {
  const { ref, ...rest } = registration;
  return { ...rest, inputRef: ref };
}
