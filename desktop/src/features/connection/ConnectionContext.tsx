import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ConnectionPhase, TranslatorOption } from '../../lib/api';
import { ensureDesktopBackendReady, fetchJobs, fetchTranslators, fetchVersion, fetchVersionCheck } from '../../lib/api';
import { normalizeError } from '../../lib/errors';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { t } from '../../i18n';

type ConnectionContextValue = {
  backendUrl: string;
  connectionPhase: ConnectionPhase;
  connectionMessage: string;
  translators: TranslatorOption[];
  loadingInitialData: boolean;
  refreshingJobs: boolean;
  loadInitialData: () => Promise<void>;
  loadJobs: (silent?: boolean) => Promise<void>;
};

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function useConnection(): ConnectionContextValue {
  const value = useContext(ConnectionContext);
  if (!value) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return value;
}

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>('connecting');
  const [connectionMessage, setConnectionMessage] = useState(t('connection.messageConnecting'));
  const [translators, setTranslators] = useState<TranslatorOption[]>([]);
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [refreshingJobs, setRefreshingJobs] = useState(false);

  const backendUrl = useMemo(() => {
    const configured = import.meta.env.VITE_BACKEND_URL?.trim();
    return configured ? configured.replace(/\/$/, '') : 'http://127.0.0.1:12333';
  }, []);

  const loadJobs = useCallback(async (silent = false) => {
    if (!silent) {
      setRefreshingJobs(true);
    }

    try {
      await fetchJobs();
      setConnectionPhase('online');
      setConnectionMessage(t('connection.messageOnlineJobs'));
    } catch (error) {
      const message = normalizeError(error, t('connection.errorFetchJobs'));
      setConnectionPhase('offline');
      setConnectionMessage(message);
    } finally {
      if (!silent) {
        setRefreshingJobs(false);
      }
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    setLoadingInitialData(true);
    setConnectionPhase('connecting');
    setConnectionMessage(t('connection.messagePreparing'));

    try {
      setConnectionMessage(t('connection.messageStarting'));
      await ensureDesktopBackendReady({ timeoutMs: 20_000 });
      setConnectionMessage(t('connection.messageReadyLoading'));
      const nextTranslators = await fetchTranslators();
      setTranslators(nextTranslators);

      const version = await fetchVersion();
      const applyWindowTitle = async (title: string) => {
        if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
          try {
            await getCurrentWindow().setTitle(title);
          } catch {
            // ignore window title errors
          }
        } else {
          document.title = title;
        }
      };

      await applyWindowTitle(`GalTransl Desktop - v${version}`);

      fetchVersionCheck()
        .then(async (result) => {
          if (!result.update_available) {
            return;
          }
          await applyWindowTitle(`GalTransl Desktop - v${result.version} (${t('connection.windowUpdateAvailable')})`);
        })
        .catch(() => undefined);

      setConnectionPhase('online');
      setConnectionMessage(t('connection.messageBackendOnline'));
    } catch (error) {
      const message = normalizeError(error, t('connection.errorConnect'));
      setTranslators([]);
      setConnectionPhase('offline');
      setConnectionMessage(message);
    } finally {
      setLoadingInitialData(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const value = useMemo<ConnectionContextValue>(
    () => ({
      backendUrl,
      connectionPhase,
      connectionMessage,
      translators,
      loadingInitialData,
      refreshingJobs,
      loadInitialData,
      loadJobs,
    }),
    [backendUrl, connectionPhase, connectionMessage, translators, loadingInitialData, refreshingJobs, loadInitialData, loadJobs],
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

