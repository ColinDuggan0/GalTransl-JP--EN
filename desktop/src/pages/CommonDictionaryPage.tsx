import { useCallback, useEffect, useState } from 'react';
import { DictionaryManager } from '../components/DictionaryManager';
import {
  createCommonDictionaryFile,
  deleteCommonDictionaryFile,
  fetchCommonDictionaryManager,
  saveCommonDictionaryFile,
  type CommonDictionaryManagerResponse,
  type DictionaryCategory } from '../lib/api';
import { normalizeError } from '../lib/errors';
import { t } from '../i18n';


export function CommonDictionaryPage() {
  const [data, setData] = useState<CommonDictionaryManagerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCommonDictionaryManager();
      setData(res);
    } catch (err) {
      setError(normalizeError(err, t('dictionary.common.errorLoad')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <DictionaryManager
      title={t('dictionary.common.title')}
      description={t('dictionary.common.description')}
      data={data}
      loading={loading}
      error={error}
      onReload={loadData}
      onCreateFile={async (category: DictionaryCategory, filename: string) => {
        const result = await createCommonDictionaryFile({ category, filename });
        return result.filename;
      }}
      onSaveFile={async (fileKey: string, content: string) => {
        await saveCommonDictionaryFile({ filename: fileKey, content });
      }}
      onDeleteFile={async (fileKey: string) => {
        await deleteCommonDictionaryFile({ filename: fileKey });
      }}
    />
  );
}
