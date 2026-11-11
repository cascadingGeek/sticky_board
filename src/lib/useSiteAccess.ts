import { useCallback, useEffect, useState } from 'react';
import { grantedWebOrigins, splitOrigins, type SiteAccess } from './pageAccess';

/**
 * The sites Sticky Board may show notes on by itself, kept current while the
 * caller is mounted (access can change in the Allow window or in Chrome).
 * `access` is null until the first read; `error` is true when a read failed.
 */
export function useSiteAccess() {
  const [access, setAccess] = useState<SiteAccess | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setAccess(splitOrigins(await grantedWebOrigins()));
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const read = () =>
      grantedWebOrigins()
        .then(o => {
          if (!cancelled) setAccess(splitOrigins(o));
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    void read();
    chrome.permissions.onAdded.addListener(read);
    chrome.permissions.onRemoved.addListener(read);
    return () => {
      cancelled = true;
      chrome.permissions.onAdded.removeListener(read);
      chrome.permissions.onRemoved.removeListener(read);
    };
  }, []);

  return { access, error, setError, refresh };
}
