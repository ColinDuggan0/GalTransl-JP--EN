import { Panel } from '../../components/Panel';
import { CustomSelect } from '../../components/CustomSelect';
import { t } from '../../i18n';

interface DictionarySettingsSectionProps {
  dictConfig: Record<string, unknown>;
  onChange: (newConfig: Record<string, unknown>) => void;
}

export function DictionarySettingsSection({ dictConfig, onChange }: DictionarySettingsSectionProps) {
  return (
    <Panel title={t('projectConfig.dictionary.title')} description={t('projectConfig.dictionary.description')}>
      <DictConfigEditor dictConfig={dictConfig} onChange={onChange} />
    </Panel>
  );
}

// ---- Dictionary Config Sub-editor ----

function DictConfigEditor({
  dictConfig,
  onChange }: {
  dictConfig: Record<string, unknown>;
  onChange: (newConfig: Record<string, unknown>) => void;
}) {
  return (
    <>
      <label className="field">
        <span>{t('projectConfig.dictionary.defaultFolder')}</span>
        <input
          type="text"
          value={String(dictConfig.defaultDictFolder ?? 'Dict')}
          onChange={(e) => onChange({ ...dictConfig, defaultDictFolder: e.target.value })}
        />
      </label>
      <label className="field">
        <span>{t('projectConfig.dictionary.preDict')}</span>
        <textarea
          rows={4}
          value={Array.isArray(dictConfig.preDict) ? (dictConfig.preDict as string[]).join('\n') : String(dictConfig.preDict ?? '')}
          onChange={(e) => onChange({ ...dictConfig, preDict: e.target.value.split('\n').filter(Boolean) })}
        />
        <span className="field__hint">{t('projectConfig.dictionary.lineHint')}</span>
      </label>
      <label className="field">
        <span>{t('projectConfig.dictionary.gptDict')}</span>
        <textarea
          rows={4}
          value={Array.isArray(dictConfig['gpt.dict']) ? (dictConfig['gpt.dict'] as string[]).join('\n') : String(dictConfig['gpt.dict'] ?? '')}
          onChange={(e) => onChange({ ...dictConfig, 'gpt.dict': e.target.value.split('\n').filter(Boolean) })}
        />
        <span className="field__hint">{t('projectConfig.dictionary.lineHint')}</span>
      </label>
      <label className="field">
        <span>{t('projectConfig.dictionary.postDict')}</span>
        <textarea
          rows={4}
          value={Array.isArray(dictConfig.postDict) ? (dictConfig.postDict as string[]).join('\n') : String(dictConfig.postDict ?? '')}
          onChange={(e) => onChange({ ...dictConfig, postDict: e.target.value.split('\n').filter(Boolean) })}
        />
        <span className="field__hint">{t('projectConfig.dictionary.lineHint')}</span>
      </label>
      <label className="field">
        <span>{t('projectConfig.dictionary.usePreInName')}</span>
        <CustomSelect
          value={String(dictConfig.usePreDictInName ?? 'false')}
          onChange={(e) => onChange({ ...dictConfig, usePreDictInName: e.target.value === 'true' })}
        >
          <option value="true">{t('common.yes')}</option>
          <option value="false">{t('common.no')}</option>
        </CustomSelect>
      </label>
      <label className="field">
        <span>{t('projectConfig.dictionary.useGptInName')}</span>
        <CustomSelect
          value={String(dictConfig.useGPTDictInName ?? 'false')}
          onChange={(e) => onChange({ ...dictConfig, useGPTDictInName: e.target.value === 'true' })}
        >
          <option value="true">{t('common.yes')}</option>
          <option value="false">{t('common.no')}</option>
        </CustomSelect>
      </label>
      <label className="field">
        <span>{t('projectConfig.dictionary.usePostInName')}</span>
        <CustomSelect
          value={String(dictConfig.usePostDictInName ?? 'false')}
          onChange={(e) => onChange({ ...dictConfig, usePostDictInName: e.target.value === 'true' })}
        >
          <option value="true">{t('common.yes')}</option>
          <option value="false">{t('common.no')}</option>
        </CustomSelect>
      </label>
      <label className="field">
        <span>{t('projectConfig.dictionary.sortDict')}</span>
        <CustomSelect
          value={String(dictConfig.sortDict ?? 'true')}
          onChange={(e) => onChange({ ...dictConfig, sortDict: e.target.value === 'true' })}
        >
          <option value="true">{t('common.yes')}</option>
          <option value="false">{t('common.no')}</option>
        </CustomSelect>
      </label>
    </>
  );
}
