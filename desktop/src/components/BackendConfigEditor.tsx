import { useCallback, useEffect, useRef, useState } from 'react';
import { CustomSelect } from './CustomSelect';
import { fetchOpenAIModels } from '../lib/api';
import { t } from '../i18n';

type TokenEntry = {
  token: string;
  endpoint: string;
  modelName: string;
  stream?: boolean;
};

type BackendConfigEditorProps = {
  config: Record<string, unknown>;
  onChange: (newConfig: Record<string, unknown>) => void;
  readOnly?: boolean;
  /** Optional proxy config (e.g., project-level proxy) to use when fetching the model list. */
  proxy?: { http?: string; https?: string } | null;
};

export function BackendConfigEditor({ config, onChange, readOnly = false, proxy = null }: BackendConfigEditorProps) {
  const hasOai = 'OpenAI-Compatible' in config;
  const hasSakura = 'SakuraLLM' in config;

  const oaiConfig = (config?.['OpenAI-Compatible'] || {}) as Record<string, unknown>;
  const sakuraConfig = (config?.['SakuraLLM'] || {}) as Record<string, unknown>;

  const tokens = (Array.isArray(oaiConfig.tokens) ? oaiConfig.tokens : []) as TokenEntry[];

  // Toggle backend type presence
  const toggleBackendType = useCallback((type: 'OpenAI-Compatible' | 'SakuraLLM', enabled: boolean) => {
    if (readOnly) return;
    if (enabled) {
      if (type === 'OpenAI-Compatible') {
        onChange({
          ...config,
          'OpenAI-Compatible': {
            tokens: [],
            tokenStrategy: 'random',
            checkAvailable: true,
            globalRequestRPM: 0,
            apiTimeout: 300,
            apiErrorWait: 'auto',
          },
        });
      } else {
        onChange({
          ...config,
          SakuraLLM: {
            endpoints: [],
            rewriteModelName: '',
          },
        });
      }
    } else {
      const next = { ...config };
      delete next[type];
      onChange(next);
    }
  }, [config, onChange, readOnly]);

  // Update a single key in OpenAI-Compatible section
  const updateOai = useCallback((key: string, value: unknown) => {
    if (readOnly) return;
    onChange({ ...config, 'OpenAI-Compatible': { ...oaiConfig, [key]: value } });
  }, [config, oaiConfig, onChange, readOnly]);

  // Update a single key in SakuraLLM section
  const updateSakura = useCallback((key: string, value: unknown) => {
    if (readOnly) return;
    onChange({ ...config, SakuraLLM: { ...sakuraConfig, [key]: value } });
  }, [config, sakuraConfig, onChange, readOnly]);

  const sakuraEndpoints = (Array.isArray(sakuraConfig.endpoints)
    ? sakuraConfig.endpoints
    : [String(sakuraConfig.endpoints ?? sakuraConfig.endpoint ?? '')]) as string[];

  const updateSakuraEndpoint = useCallback((index: number, val: string) => {
    if (readOnly) return;
    const next = [...sakuraEndpoints];
    next[index] = val;
    updateSakura('endpoints', next);
  }, [sakuraEndpoints, updateSakura, readOnly]);

  const addSakuraEndpoint = useCallback(() => {
    if (readOnly) return;
    const next = [...sakuraEndpoints, ''];
    updateSakura('endpoints', next);
  }, [sakuraEndpoints, updateSakura, readOnly]);

  const removeSakuraEndpoint = useCallback((index: number) => {
    if (readOnly) return;
    const next = sakuraEndpoints.filter((_, i) => i !== index);
    updateSakura('endpoints', next);
  }, [sakuraEndpoints, updateSakura, readOnly]);

  // Tokens list operations
  const addToken = useCallback(() => {
    if (readOnly) return;
    const next = [...tokens, { token: '', endpoint: '', modelName: '' }];
    updateOai('tokens', next);
  }, [tokens, updateOai, readOnly]);

  const removeToken = useCallback((index: number) => {
    if (readOnly) return;
    const next = tokens.filter((_, i) => i !== index);
    updateOai('tokens', next);
  }, [tokens, updateOai, readOnly]);

  const updateToken = useCallback((index: number, field: keyof TokenEntry, value: string | boolean) => {
    if (readOnly) return;
    const next = tokens.map((t, i) => i === index ? { ...t, [field]: value } : t);
    updateOai('tokens', next);
  }, [tokens, updateOai, readOnly]);

  // Per-token model-list fetch state
  type ModelsState = { loading: boolean; error: string | null; models: string[] };
  const [modelsState, setModelsState] = useState<Record<number, ModelsState>>({});
  // Which token's model dropdown is currently open (null = none)
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (openDropdownIdx == null) return;
    const handler = (e: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target as Node)) {
        setOpenDropdownIdx(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdownIdx]);

  const handleFetchModels = useCallback(async (index: number) => {
    const entry = tokens[index];
    if (!entry) return;
    setModelsState((prev) => ({
      ...prev,
      [index]: { loading: true, error: null, models: prev[index]?.models ?? [] },
    }));
    try {
      const res = await fetchOpenAIModels({
        endpoint: entry.endpoint || '',
        token: entry.token || '',
        proxy: proxy && (proxy.http || proxy.https) ? proxy : null,
      });
      setModelsState((prev) => ({
        ...prev,
        [index]: { loading: false, error: null, models: res.models || [] },
      }));
      if ((res.models?.length ?? 0) > 0) {
        setOpenDropdownIdx(index);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('backendConfig.fetchModelsRequestFailed');
      setModelsState((prev) => ({
        ...prev,
        [index]: { loading: false, error: msg, models: prev[index]?.models ?? [] },
      }));
    }
  }, [tokens, proxy]);

  return (
    <>
      {/* Backend type selector */}
      <label className="field">
        <span>{t('backendConfig.backendType')}</span>
        <div className="backend-type-toggle">
          <label className="toggle-checkbox">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={hasOai}
              onChange={(e) => toggleBackendType('OpenAI-Compatible', e.target.checked)}
            />
            <span>{t('backendConfig.openAiCompatible')}</span>
          </label>
          <label className="toggle-checkbox">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={hasSakura}
              onChange={(e) => toggleBackendType('SakuraLLM', e.target.checked)}
            />
            <span>{t('backendConfig.sakuraLocal')}</span>
          </label>
        </div>
      </label>

      {/* OpenAI-Compatible section */}
      {hasOai && (
        <>
          <h3 className="config-section-title">{t('backendConfig.openAiCompatible')}</h3>

          {/* Tokens list */}
          <div className="token-list">
            <div className="token-list__header">
              <span className="token-list__title">{t('backendConfig.apiTokenList')}</span>
              {!readOnly && (
                <button type="button" className="token-list__add-btn" onClick={addToken}>
                  {t('backendConfig.addToken')}
                </button>
              )}
            </div>

            {tokens.length === 0 && (
              <div className="token-list__empty">
                {t('backendConfig.emptyTokens')}
              </div>
            )}

            {tokens.map((token, idx) => {
              const ms = modelsState[idx];
              return (
              <div key={idx} className="token-entry">
                <div className="token-entry__header">
                  <span className="token-entry__index">{t('backendConfig.tokenIndex', { index: idx + 1 })}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      className="token-entry__remove-btn"
                      onClick={() => removeToken(idx)}
                      title={t('backendConfig.deleteToken')}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <label className="field field--inline">
                  <span>API Key</span>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={token.token ?? ''}
                    onChange={(e) => updateToken(idx, 'token', e.target.value)}
                    placeholder="sk-..."
                  />
                </label>
                <label className="field field--inline">
                  <span>Base URL</span>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={token.endpoint ?? ''}
                    onChange={(e) => updateToken(idx, 'endpoint', e.target.value)}
                    placeholder="http://127.0.0.1:8080"
                  />
                </label>
                <label className="field field--inline">
                  <span>{t('backendConfig.modelName')}</span>
                  <div className="model-name-row">
                    <div
                      className={`model-name-combo${openDropdownIdx === idx ? ' model-name-combo--open' : ''}`}
                      ref={openDropdownIdx === idx ? dropdownContainerRef : undefined}
                    >
                      <input
                        type="text"
                        disabled={readOnly}
                        value={token.modelName ?? ''}
                        onChange={(e) => updateToken(idx, 'modelName', e.target.value)}
                        placeholder="gpt-4o-mini"
                        className="model-name-combo__input"
                        onFocus={() => {
                          if (ms && ms.models.length > 0) setOpenDropdownIdx(idx);
                        }}
                      />
                      {ms && ms.models.length > 0 && (
                        <button
                          type="button"
                          className="model-name-combo__arrow"
                          onClick={() => setOpenDropdownIdx((cur) => (cur === idx ? null : idx))}
                          aria-label={t('backendConfig.expandModelList')}
                          aria-expanded={openDropdownIdx === idx}
                          tabIndex={-1}
                        >
                          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true">
                            <path d="M1.5 1.5L6 6l4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                      {openDropdownIdx === idx && ms && ms.models.length > 0 && (
                        <div className="custom-select__panel model-name-combo__panel" role="listbox">
                          {ms.models.map((m) => (
                            <div
                              key={m}
                              role="option"
                              aria-selected={token.modelName === m}
                              className={`custom-select__option${token.modelName === m ? ' custom-select__option--selected' : ''}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                updateToken(idx, 'modelName', m);
                                setOpenDropdownIdx(null);
                              }}
                            >
                              {m}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        className="model-name-row__fetch-btn"
                        onClick={() => handleFetchModels(idx)}
                        disabled={modelsState[idx]?.loading}
                        title={t('backendConfig.fetchModelsTitle')}
                      >
                        {modelsState[idx]?.loading ? t('backendConfig.fetchingModels') : t('backendConfig.fetchModels')}
                      </button>
                    )}
                  </div>
                  {ms?.error && (
                    <span className="field__hint field__hint--error">
                      {t('backendConfig.fetchModelsFailed', { error: ms.error })}
                    </span>
                  )}
                  {ms && !ms.error && ms.models.length > 0 && (
                    <span className="field__hint">
                      {t('backendConfig.modelsFetched', { count: ms.models.length })}
                    </span>
                  )}
                </label>
                <label className="field field--inline">
                  <span>{t('backendConfig.streamRequest')}</span>
                  <CustomSelect
                    disabled={readOnly}
                    value={token.stream == null ? '' : String(token.stream)}
                    onChange={(e) => {
                      if (e.target.value === '') updateToken(idx, 'stream', undefined as unknown as boolean);
                      else updateToken(idx, 'stream', e.target.value === 'true');
                    }}
                  >
                    <option value="">{t('common.default')}</option>
                    <option value="true">{t('common.yes')}</option>
                    <option value="false">{t('common.no')}</option>
                  </CustomSelect>
                </label>
              </div>
              );
            })}
          </div>

          <label className="field">
            <span>{t('backendConfig.tokenStrategy')}</span>
            <CustomSelect
              disabled={readOnly}
              value={String(oaiConfig.tokenStrategy ?? 'random')}
              onChange={(e) => updateOai('tokenStrategy', e.target.value)}
            >
              <option value="random">{t('backendConfig.strategyRandom')}</option>
              <option value="fallback">{t('backendConfig.strategyFallback')}</option>
            </CustomSelect>
            <span className="field__hint">{t('backendConfig.strategyHint')}</span>
          </label>
          <label className="field">
            <span>{t('backendConfig.checkAvailability')}</span>
            <CustomSelect
              disabled={readOnly}
              value={String(oaiConfig.checkAvailable ?? 'true')}
              onChange={(e) => updateOai('checkAvailable', e.target.value === 'true')}
            >
              <option value="true">{t('common.yes')}</option>
              <option value="false">{t('common.no')}</option>
            </CustomSelect>
          </label>
          <label className="field">
            <span>{t('backendConfig.apiTimeout')}</span>
            <input
              disabled={readOnly}
              type="number"
              value={String(oaiConfig.apiTimeout ?? 300)}
              onChange={(e) => updateOai('apiTimeout', Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>{t('backendConfig.globalRpm')}</span>
            <input
              disabled={readOnly}
              type="number"
              min={0}
              value={String(oaiConfig.globalRequestRPM ?? 0)}
              onChange={(e) => updateOai('globalRequestRPM', Number(e.target.value))}
            />
            <span className="field__hint">{t('backendConfig.globalRpmHint')}</span>
          </label>
          <label className="field">
            <span>{t('backendConfig.apiErrorWait')}</span>
            <input
              disabled={readOnly}
              type="text"
              value={String(oaiConfig.apiErrorWait ?? 'auto')}
              onChange={(e) => updateOai('apiErrorWait', e.target.value)}
            />
            <span className="field__hint">{t('backendConfig.apiErrorWaitHint')}</span>
          </label>
        </>
      )}

      {/* SakuraLLM section */}
      {hasSakura && (
        <>
          <h3 className="config-section-title" style={{ marginTop: hasOai ? '24px' : undefined }}>{t('backendConfig.sakuraLocal')}</h3>
          
          <div className="token-list">
            <div className="token-list__header">
              <span className="token-list__title">{t('backendConfig.endpointList')}</span>
              {!readOnly && (
                <button type="button" className="token-list__add-btn" onClick={addSakuraEndpoint}>
                  {t('backendConfig.addEndpoint')}
                </button>
              )}
            </div>

            {sakuraEndpoints.length === 0 && (
              <div className="token-list__empty">
                {t('backendConfig.emptyEndpoints')}
              </div>
            )}

            {sakuraEndpoints.map((ep, idx) => (
              <div key={idx} className="token-entry" style={{ marginBottom: '12px' }}>
                <div className="token-entry__header">
                  <span className="token-entry__index">{t('backendConfig.endpointIndex', { index: idx + 1 })}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      className="token-entry__remove-btn"
                      onClick={() => removeSakuraEndpoint(idx)}
                      title={t('backendConfig.deleteEndpoint')}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <label className="field field--inline">
                  <span>{t('backendConfig.endpointAddress')}</span>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={ep}
                    onChange={(e) => updateSakuraEndpoint(idx, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSakuraEndpoint();
                      }
                    }}
                    placeholder="http://127.0.0.1:8501"
                  />
                </label>
              </div>
            ))}
          </div>

          <label className="field" style={{ marginTop: '12px' }}>
            <span>{t('backendConfig.customModelName')}</span>
            <input
              disabled={readOnly}
              type="text"
              value={String(sakuraConfig.rewriteModelName ?? '')}
              onChange={(e) => updateSakura('rewriteModelName', e.target.value)}
            />
            <span className="field__hint">{t('backendConfig.customModelNameHint')}</span>
          </label>
        </>
      )}
    </>
  );
}
