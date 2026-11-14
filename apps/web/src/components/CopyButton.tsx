import CheckOutlined from '@mui/icons-material/CheckOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import Button, { type ButtonProps } from '@mui/material/Button';
import { useEffect, useRef, useState } from 'react';
import { useNotify } from './NotifyProvider';

/** Copies `text` to the clipboard and briefly confirms it ("Copied"), also for screen readers. */
export function CopyButton({
  text,
  label = 'Copy',
  copiedMessage = 'Copied to clipboard',
  ariaLabel,
  ...buttonProps
}: {
  text: string;
  label?: string;
  copiedMessage?: string;
  ariaLabel?: string;
} & Omit<ButtonProps, 'onClick' | 'children'>) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useNotify();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      notify(copiedMessage);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Couldn’t copy automatically. Select the text and copy it instead.', 'error');
    }
  };

  return (
    <Button
      variant="outlined"
      color="neutral"
      size="small"
      startIcon={copied ? <CheckOutlined /> : <ContentCopyOutlined />}
      aria-label={ariaLabel}
      {...buttonProps}
      onClick={() => void copy()}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}
