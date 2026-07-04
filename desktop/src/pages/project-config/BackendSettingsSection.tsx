import { Panel } from '../../components/Panel';
import { CustomSelect } from '../../components/CustomSelect';
import { BackendConfigEditor } from '../../components/BackendConfigEditor';
import { InlineFeedback } from '../../components/page-state';
import { ProxyConfigEditor } from '../../components/ProxyConfigEditor';
import { t } from '../../i18n';

interface BackendSettingsSectionProps {
  config: Record<string, unknown> | null;
  selectedProfile: string;
  defaultProfileName: string;
  backendProfileNames: string[];
  onProfileChange: (profile: string) => void;
  onBackendChange: (newBackend: Record<string, unknown>) => void;
  onCommonChange: (newCommon: Record<string, unknown>) => void;
  onProxyChange: (newProxy: Record<string, unknown>) => void;
  onDirty: () => void;
}

export function BackendSettingsSection({
  config,
  selectedProfile,
  defaultProfileName,
  backendProfileNames,
  onProfileChange,
  onBackendChange,
  onCommonChange,
  onProxyChange,
  onDirty,
}: BackendSettingsSectionProps) {
  const resolvedProfile = selectedProfile === '__default__' ? defaultProfileName : selectedProfile;
  const commonConfig = (config?.common as Record<string, unknown>) || {};
  const autoAdjustWorkers = commonConfig.autoAdjustWorkers === true;

  return (
    <Panel title={t('projectConfig.backend.title')} description={t('projectConfig.backend.description')}>
      <div className="config-form">
        <label className="field">
          <span>{t('projectConfig.backend.globalProfile')}</span>
          <CustomSelect
            value={selectedProfile}
            onChange={(e) => onProfileChange(e.target.value)}
          >
            <option value="__default__">{t('wizard.backend.followDefault')}</option>
            <option value="">{t('wizard.backend.useProjectConfig')}</option>
            {backendProfileNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </CustomSelect>
          <span className="field__hint">
            {selectedProfile === '__default__'
              ? defaultProfileName
                ? t('wizard.backend.defaultConfigured', { name: defaultProfileName })
                : t('wizard.backend.defaultMissing')
              : selectedProfile
                ? t('wizard.backend.profileSelected', { name: selectedProfile })
                : t('wizard.backend.projectConfigSelected')}
          </span>
        </label>

        {resolvedProfile ? (
          <InlineFeedback
            tone="info"
            title={t('projectConfig.backend.usingGlobalTitle', { name: resolvedProfile })}
            description={t('projectConfig.backend.usingGlobalDescription')}
          />
        ) : (
          <BackendConfigEditor
            config={config?.backendSpecific as Record<string, unknown> || {}}
            onChange={(newBackend) => { onBackendChange(newBackend); onDirty(); }}
            proxy={(config?.proxy as { http?: string; https?: string } | undefined) ?? null}
          />
        )}

        <label className="field">
          <span>{t('projectConfig.backend.autoAdjustWorkers')}</span>
          <CustomSelect
            value={String(autoAdjustWorkers)}
            onChange={(e) => {
              onCommonChange({ ...commonConfig, autoAdjustWorkers: e.target.value === 'true' });
              onDirty();
            }}
          >
            <option value="true">{t('projectConfig.option.true')}</option>
            <option value="false">{t('projectConfig.option.false')}</option>
          </CustomSelect>
          <span className="field__hint">{t('projectConfig.backend.autoAdjustWorkersHint')}</span>
        </label>

        <ProxyConfigEditor
          proxyConfig={(config?.proxy as Record<string, unknown>) || {}}
          onChange={(newProxy) => { onProxyChange(newProxy); onDirty(); }}
        />
      </div>
    </Panel>
  );
}
