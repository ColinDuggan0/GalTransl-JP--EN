import { useCallback } from 'react';
import { CustomSelect } from './CustomSelect';
import { t } from '../i18n';

type ProxyEntry = {
  address: string;
  username?: string;
  password?: string;
};

type ProxyConfigEditorProps = {
  proxyConfig: Record<string, unknown>;
  onChange: (newConfig: Record<string, unknown>) => void;
  readOnly?: boolean;
};

export function ProxyConfigEditor({ proxyConfig, onChange, readOnly = false }: ProxyConfigEditorProps) {
  const enableProxy = proxyConfig.enableProxy === true;
  const proxies = (Array.isArray(proxyConfig.proxies) ? proxyConfig.proxies : []) as ProxyEntry[];

  const toggleEnableProxy = useCallback((enabled: boolean) => {
    if (readOnly) return;
    onChange({ ...proxyConfig, enableProxy: enabled });
  }, [proxyConfig, onChange, readOnly]);

  const addProxy = useCallback(() => {
    if (readOnly) return;
    onChange({ ...proxyConfig, proxies: [...proxies, { address: '' }] });
  }, [proxyConfig, proxies, onChange, readOnly]);

  const removeProxy = useCallback((index: number) => {
    if (readOnly) return;
    const next = proxies.filter((_, i) => i !== index);
    onChange({ ...proxyConfig, proxies: next });
  }, [proxyConfig, proxies, onChange, readOnly]);

  const updateProxy = useCallback((index: number, field: keyof ProxyEntry, value: string) => {
    if (readOnly) return;
    const next = proxies.map((p, i) => i === index ? { ...p, [field]: value } : p);
    onChange({ ...proxyConfig, proxies: next });
  }, [proxyConfig, proxies, onChange, readOnly]);

  return (
    <>
      <h3 className="config-section-title" style={{ marginTop: '24px' }}>{t('proxy.title')}</h3>

      <label className="field">
        <span>{t('proxy.enable')}</span>
        <CustomSelect
          disabled={readOnly}
          value={String(enableProxy)}
          onChange={(e) => toggleEnableProxy(e.target.value === 'true')}
        >
          <option value="true">{t('common.yes')}</option>
          <option value="false">{t('common.no')}</option>
        </CustomSelect>
        <span className="field__hint">{t('proxy.hint')}</span>
      </label>

      {enableProxy && (
        <div className="token-list">
          <div className="token-list__header">
            <span className="token-list__title">{t('proxy.list')}</span>
            {!readOnly && (
              <button type="button" className="token-list__add-btn" onClick={addProxy}>
                {t('proxy.add')}
              </button>
            )}
          </div>

          {proxies.length === 0 && (
            <div className="token-list__empty">
              {t('proxy.empty')}
            </div>
          )}

          {proxies.map((p, idx) => (
            <div key={idx} className="token-entry">
              <div className="token-entry__header">
                <span className="token-entry__index">{t('proxy.index', { index: idx + 1 })}</span>
                {!readOnly && (
                  <button
                    type="button"
                    className="token-entry__remove-btn"
                    onClick={() => removeProxy(idx)}
                    title={t('proxy.delete')}
                  >
                    ✕
                  </button>
                )}
              </div>
              <label className="field field--inline">
                <span>{t('proxy.address')}</span>
                <input
                  type="text"
                  disabled={readOnly}
                  value={p.address ?? ''}
                  onChange={(e) => updateProxy(idx, 'address', e.target.value)}
                  placeholder="http://127.0.0.1:7890"
                />
              </label>
              <label className="field field--inline">
                <span>{t('proxy.username')}</span>
                <input
                  type="text"
                  disabled={readOnly}
                  value={p.username ?? ''}
                  onChange={(e) => updateProxy(idx, 'username', e.target.value)}
                  placeholder={t('proxy.optional')}
                />
              </label>
              <label className="field field--inline">
                <span>{t('proxy.password')}</span>
                <input
                  type="password"
                  disabled={readOnly}
                  value={p.password ?? ''}
                  onChange={(e) => updateProxy(idx, 'password', e.target.value)}
                  placeholder={t('proxy.optional')}
                />
              </label>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
