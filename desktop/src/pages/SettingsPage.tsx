import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomSelect } from '../components/CustomSelect';
import { PageHeader } from '../components/PageHeader';
import { ConnectionStatusCard } from '../features/connection/ConnectionStatusCard';
import { EmptyState, ErrorState, LoadingState } from '../components/page-state';
import { useConnection } from '../features/connection/ConnectionContext';
import {
  CACHE_BROWSER_FONT_SIZE_MAX,
  CACHE_BROWSER_FONT_SIZE_MIN,
  CUSTOM_BACKGROUND_OPACITY_MAX,
  CUSTOM_BACKGROUND_OPACITY_MIN,
  CUSTOM_BACKGROUND_SURFACE_OPACITY_MAX,
  CUSTOM_BACKGROUND_SURFACE_OPACITY_MIN,
  type PluginInfo,
  type ThemeMode,
  clearCustomBackgroundPreference,
  fetchVersion,
  fetchVersionCheck,
  fetchPlugins,
  getCacheBrowserFontSizePreference,
  getCustomBackgroundPreference,
  getHideBackendConsolePreference,
  getHomeHistoryRetentionLimit,
  getHomeJobRetentionLimit,
  getThemeModePreference,
  HOME_LIST_LIMIT_MAX,
  HOME_LIST_LIMIT_MIN,
  setCustomBackgroundPreference,
  setCacheBrowserFontSizePreference,
  setHideBackendConsolePreference,
  setHomeHistoryRetentionLimit,
  setHomeJobRetentionLimit,
  setThemeModePreference,
} from '../lib/api';
import { normalizeError } from '../lib/errors';
import { t } from '../i18n';

const PROJECT_HOMEPAGE = 'https://github.com/GalTransl/GalTransl';
const PROJECT_AUTHOR = 'xd2333';


function PluginListSection() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPlugins()
      .then((res) => {
        if (!cancelled) setPlugins(res);
      })
      .catch((err) => {
        if (!cancelled) setError(normalizeError(err, t('settings.plugins.loadFailed')));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filePlugins = plugins.filter((p) => p.type === 'file');
  const textPlugins = plugins.filter((p) => p.type === 'text');
  const filteredPlugins = typeFilter === 'file' ? filePlugins : typeFilter === 'text' ? textPlugins : plugins;

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <h2>{t('settings.plugins.title')}</h2>
          <p>{t('settings.plugins.description')}</p>
        </div>
      </header>

      {loading ? (
        <LoadingState title={t('settings.plugins.loadingTitle')} description={t('settings.plugins.loadingDescription')} />
      ) : error ? (
        <ErrorState title={t('settings.plugins.loadFailed')} description={error} />
      ) : (
        <>
          <div className="plugin-tabs">
            <button
              className={`plugin-tab ${typeFilter === '' ? 'plugin-tab--active' : ''}`}
              onClick={() => setTypeFilter('')}
            >
              {t('settings.plugins.all', { count: plugins.length })}
            </button>
            <button
              className={`plugin-tab ${typeFilter === 'file' ? 'plugin-tab--active' : ''}`}
              onClick={() => setTypeFilter('file')}
            >
              {t('settings.plugins.file', { count: filePlugins.length })}
            </button>
            <button
              className={`plugin-tab ${typeFilter === 'text' ? 'plugin-tab--active' : ''}`}
              onClick={() => setTypeFilter('text')}
            >
              {t('settings.plugins.text', { count: textPlugins.length })}
            </button>
          </div>

          <div className="plugin-list">
            {filteredPlugins.length === 0 ? (
              <EmptyState
                title={typeFilter ? t('settings.plugins.emptyFilteredTitle') : t('settings.plugins.emptyTitle')}
                description={typeFilter ? t('settings.plugins.emptyFilteredDescription') : t('settings.plugins.emptyDescription')}
              />
            ) : filteredPlugins.map((plugin) => (
              <div key={plugin.name} className="plugin-card">
                <div className="plugin-card__header">
                  <span className="plugin-card__name">{plugin.display_name}</span>
                  <span className="plugin-card__version">v{plugin.version}</span>
                  <span className={`plugin-card__type plugin-card__type--${plugin.type}`}>
                    {plugin.type === 'file' ? t('settings.plugins.typeFile') : t('settings.plugins.typeText')}
                  </span>
                </div>
                <div className="plugin-card__meta">
                  {plugin.author && <span>{t('settings.plugins.author', { author: plugin.author })}</span>}
                  <span>{t('settings.plugins.module', { module: plugin.module })}</span>
                </div>
                {plugin.description && (
                  <p className="plugin-card__desc">{plugin.description}</p>
                )}
                {Object.keys(plugin.settings).length > 0 && (
                  <div className="plugin-card__settings">
                    <h4>{t('settings.plugins.settings')}</h4>
                    {Object.entries(plugin.settings).map(([key, value]) => (
                      <div key={key} className="plugin-setting-item">
                        <span className="plugin-setting-item__key">{key}:</span>
                        <span className="plugin-setting-item__value">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}


export function SettingsPage() {
  const navigate = useNavigate();
  const {
    backendUrl,
    connectionPhase,
    connectionMessage,
    loadingInitialData,
    refreshingJobs,
    loadInitialData,
    translators } = useConnection();

  const [homeHistoryLimitInput, setHomeHistoryLimitInput] = useState(() => String(getHomeHistoryRetentionLimit()));
  const [homeJobLimitInput, setHomeJobLimitInput] = useState(() => String(getHomeJobRetentionLimit()));
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getThemeModePreference());
  const [cacheBrowserFontSizeInput, setCacheBrowserFontSizeInput] = useState(() => String(getCacheBrowserFontSizePreference()));
  const [hideBackendConsole, setHideBackendConsole] = useState(() => getHideBackendConsolePreference());
  const [customBackgroundImageDataUrl, setCustomBackgroundImageDataUrl] = useState(
    () => getCustomBackgroundPreference().imageDataUrl,
  );
  const [customBackgroundImageName, setCustomBackgroundImageName] = useState(
    () => getCustomBackgroundPreference().imageName,
  );
  const [customBackgroundOpacityInput, setCustomBackgroundOpacityInput] = useState(
    () => String(getCustomBackgroundPreference().opacity),
  );
  const [customBackgroundSurfaceOpacityInput, setCustomBackgroundSurfaceOpacityInput] = useState(
    () => String(getCustomBackgroundPreference().surfaceOpacity),
  );
  const [coreVersion, setCoreVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checkingVersion, setCheckingVersion] = useState(true);
  const [versionCheckError, setVersionCheckError] = useState<string | null>(null);
  const [customBackgroundError, setCustomBackgroundError] = useState<string | null>(null);
  const [customBackgroundBusy, setCustomBackgroundBusy] = useState(false);
  const customBackgroundInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCheckingVersion(true);
    setVersionCheckError(null);

    fetchVersion()
      .then((version) => {
        if (!cancelled) {
          setCoreVersion(version);
        }
      })
      .catch(() => undefined);

    fetchVersionCheck()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setCoreVersion(result.version);
        setLatestVersion(result.latest_version);
        setUpdateAvailable(result.update_available);
      })
      .catch((error) => {
        if (!cancelled) {
          setVersionCheckError(normalizeError(error, t('settings.errorCheckUpdate')));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingVersion(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const applyHomeHistoryLimit = useCallback((rawValue: string) => {
    const next = setHomeHistoryRetentionLimit(rawValue.trim() === '' ? Number.NaN : Number(rawValue));
    setHomeHistoryLimitInput(String(next));
  }, []);

  const applyHomeJobLimit = useCallback((rawValue: string) => {
    const next = setHomeJobRetentionLimit(rawValue.trim() === '' ? Number.NaN : Number(rawValue));
    setHomeJobLimitInput(String(next));
  }, []);

  const applyThemeMode = useCallback((mode: ThemeMode) => {
    const next = setThemeModePreference(mode);
    setThemeMode(next);
  }, []);

  const applyCacheBrowserFontSize = useCallback((rawValue: string) => {
    const next = setCacheBrowserFontSizePreference(rawValue.trim() === '' ? Number.NaN : Number(rawValue));
    setCacheBrowserFontSizeInput(String(next));
  }, []);

  const applyHideBackendConsole = useCallback((enabled: boolean) => {
    const next = setHideBackendConsolePreference(enabled);
    setHideBackendConsole(next);
  }, []);

  const applyCustomBackgroundOpacity = useCallback((rawValue: string) => {
    const current = getCustomBackgroundPreference();
    try {
      const next = setCustomBackgroundPreference({
        imageDataUrl: current.imageDataUrl,
        imageName: current.imageName,
        opacity: rawValue.trim() === '' ? Number.NaN : Number(rawValue),
        surfaceOpacity: current.surfaceOpacity,
      });
      setCustomBackgroundOpacityInput(String(next.opacity));
    } catch (err) {
      setCustomBackgroundError(normalizeError(err, t('settings.errorSaveBackgroundSettings')));
    }
  }, []);

  const applyCustomBackgroundSurfaceOpacity = useCallback((rawValue: string) => {
    const current = getCustomBackgroundPreference();
    try {
      const next = setCustomBackgroundPreference({
        imageDataUrl: current.imageDataUrl,
        imageName: current.imageName,
        opacity: current.opacity,
        surfaceOpacity: rawValue.trim() === '' ? Number.NaN : Number(rawValue),
      });
      setCustomBackgroundSurfaceOpacityInput(String(next.surfaceOpacity));
    } catch (err) {
      setCustomBackgroundError(normalizeError(err, t('settings.errorSaveBackgroundSettings')));
    }
  }, []);

  const handleCustomBackgroundFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setCustomBackgroundError(t('settings.errorChooseImage'));
      return;
    }

    setCustomBackgroundBusy(true);
    setCustomBackgroundError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      const current = getCustomBackgroundPreference();
      const next = setCustomBackgroundPreference({
        imageDataUrl: dataUrl,
        imageName: file.name,
        opacity: current.opacity,
        surfaceOpacity: current.surfaceOpacity,
      });
      setCustomBackgroundImageDataUrl(next.imageDataUrl);
      setCustomBackgroundImageName(next.imageName);
      setCustomBackgroundOpacityInput(String(next.opacity));
      setCustomBackgroundSurfaceOpacityInput(String(next.surfaceOpacity));
    } catch (err) {
      const message = normalizeError(err, t('settings.errorSaveBackground'));
      // 典型原因：localStorage 配额溢出。提醒用户换更小的图。
      const isQuota = err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22);
      setCustomBackgroundError(
        isQuota ? t('settings.errorImageTooLarge') : message,
      );
    } finally {
      setCustomBackgroundBusy(false);
    }
  }, []);

  const clearCustomBackground = useCallback(() => {
    const next = clearCustomBackgroundPreference();
    setCustomBackgroundImageDataUrl(next.imageDataUrl);
    setCustomBackgroundImageName(next.imageName);
    setCustomBackgroundOpacityInput(String(next.opacity));
    setCustomBackgroundSurfaceOpacityInput(String(next.surfaceOpacity));
    setCustomBackgroundError(null);
  }, []);

  const triggerCustomBackgroundPicker = useCallback(() => {
    customBackgroundInputRef.current?.click();
  }, []);

  return (
    <div className="settings-page">
      <PageHeader className="settings-page__header" title={t('settings.title')} description={t('settings.description')} />

      <div className="settings-page__content">
        <section className="panel">
          <header className="panel__header">
            <div>
              <h2>{t('settings.appearance.title')}</h2>
              <p>{t('settings.appearance.description')}</p>
            </div>
          </header>

          <label className="settings-number-row">
            <span className="settings-number-row__label">{t('settings.themeMode')}</span>
            <div className="settings-number-row__control">
              <CustomSelect
                value={themeMode}
                onChange={(event) => {
                  applyThemeMode(event.target.value as ThemeMode);
                }}
              >
                <option value="light">{t('settings.themeLight')}</option>
                <option value="dark">{t('settings.themeDark')}</option>
                <option value="system">{t('settings.themeSystem')}</option>
              </CustomSelect>
            </div>
          </label>

          <label className="settings-toggle-row">
            <span className="settings-toggle-row__label">{t('settings.hideBackendConsole')}</span>
            <div className="settings-toggle-row__control">
              <input
                type="checkbox"
                checked={hideBackendConsole}
                onChange={(event) => {
                  applyHideBackendConsole(event.target.checked);
                }}
              />
            </div>
          </label>

          <label className="settings-number-row">
            <span className="settings-number-row__label">{t('settings.customBackground')}</span>
           <div className="settings-number-row__control settings-background-control">
              <input
                ref={customBackgroundInputRef}
                className="settings-background-control__file-input"
                type="file"
                accept="image/*"
                onChange={handleCustomBackgroundFileChange}
              />
              <span
                className={`settings-background-control__filename${customBackgroundImageName ? '' : ' settings-background-control__filename--empty'}`}
                title={customBackgroundImageName || t('settings.noImageSelected')}
              >
                {customBackgroundImageName || t('settings.noImageSelected')}
              </span>
              <span className="settings-background-control__actions">
                <button
                  type="button"
                  className="settings-background-control__pick"
                  onClick={triggerCustomBackgroundPicker}
                  disabled={customBackgroundBusy}
                >
                  {customBackgroundBusy ? t('settings.processing') : customBackgroundImageDataUrl ? t('settings.replaceImage') : t('settings.chooseImage')}
                </button>
                <button
                  type="button"
                  className="settings-background-control__clear"
                  onClick={clearCustomBackground}
                  disabled={!customBackgroundImageDataUrl || customBackgroundBusy}
                  aria-label={t('settings.clearCustomBackground')}
                >
                  {t('settings.clear')}
                </button>
              </span>
            </div>
          </label>

          {customBackgroundError && (
            <div className="settings-background-control__error" role="alert">
              {customBackgroundError}
            </div>
          )}

          <label className="settings-number-row">
            <span className="settings-number-row__label">{t('settings.backgroundOpacity')}</span>
            <div className="settings-number-row__control settings-opacity-control">
              <input
                type="range"
                min={CUSTOM_BACKGROUND_OPACITY_MIN}
                max={CUSTOM_BACKGROUND_OPACITY_MAX}
                value={customBackgroundOpacityInput}
                onChange={(event) => {
                  setCustomBackgroundOpacityInput(event.target.value);
                  applyCustomBackgroundOpacity(event.target.value);
                }}
              />
              <input
                type="number"
                min={CUSTOM_BACKGROUND_OPACITY_MIN}
                max={CUSTOM_BACKGROUND_OPACITY_MAX}
                value={customBackgroundOpacityInput}
                onChange={(event) => {
                  setCustomBackgroundOpacityInput(event.target.value);
                }}
                onBlur={() => {
                  applyCustomBackgroundOpacity(customBackgroundOpacityInput);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
          </label>

          <label className="settings-number-row">
            <span className="settings-number-row__label">{t('settings.surfaceOpacity')}</span>
            <div className="settings-number-row__control settings-opacity-control">
              <input
                type="range"
                min={CUSTOM_BACKGROUND_SURFACE_OPACITY_MIN}
                max={CUSTOM_BACKGROUND_SURFACE_OPACITY_MAX}
                value={customBackgroundSurfaceOpacityInput}
                onChange={(event) => {
                  setCustomBackgroundSurfaceOpacityInput(event.target.value);
                  applyCustomBackgroundSurfaceOpacity(event.target.value);
                }}
              />
              <input
                type="number"
                min={CUSTOM_BACKGROUND_SURFACE_OPACITY_MIN}
                max={CUSTOM_BACKGROUND_SURFACE_OPACITY_MAX}
                value={customBackgroundSurfaceOpacityInput}
                onChange={(event) => {
                  setCustomBackgroundSurfaceOpacityInput(event.target.value);
                }}
                onBlur={() => {
                  applyCustomBackgroundSurfaceOpacity(customBackgroundSurfaceOpacityInput);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
          </label>

          <label className="settings-number-row">
            <span className="settings-number-row__label">{t('settings.cacheFontSize')}</span>
            <div className="settings-number-row__control settings-opacity-control">
              <input
                type="range"
                min={CACHE_BROWSER_FONT_SIZE_MIN}
                max={CACHE_BROWSER_FONT_SIZE_MAX}
                value={cacheBrowserFontSizeInput}
                onChange={(event) => {
                  setCacheBrowserFontSizeInput(event.target.value);
                  applyCacheBrowserFontSize(event.target.value);
                }}
              />
              <input
                type="number"
                min={CACHE_BROWSER_FONT_SIZE_MIN}
                max={CACHE_BROWSER_FONT_SIZE_MAX}
                value={cacheBrowserFontSizeInput}
                onChange={(event) => {
                  setCacheBrowserFontSizeInput(event.target.value);
                }}
                onBlur={() => {
                  applyCacheBrowserFontSize(cacheBrowserFontSizeInput);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
          </label>

          <div className="settings-toggle-row__desc">
            {customBackgroundImageDataUrl ? t('settings.backgroundEnabled') : t('settings.backgroundDisabled')}
            {t('settings.appearanceNote')}
          </div>
        </section>

        <section className="panel">
          <header className="panel__header">
            <div>
              <h2>{t('settings.prompts.title')}</h2>
              <p>{t('settings.prompts.description')}</p>
            </div>
          </header>
          <div className="settings-action-row">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                navigate('/settings/prompt-templates');
              }}
            >
              {t('settings.prompts.editDefaults')}
            </button>
          </div>
        </section>

        <section className="panel">
          <header className="panel__header">
            <div>
              <h2>{t('settings.about.title')}</h2>
              <p>{t('settings.about.description')}</p>
            </div>
          </header>

          <div className="settings-about-list">
            <div className="settings-about-list__row">
              <span className="settings-about-list__label">{t('common.projectHomepage')}</span>
              <a
                className="settings-about-list__value settings-about-list__value--link"
                href={PROJECT_HOMEPAGE}
                target="_blank"
                rel="noreferrer noopener"
              >
                {PROJECT_HOMEPAGE}
              </a>
            </div>

            <div className="settings-about-list__row">
              <span className="settings-about-list__label">{t('common.currentVersion')}</span>
              <span className="settings-about-list__value">{coreVersion ? `v${coreVersion}` : '—'}</span>
            </div>

            <div className="settings-about-list__row">
              <span className="settings-about-list__label">{t('settings.updateStatus')}</span>
              <span className="settings-about-list__value">
                {checkingVersion
                  ? t('settings.checking')
                  : updateAvailable && latestVersion
                    ? t('home.updateAvailable', { version: latestVersion })
                    : t('settings.latestVersion')}
              </span>
            </div>

            {updateAvailable && latestVersion ? (
              <div className="settings-about-list__row">
                <span className="settings-about-list__label">{t('settings.updateDownload')}</span>
                <a
                  className="settings-about-list__value settings-about-list__value--link"
                  href={PROJECT_HOMEPAGE + '/releases/latest'}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t('settings.latestRelease')}
                </a>
              </div>
            ) : null}

            <div className="settings-about-list__row">
              <span className="settings-about-list__label">{t('common.author')}</span>
              <span className="settings-about-list__value">{PROJECT_AUTHOR}</span>
            </div>
          </div>

          {versionCheckError ? (
            <div className="settings-toggle-row__desc">
              {t('settings.updateCheckFailed', { error: versionCheckError })}
            </div>
          ) : null}
        </section>

        <section className="panel">
          <header className="panel__header">
            <div>
              <h2>{t('settings.homeRetention.title')}</h2>
              <p>{t('settings.homeRetention.description')}</p>
            </div>
          </header>

          <label className="settings-number-row">
            <span className="settings-number-row__label">{t('settings.historyLimit')}</span>
            <div className="settings-number-row__control">
              <input
                type="number"
                min={HOME_LIST_LIMIT_MIN}
                max={HOME_LIST_LIMIT_MAX}
                value={homeHistoryLimitInput}
                onChange={(event) => {
                  setHomeHistoryLimitInput(event.target.value);
                }}
                onBlur={() => {
                  applyHomeHistoryLimit(homeHistoryLimitInput);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
          </label>

          <label className="settings-number-row">
            <span className="settings-number-row__label">{t('settings.jobLimit')}</span>
            <div className="settings-number-row__control">
              <input
                type="number"
                min={HOME_LIST_LIMIT_MIN}
                max={HOME_LIST_LIMIT_MAX}
                value={homeJobLimitInput}
                onChange={(event) => {
                  setHomeJobLimitInput(event.target.value);
                }}
                onBlur={() => {
                  applyHomeJobLimit(homeJobLimitInput);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
          </label>

          <div className="settings-toggle-row__desc">
            {t('settings.retentionRange', { min: HOME_LIST_LIMIT_MIN, max: HOME_LIST_LIMIT_MAX })}
          </div>
        </section>

        <ConnectionStatusCard
          backendUrl={backendUrl}
          connectionMessage={connectionMessage}
          connectionPhase={connectionPhase}
          isRefreshing={loadingInitialData || refreshingJobs}
          onRefresh={() => {
            void loadInitialData();
          }}
          translatorCount={translators.length}
        />

        <PluginListSection />
      </div>
    </div>
  );
}

// ── 壁纸图像压缩 ──
// 将用户选择的图片通过 canvas 重绘为较小的 JPEG data URL，再写入 localStorage。
// 这里的根因：原实现把原始文件直接 base64 编码存入 localStorage，大图极易触发 QuotaExceededError，
// 之前该错误还被静默吞掉，导致重启后加载到的仍是上一次成功保存的旧壁纸。
const CUSTOM_BACKGROUND_MAX_EDGE = 1920;
const CUSTOM_BACKGROUND_JPEG_QUALITY = 0.82;

async function compressImageToDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(t('settings.errorReadImage')));
      image.src = objectUrl;
    });

    const scale = Math.min(1, CUSTOM_BACKGROUND_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const targetWidth = Math.max(1, Math.round(img.naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(t('settings.errorCanvasUnsupported'));
    }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // 半透明 PNG 会很大，统一转 JPEG；若原图带透明通道则用黑色填充，视觉影响可忽略。
    return canvas.toDataURL('image/jpeg', CUSTOM_BACKGROUND_JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
