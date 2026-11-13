import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useId, type FormEvent, type ReactNode } from 'react';
import { ApiErrorAlert } from './ApiErrorAlert';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  confirmDisabled?: boolean;
  error?: unknown;
  errorTitle?: string | undefined;
  children?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  confirmDisabled = false,
  error,
  errorTitle,
  children,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!loading && !confirmDisabled) onConfirm();
  };
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { component: 'form', onSubmit: handleSubmit, noValidate: true } as object }}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        {description ? (
          <DialogContentText id={descriptionId} component="div">
            {description}
          </DialogContentText>
        ) : null}
        {children}
        {error ? <ApiErrorAlert error={error} title={errorTitle} sx={{ mt: 3 }} /> : null}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="neutral" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button type="submit" variant="contained" color={destructive ? 'error' : 'primary'} loading={loading} disabled={confirmDisabled}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
