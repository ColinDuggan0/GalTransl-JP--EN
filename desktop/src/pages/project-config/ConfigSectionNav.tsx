import type { ReactNode } from 'react';
import { t, type TranslationKey } from '../../i18n';

export type ConfigSectionKey = 'common' | 'backendSpecific' | 'plugin' | 'dictionary' | 'problemAnalyze' | 'retranslKey';

export interface ConfigSectionDef {
  key: ConfigSectionKey;
  labelKey: TranslationKey;
  icon: string;
}

export const CONFIG_SECTIONS: ConfigSectionDef[] = [
  { key: 'common', labelKey: 'projectConfig.nav.common', icon: '⚙️' },
  { key: 'backendSpecific', labelKey: 'projectConfig.nav.backend', icon: '🤖' },
  { key: 'plugin', labelKey: 'projectConfig.nav.plugin', icon: '🧩' },
  { key: 'dictionary', labelKey: 'projectConfig.nav.dictionary', icon: '📖' },
  { key: 'problemAnalyze', labelKey: 'projectConfig.nav.problemAnalyze', icon: '🔍' },
  { key: 'retranslKey', labelKey: 'projectConfig.nav.retranslKey', icon: '🔁' },
];

interface ConfigSectionNavProps {
  activeSection: ConfigSectionKey;
  onSectionChange: (section: ConfigSectionKey) => void;
  yamlView: boolean;
  onYamlToggle: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  disabled?: boolean;
  extraActions?: ReactNode;
}

export function ConfigSectionNav({
  activeSection,
  onSectionChange,
  yamlView,
  onYamlToggle,
  onSave,
  saving,
  dirty,
  disabled = false,
}: ConfigSectionNavProps) {
  return (
    <aside className="project-config-page__sidebar">
      {CONFIG_SECTIONS.map((section) => (
        <button
          type="button"
          key={section.key}
          className={`project-config-page__section-btn ${activeSection === section.key ? 'project-config-page__section-btn--active' : ''}`}
          onClick={() => { onSectionChange(section.key); }}
        >
          <span>{section.icon}</span>
          <span>{t(section.labelKey)}</span>
        </button>
      ))}
      <button
        type="button"
        className="project-config-page__save-btn"
        onClick={onSave}
        disabled={saving || disabled}
      >
        <span>💾</span>
        <span>{saving ? t('common.saving') : t('common.saveConfig')}{dirty && !saving && <span style={{ color: '#e53e3e', marginLeft: 4 }}>●</span>}</span>
      </button>
      <div className="project-config-page__section-divider" />
      <button
        type="button"
        className={`project-config-page__section-btn ${yamlView ? 'project-config-page__section-btn--active' : ''}`}
        onClick={onYamlToggle}
      >
        <span>📝</span>
        <span>{t('projectConfig.yamlSource')}</span>
      </button>
    </aside>
  );
}
