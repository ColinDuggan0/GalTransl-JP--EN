import { useEffect, useMemo, useState } from 'react';
import { Panel } from '../../components/Panel';
import { ConfigFieldRow, ConfigFieldGroup, type ConfigFieldDef } from './ConfigFieldRow';
import { fetchTranslationGuidelines } from '../../lib/api';
import { t } from '../../i18n';

// ── Primary (high-frequency) fields ──
const PRIMARY_FIELDS: ConfigFieldDef[] = [
  { key: 'workersPerProject', label: t('projectConfig.common.workers.label'), description: t('projectConfig.common.workers.description'), type: 'number', placeholder: '16' },
  { key: 'gpt.numPerRequestTranslate', label: t('projectConfig.common.numPerRequest.label'), description: t('projectConfig.common.numPerRequest.description'), type: 'number', placeholder: '16' },
  { key: 'gpt.dynamicNumPerRequestTranslate', label: t('projectConfig.common.dynamicNum.label'), description: t('projectConfig.common.dynamicNum.description'), type: 'select', options: ['true', 'false'], optionLabels: { true: t('projectConfig.option.true'), false: t('projectConfig.option.false') } },
  { key: 'gpt.dynamicNumPerRequestTranslate.min', label: t('projectConfig.common.dynamicMin.label'), description: t('projectConfig.common.dynamicMin.description'), type: 'number', placeholder: '8' },
  { key: 'gpt.dynamicNumPerRequestTranslate.max', label: t('projectConfig.common.dynamicMax.label'), description: t('projectConfig.common.dynamicMax.description'), type: 'number', placeholder: '64' },
  { key: 'language', label: t('projectConfig.common.language.label'), description: t('projectConfig.common.language.description'), type: 'select', options: ['zh-cn', 'zh-tw', 'en', 'ja', 'ko', 'ru', 'fr'], optionLabels: { 'zh-cn': t('projectConfig.option.zhCn'), 'zh-tw': t('projectConfig.option.zhTw'), en: t('projectConfig.option.en'), ja: t('projectConfig.option.ja'), ko: t('projectConfig.option.ko'), ru: t('projectConfig.option.ru'), fr: t('projectConfig.option.fr') } },
  { key: 'sortBy', label: t('projectConfig.common.sortBy.label'), description: t('projectConfig.common.sortBy.description'), type: 'select', options: ['name', 'size'], optionLabels: { name: t('projectConfig.option.name'), size: t('projectConfig.option.size') } },
  { key: 'splitFile', label: t('projectConfig.common.splitFile.label'), description: t('projectConfig.common.splitFile.description'), type: 'select', options: ['no', 'Num', 'Equal'], optionLabels: { no: t('projectConfig.option.no'), Num: t('projectConfig.option.num'), Equal: t('projectConfig.option.equal') } },
  { key: 'splitFileNum', label: t('projectConfig.common.splitFileNum.label'), description: t('projectConfig.common.splitFileNum.description'), type: 'number', placeholder: '2048' },
  { key: 'gpt.contextNum', label: t('projectConfig.common.contextNum.label'), description: t('projectConfig.common.contextNum.description'), type: 'number', placeholder: '8' },
  { key: 'gpt.translation_guideline', label: t('projectConfig.common.guideline.label'), description: t('projectConfig.common.guideline.description'), type: 'select', options: [] },
];

// ── Advanced (low-frequency) fields ──
const ADVANCED_FIELDS: ConfigFieldDef[] = [
  { key: 'splitFileCrossNum', label: t('projectConfig.common.splitCross.label'), description: t('projectConfig.common.splitCross.description'), type: 'number', placeholder: '0' },
  { key: 'save_steps', label: t('projectConfig.common.saveSteps.label'), description: t('projectConfig.common.saveSteps.description'), type: 'number', placeholder: '1' },
  { key: 'start_time', label: t('projectConfig.common.startTime.label'), description: t('projectConfig.common.startTime.description'), type: 'text', placeholder: t('projectConfig.common.startTime.placeholder') },
  { key: 'linebreakSymbol', label: t('projectConfig.common.linebreak.label'), description: t('projectConfig.common.linebreak.description'), type: 'text', placeholder: 'auto' },
  { key: 'skipH', label: t('projectConfig.common.skipH.label'), description: t('projectConfig.common.skipH.description'), type: 'select', options: ['true', 'false'], optionLabels: { true: t('projectConfig.option.true'), false: t('projectConfig.option.false') } },
  { key: 'smartRetry', label: t('projectConfig.common.smartRetry.label'), description: t('projectConfig.common.smartRetry.description'), type: 'select', options: ['true', 'false'], optionLabels: { true: t('projectConfig.option.true'), false: t('projectConfig.option.false') } },
  { key: 'retranslFail', label: t('projectConfig.common.retranslFail.label'), description: t('projectConfig.common.retranslFail.description'), type: 'select', options: ['true', 'false'], optionLabels: { true: t('projectConfig.option.true'), false: t('projectConfig.option.false') } },
  { key: 'gpt.enhance_jailbreak', label: t('projectConfig.common.enhanceJailbreak.label'), description: t('projectConfig.common.enhanceJailbreak.description'), type: 'select', options: ['true', 'false'], optionLabels: { true: t('projectConfig.option.true'), false: t('projectConfig.option.false') } },
  { key: 'gpt.change_prompt', label: t('projectConfig.common.changePrompt.label'), description: t('projectConfig.common.changePrompt.description'), type: 'select', options: ['no', 'AdditionalPrompt', 'OverwritePrompt'], optionLabels: { no: t('projectConfig.option.no'), AdditionalPrompt: t('projectConfig.option.additionalPrompt'), OverwritePrompt: t('projectConfig.option.overwritePrompt') } },
  { key: 'gpt.prompt_content', label: t('projectConfig.common.promptContent.label'), description: t('projectConfig.common.promptContent.description'), type: 'text' },
  { key: 'gpt.token_limit', label: t('projectConfig.common.tokenLimit.label'), description: t('projectConfig.common.tokenLimit.description'), type: 'number', placeholder: '0' },
  { key: 'loggingLevel', label: t('projectConfig.common.loggingLevel.label'), description: t('projectConfig.common.loggingLevel.description'), type: 'select', options: ['debug', 'info', 'warning'] },
  { key: 'saveLog', label: t('projectConfig.common.saveLog.label'), description: t('projectConfig.common.saveLog.description'), type: 'select', options: ['true', 'false'], optionLabels: { true: t('projectConfig.option.true'), false: t('projectConfig.option.false') } },
];

interface CommonSettingsSectionProps {
  commonConfig: Record<string, unknown>;
  onFieldChange: (path: string, value: string) => void;
  onListFieldChange?: (path: string, value: string[]) => void;
}

export function CommonSettingsSection({ commonConfig, onFieldChange, onListFieldChange }: CommonSettingsSectionProps) {
  const [guidelines, setGuidelines] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchTranslationGuidelines()
      .then((list) => { if (!cancelled) setGuidelines(list); })
      .catch(() => { /* optional; fallback to current value only */ });
    return () => { cancelled = true; };
  }, []);

  const primaryFields = useMemo<ConfigFieldDef[]>(() => {
    const currentGuideline = String(getFieldValue(commonConfig, 'gpt.translation_guideline') ?? '');
    const merged = [...guidelines];
    if (currentGuideline && !merged.includes(currentGuideline)) {
      merged.unshift(currentGuideline);
    }
    return PRIMARY_FIELDS.map((field) =>
      field.key === 'gpt.translation_guideline'
        ? { ...field, options: merged }
        : field,
    );
  }, [commonConfig, guidelines]);

  return (
    <Panel title={t('projectConfig.common.title')} description={t('projectConfig.common.description')}>
      <ConfigFieldGroup title={t('projectConfig.common.primary')} tier="primary">
        {primaryFields.map((field) => (
          <ConfigFieldRow
            key={field.key}
            field={field}
            value={getFieldValue(commonConfig, field.key)}
            onChange={onFieldChange}
            pathPrefix="common"
            tier="primary"
          />
        ))}
      </ConfigFieldGroup>

      <details className="config-advanced-details">
        <summary className="config-advanced-details__summary">{t('projectConfig.common.advanced')}</summary>
        <ConfigFieldGroup title={t('projectConfig.common.advanced')} tier="advanced">
          {ADVANCED_FIELDS.map((field) => (
            <ConfigFieldRow
              key={field.key}
              field={field}
              value={getFieldValue(commonConfig, field.key)}
              onChange={onFieldChange}
              onListChange={onListFieldChange}
              pathPrefix="common"
              tier="advanced"
            />
          ))}
        </ConfigFieldGroup>
      </details>
    </Panel>
  );
}

/**
 * Get a value from an object by dot-separated path. Prefers literal flat keys
 * (YAML under `common:` uses flat dotted keys like `gpt.translation_guideline`).
 */
function getFieldValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (let i = 0; i < keys.length; i++) {
    if (current == null || typeof current !== 'object') return undefined;
    const remaining = keys.slice(i).join('.');
    const cur = current as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(cur, remaining)) {
      return cur[remaining];
    }
    current = cur[keys[i]];
  }
  return current;
}
