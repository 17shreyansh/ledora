import { useEffect } from 'react';

/** Sets the browser tab title for the current page ("Members · Ledora"). */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · Ledora` : 'Ledora';
  }, [title]);
}
