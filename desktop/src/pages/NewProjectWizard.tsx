import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Button } from '../components/Button';
import { CustomSelect } from '../components/CustomSelect';
import { Panel } from '../components/Panel';
import { PageHeader } from '../components/PageHeader';
import { InlineFeedback } from '../components/page-state';
import { t, type TranslationKey } from '../i18n';
import {
  BACKEND_PROFILES_CHANGE_EVENT,
  DEFAULT_BACKEND_PROFILE_CHANGE_EVENT,
  DEFAULT_PROJECT_CONFIG_PRESET_ID,
  type PluginInfo,
  type ProjectConfigPresetId,
  getDefaultBackendProfile,
  getBackendProfileNames,
  fetchPlugins,
  fetchDefaultProjectConfigTemplate,
  fetchProjectConfig,
  fetchTranslationGuidelines,
  updateProjectConfig,
  submitJob,
  fetchJob,
  encodeProjectDir,
} from '../lib/api';
import { addProjectToHistory } from './HomePage';

const STEP_KEYS = [
  'wizard.step.location',
  'wizard.step.import',
  'wizard.step.backend',
  'wizard.step.settings',
  'wizard.step.names',
] as const;
const LAST_PARENT_DIR_KEY = 'galtransl-new-project-last-parent-dir';
const JPEN_GUIDELINE_FILE = 'VN_JP-EN.md';
const ORIGINAL_GUIDELINE_FILE = 'Basic.md';

const PROJECT_CONFIG_PRESET_DEFAULTS: Record<ProjectConfigPresetId, { language: string; guideline: string }> = {
  original: { language: 'zh-cn', guideline: ORIGINAL_GUIDELINE_FILE },
  jpen: { language: 'en', guideline: JPEN_GUIDELINE_FILE },
};

const PROJECT_CONFIG_PRESET_OPTIONS: Array<{
  id: ProjectConfigPresetId;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
}> = [
  {
    id: 'original',
    labelKey: 'wizard.location.preset.original',
    descriptionKey: 'wizard.location.preset.originalDescription',
  },
  {
    id: 'jpen',
    labelKey: 'wizard.location.preset.jpen',
    descriptionKey: 'wizard.location.preset.jpenDescription',
  },
];

type NewProjectWizardProps = {
  onOpenProject: (projectDir: string, config: string) => void;
};

export function NewProjectWizard({ onOpenProject }: NewProjectWizardProps) {
  const navigate = useNavigate();
  const stepLabels = useMemo(() => STEP_KEYS.map((key) => t(key)), []);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Step 1 state
  const [parentDir, setParentDir] = useState(() => {
    try {
      return localStorage.getItem(LAST_PARENT_DIR_KEY) || '';
    } catch {
      return '';
    }
  });
  const [projectName, setProjectName] = useState('');
  const [projectCreated, setProjectCreated] = useState(false);
  const [selectedProjectPreset, setSelectedProjectPreset] = useState<ProjectConfigPresetId>(DEFAULT_PROJECT_CONFIG_PRESET_ID);

  // Step 2 state
  const [importedFiles, setImportedFiles] = useState<string[]>([]);

  // Step 3 state
  const [backendProfileNames, setBackendProfileNames] = useState<string[]>([]);
  const [selectedBackend, setSelectedBackend] = useState('__default__');
  const [defaultBackendName, setDefaultBackendName] = useState(() => getDefaultBackendProfile());

  // Step 4 state
  const [filePlugins, setFilePlugins] = useState<PluginInfo[]>([]);
  const [selectedFilePlugin, setSelectedFilePlugin] = useState('file_galtransl_json');
  const [workersPerProject, setWorkersPerProject] = useState(16);
  const [numPerRequest, setNumPerRequest] = useState(16);
  const [dynamicNumPerRequest, setDynamicNumPerRequest] = useState(false);
  const [dynamicNumPerRequestMin, setDynamicNumPerRequestMin] = useState(8);
  const [dynamicNumPerRequestMax, setDynamicNumPerRequestMax] = useState(64);
  const [language, setLanguage] = useState(PROJECT_CONFIG_PRESET_DEFAULTS[DEFAULT_PROJECT_CONFIG_PRESET_ID].language);
  const [guidelines, setGuidelines] = useState<string[]>([]);
  const [translationGuideline, setTranslationGuideline] = useState(PROJECT_CONFIG_PRESET_DEFAULTS[DEFAULT_PROJECT_CONFIG_PRESET_ID].guideline);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Step 5 state
  const [nameJobStatus, setNameJobStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [nameJobMessage, setNameJobMessage] = useState('');

  const projectDir = useMemo(() => {
    if (!parentDir || !projectName) return '';
    const sep = parentDir.includes('/') ? '/' : '\\';
    return `${parentDir}${sep}${projectName}`;
  }, [parentDir, projectName]);

  const gtInputDir = useMemo(() => {
    if (!projectDir) return '';
    const sep = projectDir.includes('/') ? '/' : '\\';
    return `${projectDir}${sep}gt_input`;
  }, [projectDir]);

  const selectedProjectPresetDescriptionKey = useMemo(() => {
    return PROJECT_CONFIG_PRESET_OPTIONS.find((option) => option.id === selectedProjectPreset)?.descriptionKey
      ?? 'wizard.location.preset.jpenDescription';
  }, [selectedProjectPreset]);

  const importPathsToInput = useCallback(
    async (paths: string[]) => {
      if (!gtInputDir || paths.length === 0) return;

      const existingNames = new Set(importedFiles.map((name) => name.toLowerCase()));
      const namesInBatch = new Set<string>();
      const pathsToImport: string[] = [];
      const acceptedNames: string[] = [];

      for (const p of paths) {
        const name = p.split(/[/\\]/).pop() || p;
        const key = name.toLowerCase();
        if (existingNames.has(key) || namesInBatch.has(key)) {
          continue;
        }
        namesInBatch.add(key);
        pathsToImport.push(p);
        acceptedNames.push(name);
      }

      if (pathsToImport.length === 0) {
        setFeedback({ type: 'info', message: t('wizard.feedback.duplicateFiles') });
        return;
      }

      try {
        await invoke('copy_files', { sources: pathsToImport, destinationDir: gtInputDir });
        setImportedFiles((prev) => [...prev, ...acceptedNames]);
        const filteredCount = paths.length - pathsToImport.length;
        setFeedback({
          type: 'success',
          message: filteredCount > 0
            ? t('wizard.feedback.importedWithDuplicates', { count: pathsToImport.length, duplicates: filteredCount })
            : t('wizard.feedback.imported', { count: pathsToImport.length }),
        });
      } catch (err) {
        setFeedback({ type: 'error', message: t('wizard.feedback.importFailed', { error: err instanceof Error ? err.message : String(err) }) });
      }
    },
    [gtInputDir, importedFiles],
  );

  useEffect(() => {
    const currentWindow = getCurrentWebviewWindow();
    let disposed = false;

    const unlistenPromise = currentWindow.onDragDropEvent((event: unknown) => {
      if (currentStep !== 1) return;
      const payload = (event as { payload?: { type?: string; paths?: string[] } })?.payload;
      if (payload?.type !== 'drop') return;
      const paths = Array.isArray(payload.paths) ? payload.paths : [];
      if (paths.length === 0) {
        setFeedback({ type: 'error', message: t('wizard.feedback.dropPathMissing') });
        return;
      }
      void importPathsToInput(paths);
    });

    return () => {
      disposed = true;
      void unlistenPromise.then((unlisten) => {
        if (!disposed) return;
        unlisten();
      });
    };
  }, [currentStep, importPathsToInput]);

  useEffect(() => {
    try {
      if (parentDir.trim()) {
        localStorage.setItem(LAST_PARENT_DIR_KEY, parentDir);
      }
    } catch {
      // ignore storage errors
    }
  }, [parentDir]);

  // ── Step 1: Create project ──
  const handleSelectParentDir = useCallback(async () => {
    const selected = await open({ directory: true });
    if (selected) {
      // Normalize to backslash on Windows
      const path = typeof selected === 'string' ? selected.replace(/\//g, '\\') : selected;
      setParentDir(path);
    }
  }, []);

  const handleProjectPresetChange = useCallback((preset: ProjectConfigPresetId) => {
    const defaults = PROJECT_CONFIG_PRESET_DEFAULTS[preset];
    setSelectedProjectPreset(preset);
    setLanguage(defaults.language);
    setTranslationGuideline(defaults.guideline);
    setProjectCreated(false);
    setSettingsSaved(false);
  }, []);

  const handleCreateProject = useCallback(async () => {
    if (!projectDir) {
      setFeedback({ type: 'error', message: t('wizard.feedback.projectInfoRequired') });
      return;
    }
    try {
      const sep = projectDir.includes('/') ? '/' : '\\';
      const configYaml = await fetchDefaultProjectConfigTemplate(selectedProjectPreset);
      await invoke('create_dir', { path: projectDir });
      await invoke('create_dir', { path: `${projectDir}${sep}gt_input` });
      await invoke('create_dir', { path: `${projectDir}${sep}gt_output` });
      await invoke('create_dir', { path: `${projectDir}${sep}transl_cache` });
      await invoke('write_text_file', { path: `${projectDir}${sep}config.yaml`, content: configYaml });
      setProjectCreated(true);
      setFeedback({ type: 'success', message: t('wizard.feedback.projectCreated') });
    } catch (err) {
      setFeedback({ type: 'error', message: t('wizard.feedback.createFailed', { error: err instanceof Error ? err.message : String(err) }) });
    }
  }, [projectDir, selectedProjectPreset]);

  // ── Step 2: Import files ──
  const handleFileDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.classList.remove('drop-zone--over');
      if (!gtInputDir) return;
      const files = Array.from(e.dataTransfer.files);

      const directPaths = files
        .map((f) => (f as File & { path?: string }).path)
        .filter((p): p is string => Boolean(p && p.trim()));

      const parseDroppedUriList = () => {
        const uriData = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (!uriData) return [] as string[];

        return uriData
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('#'))
          .map((line) => {
            try {
              if (line.startsWith('file://')) {
                const url = new URL(line);
                const decoded = decodeURIComponent(url.pathname || '');
                const normalized = /^\/[A-Za-z]:/.test(decoded) ? decoded.slice(1) : decoded;
                return normalized.replace(/\//g, '\\');
              }
              return decodeURIComponent(line).replace(/\//g, '\\');
            } catch {
              return line.replace(/\//g, '\\');
            }
          })
          .filter((p) => /^[A-Za-z]:\\/.test(p) || p.startsWith('\\\\'));
      };

      const droppedPaths = directPaths.length > 0 ? directPaths : parseDroppedUriList();
      if (droppedPaths.length === 0) {
        setFeedback({ type: 'error', message: t('wizard.feedback.dropPathMissing') });
        return;
      }
      await importPathsToInput(droppedPaths);
    },
    [gtInputDir, importPathsToInput],
  );

  const handleFilePick = useCallback(async () => {
    if (!gtInputDir) return;
    const selected = await open({ multiple: true });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await importPathsToInput(paths as string[]);
  }, [gtInputDir, importPathsToInput]);

  const handleOpenInputFolder = useCallback(async () => {
    if (!gtInputDir) return;
    try {
      await invoke('open_folder', { path: gtInputDir });
    } catch (err) {
      setFeedback({ type: 'error', message: t('wizard.feedback.openInputFailed', { error: err instanceof Error ? err.message : String(err) }) });
    }
  }, [gtInputDir]);

  // ── Step 3: Load backend profiles on entry ──
  useEffect(() => {
    if (currentStep !== 2) return;
    setBackendProfileNames(getBackendProfileNames());
  }, [currentStep]);

  useEffect(() => {
    const onDefaultBackendChange = () => {
      setDefaultBackendName(getDefaultBackendProfile());
    };
    window.addEventListener(DEFAULT_BACKEND_PROFILE_CHANGE_EVENT, onDefaultBackendChange);
    return () => window.removeEventListener(DEFAULT_BACKEND_PROFILE_CHANGE_EVENT, onDefaultBackendChange);
  }, []);

  useEffect(() => {
    const onProfilesChange = () => {
      if (currentStep === 2) {
        setBackendProfileNames(getBackendProfileNames());
      }
    };
    window.addEventListener(BACKEND_PROFILES_CHANGE_EVENT, onProfilesChange);
    return () => window.removeEventListener(BACKEND_PROFILES_CHANGE_EVENT, onProfilesChange);
  }, [currentStep]);

  // ── Step 4: Load plugins on entry ──
  useEffect(() => {
    if (currentStep !== 3) return;
    fetchPlugins()
      .then((plugins) => {
        setFilePlugins(plugins.filter((p) => p.type === 'file'));
      })
      .catch(() => {});
    fetchTranslationGuidelines()
      .then((list) => {
        setGuidelines(list);
        setTranslationGuideline((prev) => {
          if (prev) return prev;
          const presetGuideline = PROJECT_CONFIG_PRESET_DEFAULTS[selectedProjectPreset].guideline;
          if (list.includes(presetGuideline)) return presetGuideline;
          if (list.includes(ORIGINAL_GUIDELINE_FILE)) return ORIGINAL_GUIDELINE_FILE;
          return list[0] || presetGuideline;
        });
      })
      .catch(() => {});
  }, [currentStep, selectedProjectPreset]);

  const handleSaveSettings = useCallback(async () => {
    if (!projectDir) return;
    try {
      const projectId = encodeProjectDir(projectDir);
      const res = await fetchProjectConfig(projectId, 'config.yaml');
      const config = { ...res.config };

      // Update common settings
      const common = { ...((config.common as Record<string, unknown>) || {}) };
      common.workersPerProject = workersPerProject;
      common.language = language;

      common['gpt.numPerRequestTranslate'] = numPerRequest;
      common['gpt.dynamicNumPerRequestTranslate'] = dynamicNumPerRequest;
      common['gpt.dynamicNumPerRequestTranslate.min'] = dynamicNumPerRequestMin;
      common['gpt.dynamicNumPerRequestTranslate.max'] = dynamicNumPerRequestMax;
      common['gpt.contextNum'] = 8;
      if (translationGuideline) {
        common['gpt.translation_guideline'] = translationGuideline;
      }

      config.common = common;

      const plugin: Record<string, unknown> = {
        ...((config.plugin as Record<string, unknown>) || {}),
        filePlugin: selectedFilePlugin,
      };
      if (!Array.isArray(plugin.textPlugins)) {
        plugin.textPlugins = [];
      }
      config.plugin = plugin;

      await updateProjectConfig(projectId, { config, config_file_name: 'config.yaml' });

      // Save backend profile selection
      const { setSelectedBackendProfile } = await import('../lib/api');
      setSelectedBackendProfile(projectDir, selectedBackend);

      setSettingsSaved(true);
      setFeedback({ type: 'success', message: t('wizard.feedback.settingsSaved') });
    } catch (err) {
      setFeedback({ type: 'error', message: t('wizard.feedback.saveFailed', { error: err instanceof Error ? err.message : String(err) }) });
    }
  }, [projectDir, workersPerProject, language, numPerRequest, dynamicNumPerRequest, dynamicNumPerRequestMin, dynamicNumPerRequestMax, selectedFilePlugin, selectedBackend, translationGuideline]);

  // ── Step 5: Auto-extract names on entry ──
  useEffect(() => {
    if (currentStep !== 4 || nameJobStatus !== 'idle' || !projectDir) return;

    // 空输入目录：不提交 dump-name 任务，直接给出友好提示
    if (importedFiles.length === 0) {
      setNameJobStatus('completed');
      setNameJobMessage(t('wizard.names.emptyInput'));
      return;
    }

    const run = async () => {
      try {
        setNameJobStatus('running');
        const job = await submitJob({
          project_dir: projectDir,
          config_file_name: 'config.yaml',
          translator: 'dump-name',
        });

        const poll = async () => {
          try {
            const status = await fetchJob(job.job_id);
            if (status.status === 'completed') {
              setNameJobStatus('completed');
              setNameJobMessage(status.success ? t('wizard.names.completed') : t('wizard.names.completedWithWarning', { error: status.error || '' }));
            } else if (status.status === 'failed') {
              setNameJobStatus('failed');
              setNameJobMessage(status.error || t('wizard.names.failed'));
            } else {
              setTimeout(poll, 2000);
            }
          } catch {
            setTimeout(poll, 3000);
          }
        };
        poll();
      } catch (err) {
        setNameJobStatus('failed');
        setNameJobMessage(err instanceof Error ? err.message : String(err));
      }
    };
    run();
    // eslint-disable-next-line react-hooks/react-hooks
  }, [currentStep]); // intentionally only depend on currentStep

  const handleFinish = useCallback(() => {
    if (!projectDir) return;
    onOpenProject(projectDir, 'config.yaml');
    addProjectToHistory(projectDir, 'config.yaml');
    const projectId = encodeProjectDir(projectDir);
    navigate(`/project/${projectId}/translate`);
  }, [projectDir, navigate, onOpenProject]);

  const canNext = useMemo(() => {
    if (currentStep === 0) return projectCreated;
    if (currentStep === 1) return true; // file import is optional
    if (currentStep === 2) return true; // backend selection is optional
    if (currentStep === 3) return settingsSaved;
    return false;
  }, [currentStep, projectCreated, settingsSaved]);

  const stepProgress = useMemo(
    () => Math.round(((currentStep + 1) / stepLabels.length) * 100),
    [currentStep, stepLabels.length],
  );

  useEffect(() => {
    if (!settingsSaved) return;
    setSettingsSaved(false);
  }, [selectedBackend, selectedFilePlugin, workersPerProject, numPerRequest, language]);

  // ── Step indicator ──
  const renderStepIndicator = () => (
    <ul className="wizard-steps">
      {stepLabels.map((label, i) => (
        <li
          key={i}
          className={`wizard-step${i === currentStep ? ' wizard-step--active' : ''}${i < currentStep ? ' wizard-step--completed' : ''}`}
        >
          <span className="wizard-step__number">{i < currentStep ? '✓' : i + 1}</span>
          <span className="wizard-step__label">{label}</span>
        </li>
      ))}
    </ul>
  );

  // ── Step 1 ──
  const renderStep1 = () => (
    <Panel title={t('wizard.location.title')} description={t('wizard.location.description')}>
      <div className="wizard-form-grid">
        <div className="field">
          <span className="field__label">{t('wizard.location.preset')}</span>
          <CustomSelect
            value={selectedProjectPreset}
            disabled={projectCreated}
            onChange={(e) => {
              const nextPreset: ProjectConfigPresetId = e.target.value === 'original' ? 'original' : 'jpen';
              handleProjectPresetChange(nextPreset);
            }}
          >
            {PROJECT_CONFIG_PRESET_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{t(option.labelKey)}</option>
            ))}
          </CustomSelect>
          <span className="field__hint">{t(selectedProjectPresetDescriptionKey)}</span>
        </div>
        <div className="field">
          <span className="field__label">{t('wizard.location.parentDir')}</span>
          <div className="field__row">
            <input
              className="field__input"
              autoComplete="off"
              value={parentDir}
              onChange={(e) => { setParentDir(e.target.value); setProjectCreated(false); }}
              placeholder={t('wizard.location.parentDirPlaceholder')}
            />
            <Button className="field__browse-button" variant="secondary" onClick={() => void handleSelectParentDir()}>
              {t('common.browse')}
            </Button>
          </div>
          <span className="field__hint">{t('wizard.location.pathHint')}</span>
        </div>
        <div className="field">
          <span className="field__label">{t('wizard.location.projectName')}</span>
          <input
            className="field__input"
            autoComplete="off"
            value={projectName}
            onChange={(e) => { setProjectName(e.target.value); setProjectCreated(false); }}
            placeholder={t('wizard.location.projectNamePlaceholder')}
          />
        </div>
        <div className="wizard-path-preview">
          <span className="wizard-path-preview__label">{t('wizard.location.createDir')}</span>
          <code className="wizard-path-preview__path">{projectDir || t('wizard.location.fillRequired')}</code>
          <div className="wizard-path-preview__meta">{t('wizard.location.includes')}</div>
        </div>
      </div>
      <div className="wizard-actions">
        <Button disabled={projectCreated || !parentDir || !projectName} onClick={() => void handleCreateProject()}>
          {projectCreated ? t('wizard.location.created') : t('common.createProject')}
        </Button>
      </div>
    </Panel>
  );

  // ── Step 2 ──
  const renderStep2 = () => (
    <Panel title={t('wizard.import.title')} description={t('wizard.import.description')}>
      <div
        className="drop-zone"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('drop-zone--over');
        }}
        onDragLeave={(e) => { e.currentTarget.classList.remove('drop-zone--over'); }}
        onDrop={(e) => void handleFileDrop(e)}
      >
        <div className="drop-zone__icon">📁</div>
        <div className="drop-zone__text">{t('wizard.import.drop')}</div>
      </div>
      <div className="wizard-actions">
        <Button variant="secondary" onClick={() => void handleFilePick()}>{t('wizard.import.chooseFiles')}</Button>
        <Button variant="secondary" onClick={() => void handleOpenInputFolder()} disabled={!gtInputDir}>{t('wizard.import.openInputFolder')}</Button>
      </div>
      <div className="wizard-tip-card">
        <strong>{t('wizard.import.tipTitle')}</strong>
        <span>{t('wizard.import.tip')}</span>
      </div>
      {importedFiles.length > 0 && (
        <ul className="wizard-file-list">
          {importedFiles.map((f, i) => (
            <li key={i} className="wizard-file-list__item">{f}</li>
          ))}
        </ul>
      )}
    </Panel>
  );

  // ── Step 3 ──
  const renderStep3 = () => (
    <Panel title={t('wizard.backend.title')} description={t('wizard.backend.description')}>
      <div className="field">
        <span className="field__label">{t('wizard.backend.profile')}</span>
        <CustomSelect value={selectedBackend} onChange={(e) => setSelectedBackend(e.target.value)}>
          <option value="__default__">{t('wizard.backend.followDefault')}</option>
          <option value="">{t('wizard.backend.useProjectConfig')}</option>
          {backendProfileNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </CustomSelect>
        <span className="field__hint">
          {selectedBackend === '__default__'
            ? defaultBackendName
              ? t('wizard.backend.defaultConfigured', { name: defaultBackendName })
              : t('wizard.backend.defaultMissing')
            : selectedBackend
              ? t('wizard.backend.profileSelected', { name: selectedBackend })
              : t('wizard.backend.projectConfigSelected')}
        </span>
      </div>
      <div className="wizard-tip-card">
        <strong>{t('wizard.backend.strategyTitle')}</strong>
        <span>{t('wizard.backend.strategy')}</span>
      </div>
    </Panel>
  );

  // ── Step 4 ──
  const renderStep4 = () => (
    <Panel title={t('wizard.settings.title')} description={t('wizard.settings.description')}>
      <div className="wizard-settings-grid">
      <div className="field wizard-settings-grid__full">
        <span className="field__label">{t('wizard.settings.filePlugin')}</span>
        <CustomSelect value={selectedFilePlugin} onChange={(e) => setSelectedFilePlugin(e.target.value)}>
          {filePlugins.length > 0 ? (
            filePlugins.map((p) => (
              <option key={p.name} value={p.name}>{p.display_name} ({p.name})</option>
            ))
          ) : (
            <option value={selectedFilePlugin}>{selectedFilePlugin}</option>
          )}
        </CustomSelect>
        <span className="field__hint">{t('wizard.settings.filePluginHint')}</span>
      </div>
      <div className="field">
        <span className="field__label">{t('wizard.settings.workers')}</span>
        <input
          className="field__input"
          type="number"
          min={1}
          value={workersPerProject}
          onChange={(e) => setWorkersPerProject(Number(e.target.value))}
        />
        <span className="field__hint">{t('wizard.settings.workersHint')}</span>
      </div>
      <div className="field">
        <span className="field__label">{t('wizard.settings.numPerRequest')}</span>
        <input
          className="field__input"
          type="number"
          min={1}
          value={numPerRequest}
          onChange={(e) => setNumPerRequest(Number(e.target.value))}
        />
        <span className="field__hint">{t('wizard.settings.numPerRequestHint')}</span>
      </div>
      <div className="field">
        <span className="field__label">{t('wizard.settings.dynamicNum')}</span>
        <CustomSelect value={String(dynamicNumPerRequest)} onChange={(e) => setDynamicNumPerRequest(e.target.value === 'true')}>
          <option value="false">{t('wizard.settings.off')}</option>
          <option value="true">{t('wizard.settings.on')}</option>
        </CustomSelect>
        <span className="field__hint">{t('wizard.settings.dynamicNumHint')}</span>
      </div>
      <div className="field">
        <span className="field__label">{t('wizard.settings.dynamicMin')}</span>
        <input
          className="field__input"
          type="number"
          min={1}
          value={dynamicNumPerRequestMin}
          onChange={(e) => setDynamicNumPerRequestMin(Number(e.target.value))}
        />
      </div>
      <div className="field">
        <span className="field__label">{t('wizard.settings.dynamicMax')}</span>
        <input
          className="field__input"
          type="number"
          min={1}
          value={dynamicNumPerRequestMax}
          onChange={(e) => setDynamicNumPerRequestMax(Number(e.target.value))}
        />
      </div>
      <div className="field wizard-settings-grid__full">
        <span className="field__label">{t('wizard.settings.targetLanguage')}</span>
        <CustomSelect value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="zh-cn">{t('wizard.settings.lang.zhCn')}</option>
          <option value="zh-tw">{t('wizard.settings.lang.zhTw')}</option>
          <option value="en">English</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
        </CustomSelect>
      </div>
      <div className="field wizard-settings-grid__full">
        <span className="field__label">{t('wizard.settings.guideline')}</span>
        <CustomSelect
          value={translationGuideline}
          onChange={(e) => setTranslationGuideline(e.target.value)}
        >
          {guidelines.length === 0 && translationGuideline === '' ? (
            <option value="">{t('wizard.settings.noGuidelines')}</option>
          ) : null}
          {translationGuideline && !guidelines.includes(translationGuideline) ? (
            <option value={translationGuideline}>{translationGuideline}</option>
          ) : null}
          {guidelines.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </CustomSelect>
        <span className="field__hint">{t('wizard.settings.guidelineHint')}</span>
      </div>
      </div>
      <div className="wizard-actions">
        <Button disabled={settingsSaved} onClick={() => void handleSaveSettings()}>
          {settingsSaved ? t('wizard.settings.saved') : t('wizard.settings.save')}
        </Button>
      </div>
    </Panel>
  );

  // ── Step 5 ──
  const renderStep5 = () => (
    <Panel title={t('wizard.names.title')} description={t('wizard.names.description')}>
      {nameJobStatus === 'running' && (
        <div className="wizard-progress">
          <div className="wizard-progress__bar">
            <div className="wizard-progress__fill" />
          </div>
          <div className="wizard-progress__text">{t('wizard.names.extracting')}</div>
        </div>
      )}
      {nameJobStatus === 'completed' && (
        <div className="wizard-message wizard-message--success">
          {nameJobMessage}
          <br />
          <span className="wizard-message__hint">{t('wizard.names.hint')}</span>
        </div>
      )}
      {nameJobStatus === 'failed' && (
        <div className="wizard-message wizard-message--error">
          {t('wizard.names.errorPrefix', { error: nameJobMessage })}
        </div>
      )}
    </Panel>
  );

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5];

  const handlePrevStep = useCallback(() => {
    setStepDirection('backward');
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const handleNextStep = useCallback(() => {
    setStepDirection('forward');
    setCurrentStep((s) => Math.min(stepLabels.length - 1, s + 1));
  }, [stepLabels.length]);

  return (
    <div className="wizard-page">
      <PageHeader
        title={t('wizard.page.title')}
        description={t('wizard.page.description')}
      />
      {renderStepIndicator()}
      <div className="wizard-content">
        <div className="wizard-step-summary">
          <div className="wizard-step-summary__top">
            <span>{t('wizard.page.stepCount', { current: currentStep + 1, total: stepLabels.length })}</span>
            <strong>{stepLabels[currentStep]}</strong>
          </div>
          <div className="wizard-step-summary__bar">
            <span style={{ width: `${stepProgress}%` }} />
          </div>
        </div>
        <div key={currentStep} className={`wizard-step-stage wizard-step-stage--${stepDirection}`}>
          {stepRenderers[currentStep]()}
        </div>
        {feedback && <InlineFeedback className={feedback.type === 'success' ? 'inline-alert--floating' : undefined} tone={feedback.type === 'error' ? 'error' : feedback.type === 'success' ? 'success' : 'info'} title={feedback.message} />}
      </div>
      <div className="wizard-nav">
        <Button variant="secondary" onClick={handlePrevStep} disabled={currentStep === 0}>
          {t('common.previous')}
        </Button>
        {currentStep < 4 ? (
          <Button onClick={handleNextStep} disabled={!canNext}>
            {t('common.next')}
          </Button>
        ) : (
          <Button onClick={handleFinish}>
            {t('wizard.nav.finish')}
          </Button>
        )}
      </div>
    </div>
  );
}
