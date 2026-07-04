import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { CustomSelect } from '../../components/CustomSelect';
import { Panel } from '../../components/Panel';
import { InlineFeedback } from '../../components/page-state/InlineFeedback';
import type { SubmitJobPayload, TranslatorOption } from '../../lib/api';
import { toDisplayError } from '../../lib/errors';
import { t } from '../../i18n';

type JobSubmitFormProps = {
  disabled: boolean;
  isSubmitting: boolean;
  onSubmit: (payload: SubmitJobPayload) => Promise<void>;
  submitError: string | null;
  translators: TranslatorOption[];
};

export function JobSubmitForm({ disabled, isSubmitting, onSubmit, submitError, translators }: JobSubmitFormProps) {
  const [projectDir, setProjectDir] = useState('');
  const [configFileName, setConfigFileName] = useState('config.yaml');
  const [translator, setTranslator] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const activeError = localError ?? submitError;
  const displayActiveError = activeError ? toDisplayError(activeError) : null;

  useEffect(() => {
    if (!translator && translators.length > 0) {
      setTranslator(translators[0].name);
    }
  }, [translator, translators]);

  return (
    <Panel
      title={t('jobs.submit.title')}
      description={t('jobs.submit.description')}
    >
      <form
        className="form-stack"
        onSubmit={async (event) => {
          event.preventDefault();

          const normalizedProjectDir = projectDir.trim();
          const normalizedConfig = configFileName.trim() || 'config.yaml';

          if (!normalizedProjectDir) {
            setLocalError(t('jobs.submit.errorProjectDir'));
            return;
          }

          if (!translator) {
            setLocalError(t('jobs.submit.errorTranslator'));
            return;
          }

          setLocalError(null);
          await onSubmit({
            config_file_name: normalizedConfig,
            project_dir: normalizedProjectDir,
            translator,
          });
        }}
      >
        <label className="field">
          <span>{t('jobs.submit.projectDir')}</span>
          <input
            autoComplete="off"
            disabled={disabled || isSubmitting}
            onChange={(event) => setProjectDir(event.target.value)}
            placeholder={t('jobs.submit.projectDirPlaceholder')}
            value={projectDir}
          />
        </label>

        <label className="field">
          <span>{t('jobs.submit.configFileName')}</span>
          <input
            autoComplete="off"
            disabled={disabled || isSubmitting}
            onChange={(event) => setConfigFileName(event.target.value)}
            value={configFileName}
          />
        </label>

        <label className="field">
          <span>{t('jobs.submit.translatorTemplate')}</span>
          <CustomSelect
            disabled={disabled || isSubmitting || translators.length === 0}
            onChange={(event) => setTranslator(event.target.value)}
            value={translator}
          >
            {translators.length === 0 ? <option value="">{t('jobs.submit.noTemplates')}</option> : null}
            {translators.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name} · {item.description}
              </option>
            ))}
          </CustomSelect>
        </label>

        {displayActiveError ? (
          <InlineFeedback tone="error" title={t('jobs.submit.submitFailed')} description={displayActiveError} />
        ) : (
          <InlineFeedback tone="info" title={t('jobs.submit.connectionHintTitle')}>
            {t('jobs.submit.connectionHintPrefix')}<code>VITE_BACKEND_URL</code>{t('jobs.submit.connectionHintSuffix')}
            <code>http://127.0.0.1:12333</code>.
          </InlineFeedback>
        )}

        <div className="form-actions">
          <Button disabled={disabled || isSubmitting} type="submit">
            {isSubmitting ? t('jobs.submit.submitting') : t('jobs.submit.startJob')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
