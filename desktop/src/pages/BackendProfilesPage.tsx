import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackendConfigEditor } from '../components/BackendConfigEditor';
import { Button } from '../components/Button';
import { CustomSelect } from '../components/CustomSelect';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { EmptyState, InlineFeedback, LoadingState } from '../components/page-state';
import { ProxyConfigEditor } from '../components/ProxyConfigEditor';
import {
  BACKEND_PROFILE_PRESETS,
  cloneBackendProfilePresetProfile,
  getBackendProfilePreset,
  type BackendProfilePresetId,
} from '../lib/backendProfilePresets';
import {
  createBackendProfile,
  deleteBackendProfile,
  fetchBackendProfiles,
  getDefaultBackendProfile,
  setDefaultBackendProfile } from '../lib/api';
import { normalizeError } from '../lib/errors';
import { t } from '../i18n';

type ProfileEntry = {
  name: string;
  config: Record<string, unknown>;
};

const DEFAULT_BACKEND_CONFIG: Record<string, unknown> = {};
const MISSING_PROFILE_META = '—';

function getRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getFirstArrayRecord(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return getRecord(value[0]);
}

function getFirstArrayString(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return getNonEmptyString(value[0]);
}

function getNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getProfileMeta(config: Record<string, unknown>) {
  const openAiCompatible = getRecord(config['OpenAI-Compatible']);
  const firstOpenAiToken = getFirstArrayRecord(openAiCompatible?.tokens);
  const sakuraLlm = getRecord(config.SakuraLLM);
  const firstSakuraEndpoint = getFirstArrayString(sakuraLlm?.endpoints);

  const baseUrl =
    getNonEmptyString(firstOpenAiToken?.endpoint) ??
    firstSakuraEndpoint ??
    MISSING_PROFILE_META;

  const modelName =
    getNonEmptyString(firstOpenAiToken?.modelName) ??
    getNonEmptyString(sakuraLlm?.rewriteModelName) ??
    MISSING_PROFILE_META;

  return { baseUrl, modelName };
}


export function BackendProfilesPage() {
  const [profiles, setProfiles] = useState<ProfileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultProfile, setDefaultProfileState] = useState(getDefaultBackendProfile());

  // Editor state
  const [editingName, setEditingName] = useState('');
  const [editingConfig, setEditingConfig] = useState<Record<string, unknown>>(DEFAULT_BACKEND_CONFIG);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New-profile dialog state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileNameEdited, setNewProfileNameEdited] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<BackendProfilePresetId>('blank');
  const [creating, setCreating] = useState(false);
  const selectedPreset = useMemo(() => getBackendProfilePreset(selectedPresetId), [selectedPresetId]);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBackendProfiles();
      const entries: ProfileEntry[] = Object.entries(data.profiles || {}).map(
        ([name, config]) => ({ name, config: config as Record<string, unknown> })
      );
      setProfiles(entries);
    } catch (err) {
      setError(normalizeError(err, t('backendProfiles.errorLoad')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const openNewDialog = useCallback(() => {
    setNewProfileName('');
    setNewProfileNameEdited(false);
    setSelectedPresetId('blank');
    setShowNewDialog(true);
    setError(null);
    setSaveSuccess(false);
  }, []);

  const closeNewDialog = useCallback(() => {
    if (creating) return;
    setShowNewDialog(false);
    setNewProfileName('');
    setNewProfileNameEdited(false);
    setSelectedPresetId('blank');
  }, [creating]);

  const handlePresetChange = useCallback((presetId: string) => {
    const nextPreset = getBackendProfilePreset(presetId as BackendProfilePresetId);
    setSelectedPresetId(nextPreset.id);
    if (!newProfileNameEdited) {
      setNewProfileName(nextPreset.suggestedProfileName);
    }
  }, [newProfileNameEdited]);

  const handleCreate = useCallback(async () => {
    const name = newProfileName.trim();
    if (!name) {
      setError(t('backendProfiles.errorNameRequired'));
      return;
    }
    if (profiles.some((p) => p.name === name)) {
      setError(t('backendProfiles.errorNameExists', { name }));
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const newConfig = cloneBackendProfilePresetProfile(selectedPreset);
      await createBackendProfile(name, newConfig);
      setSaveSuccess(true);
      setShowNewDialog(false);
      setNewProfileName('');
      setNewProfileNameEdited(false);
      setSelectedPresetId('blank');
      await loadProfiles();
      // Immediately open the edit dialog for the new profile
      setEditingName(name);
      setEditingConfig(newConfig);
      setIsEditing(true);
    } catch (err) {
      setError(normalizeError(err, t('backendProfiles.errorCreate')));
    } finally {
      setCreating(false);
    }
  }, [newProfileName, profiles, loadProfiles, selectedPreset]);

  const handleEdit = useCallback((entry: ProfileEntry) => {
    setIsEditing(true);
    setEditingName(entry.name);
    setEditingConfig(JSON.parse(JSON.stringify(entry.config)));
    setSaveSuccess(false);
    setError(null);
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditingName('');
    setEditingConfig(DEFAULT_BACKEND_CONFIG);
    setSaveSuccess(false);
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    const name = editingName.trim();
    if (!name) {
      setError(t('backendProfiles.errorNameRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      await createBackendProfile(name, editingConfig);
      setSaveSuccess(true);
      setIsEditing(false);
      void loadProfiles();
    } catch (err) {
      setError(normalizeError(err, t('backendProfiles.errorSave')));
    } finally {
      setSaving(false);
    }
  }, [editingName, editingConfig, loadProfiles]);

  const handleDelete = useCallback(async (name: string) => {
    if (!confirm(t('backendProfiles.confirmDelete', { name }))) return;
    try {
      await deleteBackendProfile(name);
      // If we're editing this profile, close the editor
      if (editingName === name) {
        handleCancel();
      }
      void loadProfiles();
    } catch (err) {
      setError(normalizeError(err, t('backendProfiles.errorDelete')));
    }
  }, [editingName, handleCancel, loadProfiles]);

  return (
    <div className="backend-profiles-page">
      <PageHeader
        className="backend-profiles-page__header"
        title={t('backendProfiles.title')}
        description={t('backendProfiles.description')}
        status={
          <>
            {error && <InlineFeedback tone="error" title={t('common.operationFailed')} description={error} />}
            {saveSuccess && <InlineFeedback className="inline-alert--floating" tone="success" title={t('backendProfiles.savedTitle')} description={t('backendProfiles.savedDescription')} onDismiss={() => setSaveSuccess(false)} />}
          </>
        }
      />

      <div className="backend-profiles-page__content">
        <Panel
          className="backend-profiles-page__list-panel"
          title={t('backendProfiles.listTitle')}
          description={t('backendProfiles.listDescription')}
          actions={(
            <Button onClick={openNewDialog}>
              {t('backendProfiles.newConfig')}
            </Button>
          )}
        >
          {loading ? (
            <LoadingState title={t('backendProfiles.loadingTitle')} description={t('backendProfiles.loadingDescription')} />
          ) : profiles.length === 0 ? (
            <EmptyState
              title={t('backendProfiles.emptyTitle')}
              description={t('backendProfiles.emptyDescription')}
            />
          ) : (
            <div className="profile-list">
              {profiles.map((entry) => {
                const { baseUrl, modelName } = getProfileMeta(entry.config);

                return (
                  <div key={entry.name} className="profile-card">
                    <div className="profile-card__info">
                      <div className="profile-card__name">
                        {entry.name}
                        {defaultProfile === entry.name && (
                          <span className="profile-card__badge">{t('backendProfiles.defaultBadge')}</span>
                        )}
                      </div>
                      <div className="profile-card__meta">Base URL: {baseUrl}</div>
                      <div className="profile-card__meta">{t('backendProfiles.model', { model: modelName })}</div>
                    </div>
                    <div className="profile-card__actions">
                      {defaultProfile !== entry.name ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setDefaultBackendProfile(entry.name);
                            setDefaultProfileState(entry.name);
                          }}
                        >
                          {t('backendProfiles.setDefault')}
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setDefaultBackendProfile('');
                            setDefaultProfileState('');
                          }}
                        >
                          {t('backendProfiles.clearDefault')}
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => handleEdit(entry)}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void handleDelete(entry.name)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

      </div>

      {isEditing && (
        <div
          className="backend-profiles-page__dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-dialog-title"
        >
          <div
            className="backend-profiles-page__dialog backend-profiles-page__dialog--wide"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="backend-profiles-page__dialog-header">
              <h3
                id="edit-profile-dialog-title"
                className="backend-profiles-page__dialog-title"
              >
                {t('backendProfiles.editTitle', { name: editingName })}
              </h3>
              <p className="backend-profiles-page__dialog-subtitle">
                {t('backendProfiles.editDescription')}
              </p>
            </header>

            <div className="backend-profiles-page__dialog-body">
              <div className="config-form">
                <BackendConfigEditor
                  config={editingConfig}
                  onChange={setEditingConfig}
                />

                <ProxyConfigEditor
                  proxyConfig={(editingConfig.proxy as Record<string, unknown>) || {}}
                  onChange={(newProxy) => {
                    setEditingConfig((prev) => ({ ...prev, proxy: newProxy }));
                    setSaveSuccess(false);
                  }}
                />
              </div>
              {error && <InlineFeedback tone="error" description={error} />}
            </div>

            <div className="form-actions">
              <Button variant="secondary" onClick={handleCancel} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => void handleSave()}
                disabled={saving || !editingName.trim()}
              >
                {saving ? t('common.saving') : t('common.saveConfig')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showNewDialog && (
        <div
          className="backend-profiles-page__dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-profile-dialog-title"
          onClick={closeNewDialog}
        >
          <div
            className="backend-profiles-page__dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="new-profile-dialog-title"
              className="backend-profiles-page__dialog-title"
            >
              {t('backendProfiles.newTitle')}
            </h3>
            <label className="field">
              <span>{t('backendProfiles.presetLabel')}</span>
              <CustomSelect
                value={selectedPresetId}
                onChange={(e) => handlePresetChange(e.target.value)}
                disabled={creating}
              >
                {BACKEND_PROFILE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {t(preset.labelKey)}
                  </option>
                ))}
              </CustomSelect>
              <span className="field__hint">{t('backendProfiles.presetHint')}</span>
            </label>
            <div className="backend-preset-description">
              {t(selectedPreset.descriptionKey)}
            </div>
            <label className="field">
              <span>{t('backendProfiles.nameLabel')}</span>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => {
                  setNewProfileName(e.target.value);
                  setNewProfileNameEdited(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); void handleCreate(); }
                  else if (e.key === 'Escape') { e.preventDefault(); closeNewDialog(); }
                }}
                placeholder={t('backendProfiles.namePlaceholder')}
                autoFocus
                disabled={creating}
              />
              <span className="field__hint">{t('backendProfiles.nameHint')}</span>
            </label>
            {error && <InlineFeedback tone="error" description={error} />}
            <div className="form-actions">
              <Button
                onClick={() => void handleCreate()}
                disabled={creating || !newProfileName.trim()}
              >
                {creating ? t('common.creating') : t('common.create')}
              </Button>
              <Button variant="secondary" onClick={closeNewDialog} disabled={creating}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
