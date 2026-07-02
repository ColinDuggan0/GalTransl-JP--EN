import { useCallback, useEffect, useRef, useState, type TransitionEvent } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { encodeProjectDir, decodeProjectDir, submitJob, fetchJob, fetchProjectRuntime, type ProjectRuntimeResponse } from '../lib/api';
import { loadLastProjectTab } from '../lib/projectTabMemory';
import { InlineFeedback } from './page-state/InlineFeedback';
import { t, type TranslationKey } from '../i18n';
import logoUrl from '../assets/logo.png';

const CONFIG_FILE_KEY = 'galtransl-config-file';
const LAST_ACTIVE_PROJECT_KEY = 'galtransl-last-active-project';
const OUTPUT_FOLDER_NAME = 'gt_output';

function loadConfigFileName(projectDir: string): string {
  try {
    const map = JSON.parse(localStorage.getItem(CONFIG_FILE_KEY) || '{}');
    return map[projectDir] || 'config.yaml';
  } catch {
    return 'config.yaml';
  }
}

function loadLastActiveProject(): string | null {
  try {
    return localStorage.getItem(LAST_ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

const PROJECT_TABS = [
  { path: 'translate', labelKey: 'nav.project.translate', icon: '🌐' },
  { path: 'cache', labelKey: 'nav.project.cache', icon: '💾' },
  { path: 'dictionary', labelKey: 'nav.project.dictionary', icon: '📖' },
  { path: 'names', labelKey: 'nav.project.names', icon: '👤' },
  { path: 'config', labelKey: 'nav.project.config', icon: '⚙️' },
] satisfies { path: string; labelKey: TranslationKey; icon: string }[];

type SidebarProps = {
  openProjects: string[];
  onCloseProject: (projectDir: string) => void;
  onCloseOtherProjects: (projectDir: string) => void;
  onCloseAllProjects: () => void;
};

function buildInitialExpandedProjects(openProjects: string[], pathname: string): Record<string, boolean> {
  if (openProjects.length === 0) {
    return {};
  }

  let expandedProject: string | null = null;
  const match = pathname.match(/^\/project\/([^/]+)/);
  if (match) {
    try {
      const projectDir = decodeProjectDir(match[1]);
      if (openProjects.includes(projectDir)) {
        expandedProject = projectDir;
      }
    } catch {
      expandedProject = null;
    }
  }

  const lastActiveProject = loadLastActiveProject();
  const rememberedProject = lastActiveProject && openProjects.includes(lastActiveProject)
    ? lastActiveProject
    : null;

  const target = expandedProject ?? rememberedProject ?? openProjects[0];
  const result: Record<string, boolean> = {};
  for (const projectDir of openProjects) {
    result[projectDir] = projectDir === target;
  }
  return result;
}

export function Sidebar({ openProjects, onCloseProject, onCloseOtherProjects, onCloseAllProjects }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(true);
  // Track which projects are expanded in the sidebar (keyed by projectDir)
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>(() =>
    buildInitialExpandedProjects(openProjects, location.pathname)
  );
  // Keep submenu content mounted long enough for close animations to complete
  const [renderedProjectChildren, setRenderedProjectChildren] = useState<Record<string, boolean>>({});
  // Track the visual open/closed state separately so expand animations can start from collapsed
  const [visibleProjectChildren, setVisibleProjectChildren] = useState<Record<string, boolean>>({});
  // Track which project is showing the close confirmation bubble
  const [confirmCloseDir, setConfirmCloseDir] = useState<string | null>(null);
  // Track which projects are currently rebuilding output
  const [rebuildingDirs, setRebuildingDirs] = useState<Record<string, boolean>>({});
  // Track which projects have active translation jobs (running or pending)
  const [translatingDirs, setTranslatingDirs] = useState<Record<string, boolean>>({});
  const [rebuildToast, setRebuildToast] = useState<string | null>(null);
  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; projectDir: string } | null>(null);
  const prevOpenProjectsRef = useRef<string[]>(openProjects);
  const confirmBubbleRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const expandAnimationFrameRef = useRef<Record<string, number>>({});

  // When a new project is opened, collapse all others and expand the new one
  useEffect(() => {
    const prev = prevOpenProjectsRef.current;
    // Detect newly added project
    if (openProjects.length > prev.length) {
      const newProject = openProjects.find((p) => !prev.includes(p));
      if (newProject) {
        setExpandedProjects(() => {
          const next: Record<string, boolean> = {};
          for (const key of openProjects) {
            next[key] = key === newProject;
          }
          return next;
        });
      }
    }
    prevOpenProjectsRef.current = openProjects;
  }, [openProjects]);

  // When navigating to a project page, auto-expand that project's menu (accordion)
  useEffect(() => {
    const match = location.pathname.match(/^\/project\/([^/]+)/);
    if (match) {
      try {
        const projectDir = decodeProjectDir(match[1]);
        if (openProjects.includes(projectDir)) {
          setExpandedProjects((prev) => {
            // Already expanded? No change needed
            if (prev[projectDir] === true) return prev;
            // Expand this project, collapse all others
            const next: Record<string, boolean> = {};
            for (const key of openProjects) {
              next[key] = key === projectDir;
            }
            return next;
          });
        }
      } catch {
        // Invalid project ID in URL, ignore
      }
    }
  }, [location.pathname, openProjects]);

  // Close confirmation bubble when clicking outside
  useEffect(() => {
    if (confirmCloseDir === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (confirmBubbleRef.current && !confirmBubbleRef.current.contains(e.target as Node)) {
        setConfirmCloseDir(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [confirmCloseDir]);

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const handleProjectContextMenu = useCallback((e: React.MouseEvent, projectDir: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Clamp menu position to viewport
    const menuWidth = 180;
    const menuHeight = 120;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
    setContextMenu({ x, y, projectDir });
    setConfirmCloseDir(null);
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Use compact project headers when many projects are open
  const compactProjectHeaders = openProjects.length > 6;

  useEffect(() => {
    setRenderedProjectChildren((prev) => {
      let changed = false;
      const next: Record<string, boolean> = {};

      for (const projectDir of openProjects) {
        const isExpanded = projectDir in expandedProjects ? expandedProjects[projectDir] : false;
        const shouldRender = isExpanded || prev[projectDir] === true;
        next[projectDir] = shouldRender;
        if (prev[projectDir] !== shouldRender) {
          changed = true;
        }
      }

      if (!changed && Object.keys(prev).length === openProjects.length) {
        return prev;
      }

      return next;
    });
  }, [expandedProjects, openProjects]);

  // Poll project runtime status to detect active translation jobs
  useEffect(() => {
    const pollTranslationStatus = async () => {
      const statusMap: Record<string, boolean> = {};
      await Promise.all(
        openProjects.map(async (projectDir) => {
          try {
            const projectId = encodeProjectDir(projectDir);
            const runtime: ProjectRuntimeResponse = await fetchProjectRuntime(projectId);
            const isTranslating = runtime.job !== null &&
              (runtime.job.status === 'pending' || runtime.job.status === 'running');
            statusMap[projectDir] = isTranslating;
          } catch {
            statusMap[projectDir] = false;
          }
        })
      );
      setTranslatingDirs(statusMap);
    };

    void pollTranslationStatus();
    const poller = window.setInterval(() => {
      void pollTranslationStatus();
    }, 3000);
    return () => window.clearInterval(poller);
  }, [openProjects]);

  useEffect(() => {
    for (const frameId of Object.values(expandAnimationFrameRef.current)) {
      window.cancelAnimationFrame(frameId);
    }
    expandAnimationFrameRef.current = {};

    setVisibleProjectChildren((prev) => {
      const next: Record<string, boolean> = {};
      let changed = false;

      for (const projectDir of openProjects) {
        const isRendered = renderedProjectChildren[projectDir] ?? false;
        const isExpanded = projectDir in expandedProjects ? expandedProjects[projectDir] : false;
        const wasVisible = prev[projectDir] ?? false;

        if (!isRendered) {
          next[projectDir] = false;
          if (wasVisible) {
            changed = true;
          }
          continue;
        }

        if (!isExpanded) {
          next[projectDir] = false;
          if (wasVisible) {
            changed = true;
          }
          continue;
        }

        if (wasVisible) {
          next[projectDir] = true;
          continue;
        }

        next[projectDir] = false;
        expandAnimationFrameRef.current[projectDir] = window.requestAnimationFrame(() => {
          setVisibleProjectChildren((current) => {
            if (current[projectDir]) {
              return current;
            }

            return {
              ...current,
              [projectDir]: true,
            };
          });
          delete expandAnimationFrameRef.current[projectDir];
        });

        if (wasVisible !== next[projectDir]) {
          changed = true;
        }
      }

      if (!changed && Object.keys(prev).length === openProjects.length) {
        return prev;
      }

      return next;
    });

    return () => {
      for (const frameId of Object.values(expandAnimationFrameRef.current)) {
        window.cancelAnimationFrame(frameId);
      }
      expandAnimationFrameRef.current = {};
    };
  }, [expandedProjects, openProjects, renderedProjectChildren]);

  const toggleProjectExpanded = useCallback((projectDir: string) => {
    setExpandedProjects((prev) => {
      const isCurrentlyExpanded = prev[projectDir] ?? false;
      if (isCurrentlyExpanded) {
        // Collapsing: just collapse this one
        return {
          ...prev,
          [projectDir]: false,
        };
      } else {
        // Expanding: collapse all others, expand this one (accordion)
        const next: Record<string, boolean> = {};
        for (const key of openProjects) {
          next[key] = key === projectDir;
        }
        // Navigate to the project's last visited page
        const projectId = encodeProjectDir(projectDir);
        navigate(`/project/${projectId}/${loadLastProjectTab(projectDir)}`);
        return next;
      }
    });
  }, [openProjects, navigate]);

  const handleRequestClose = useCallback((projectDir: string) => {
    setConfirmCloseDir(projectDir);
  }, []);

  const handleConfirmClose = useCallback((projectDir: string) => {
    setConfirmCloseDir(null);
    onCloseProject(projectDir);
  }, [onCloseProject]);

  const handleCancelClose = useCallback(() => {
    setConfirmCloseDir(null);
  }, []);

  const handleRebuildOutput = useCallback(async (projectDir: string) => {
    const configFileName = loadConfigFileName(projectDir);
    setRebuildingDirs((prev) => ({ ...prev, [projectDir]: true }));
    try {
      const job = await submitJob({
        project_dir: projectDir,
        config_file_name: configFileName,
        translator: 'rebuilda',
      });
      // Poll until job completes
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const status = await fetchJob(job.job_id);
        if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
          if (status.success) {
            const normalizedDir = projectDir.replace(/[\\/]+$/, '');
            const outputDir = `${normalizedDir}\\${OUTPUT_FOLDER_NAME}`;
            await invoke('open_folder', { path: outputDir });
          } else {
            setRebuildToast(t('sidebar.rebuildFailed', { error: status.error || t('common.unknownError') }));
          }
          return;
        }
      }
      setRebuildToast(t('sidebar.rebuildTimeout'));
    } catch (err) {
      setRebuildToast(t('sidebar.rebuildError', { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setRebuildingDirs((prev) => ({ ...prev, [projectDir]: false }));
    }
  }, []);

  // When a new project is opened, collapse all others and expand the new one
  // We detect this by checking if a project in openProjects doesn't have an expanded state yet
  const getProjectExpanded = useCallback((projectDir: string) => {
    // Default to collapsed if not yet set
    if (!(projectDir in expandedProjects)) {
      return false;
    }
    return expandedProjects[projectDir];
  }, [expandedProjects]);

  const handleProjectChildrenTransitionEnd = useCallback(
    (projectDir: string, event: TransitionEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget || event.propertyName !== 'max-height') {
        return;
      }

      if (getProjectExpanded(projectDir)) {
        return;
      }

      setRenderedProjectChildren((prev) => {
        if (!prev[projectDir]) {
          return prev;
        }

        return {
          ...prev,
          [projectDir]: false,
        };
      });
    },
    [getProjectExpanded]
  );

  return (
    <aside className={`sidebar ${expanded ? 'sidebar--expanded' : 'sidebar--collapsed'}`}>
      <div className="sidebar__header">
        <img src={logoUrl} alt="" className="sidebar__logo-img" />
        {expanded && <span className="sidebar__logo">GalTransl</span>}
      </div>

      <div className="sidebar__top-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
          title={t('nav.home')}
        >
          <span className="sidebar__nav-icon">🏠</span>
          {expanded && <span className="sidebar__nav-label">{t('nav.home')}</span>}
        </NavLink>
      </div>

      <nav className="sidebar__nav">
        {openProjects.map((projectDir) => {
          const projectName = projectDir.replace(/[/\\\\]/g, '/').split('/').filter(Boolean).pop() || projectDir;
          const projectId = encodeProjectDir(projectDir);
          const isProjectExpanded = getProjectExpanded(projectDir);
          const shouldRenderProjectChildren = renderedProjectChildren[projectDir] ?? isProjectExpanded;
          const isProjectChildrenVisible = visibleProjectChildren[projectDir] ?? isProjectExpanded;
          const isConfirming = confirmCloseDir === projectDir;

          return (
            <div className={`sidebar__project-group${compactProjectHeaders ? ' sidebar__project-group--compact' : ''}`} key={projectDir}>
              {expanded ? (
                <>
                  <button
                    className={`sidebar__project-header${compactProjectHeaders ? ' sidebar__project-header--compact' : ''}`}
                    title={projectDir}
                    type="button"
                    onClick={() => toggleProjectExpanded(projectDir)}
                    onContextMenu={(e) => handleProjectContextMenu(e, projectDir)}
                  >
                    <span
                      className={`sidebar__nav-icon sidebar__project-icon sidebar__project-icon--link${isProjectExpanded ? ' sidebar__project-icon--open' : ''}${compactProjectHeaders ? ' sidebar__project-icon--compact' : ''}`}
                      role="button"
                      tabIndex={0}
                      title={t('sidebar.openProjectFolder')}
                      onClick={(e) => { e.stopPropagation(); void invoke('open_folder', { path: projectDir }); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); void invoke('open_folder', { path: projectDir }); } }}
                    >
                      {isProjectExpanded ? '📂' : '📁'}
                    </span>
                    <span className="sidebar__project-name">{projectName}</span>
                    <button
                      className="sidebar__project-close"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRequestClose(projectDir); }}
                      title={t('sidebar.closeProject')}
                    >
                      ✕
                    </button>
                    {isConfirming && (
                      <div
                        className="sidebar__project-confirm-bubble"
                        ref={confirmBubbleRef}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="sidebar__project-confirm-text">{t('sidebar.confirmClose')}</span>
                        <button
                          className="sidebar__project-confirm-yes"
                          type="button"
                          onClick={() => handleConfirmClose(projectDir)}
                        >
                          {t('common.yes')}
                        </button>
                        <button
                          className="sidebar__project-confirm-no"
                          type="button"
                          onClick={handleCancelClose}
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    )}
                  </button>
                  {shouldRenderProjectChildren && (
                    <div
                      className={`sidebar__project-children ${isProjectChildrenVisible ? 'sidebar__project-children--expanded' : 'sidebar__project-children--collapsed'}`}
                      aria-hidden={!isProjectChildrenVisible}
                      onTransitionEnd={(event) => handleProjectChildrenTransitionEnd(projectDir, event)}
                    >
                      {PROJECT_TABS.map((tab) => (
                        <NavLink
                          key={tab.path}
                          to={`/project/${projectId}/${tab.path}`}
                          className={({ isActive }) =>
                            `sidebar__project-child ${isActive ? 'sidebar__project-child--active' : ''}`
                          }
                        >
                          <span className="sidebar__project-child-icon">{tab.icon}</span>
                          <span className="sidebar__project-child-label">{t(tab.labelKey)}</span>
                        </NavLink>
                      ))}
                      <div className="sidebar__project-child-separator" />
                      <NavLink
                        to="."
                        onClick={(e) => { e.preventDefault(); if (!rebuildingDirs[projectDir] && !translatingDirs[projectDir]) void handleRebuildOutput(projectDir); }}
                        className={() => `sidebar__project-child sidebar__project-child--action${translatingDirs[projectDir] ? ' sidebar__project-child--disabled' : ''}`}
                        title={translatingDirs[projectDir] ? t('sidebar.rebuildDisabledWhileTranslating') : t('sidebar.rebuildOutputTitle')}
                        style={(rebuildingDirs[projectDir] || translatingDirs[projectDir]) ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                      >
                        <span className="sidebar__project-child-icon">{rebuildingDirs[projectDir] ? '⏳' : translatingDirs[projectDir] ? '🚫' : '📤'}</span>
                        <span className="sidebar__project-child-label">{t('sidebar.rebuildOutput')}</span>
                      </NavLink>
                    </div>
                  )}
                </>
              ) : isProjectExpanded ? (
                <>
                  <NavLink
                    to={`/project/${projectId}/${loadLastProjectTab(projectDir)}`}
                    className={({ isActive }) =>
                      `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
                    }
                    title={projectName}
                  >
                    <span className="sidebar__nav-icon">📁</span>
                  </NavLink>
                  {PROJECT_TABS.map((tab) => (
                    <NavLink
                      key={tab.path}
                      to={`/project/${projectId}/${tab.path}`}
                      className={({ isActive }) =>
                        `sidebar__nav-item sidebar__nav-item--sub ${isActive ? 'sidebar__nav-item--active' : ''}`
                      }
                      title={t(tab.labelKey)}
                    >
                      <span className="sidebar__nav-icon">{tab.icon}</span>
                    </NavLink>
                  ))}
                  <NavLink
                    to="."
                    onClick={(e) => { e.preventDefault(); if (!rebuildingDirs[projectDir] && !translatingDirs[projectDir]) void handleRebuildOutput(projectDir); }}
                    className={() => `sidebar__nav-item sidebar__nav-item--sub${translatingDirs[projectDir] ? ' sidebar__nav-item--disabled' : ''}`}
                    title={translatingDirs[projectDir] ? t('sidebar.projectTranslating') : t('sidebar.rebuildOutput')}
                    style={(rebuildingDirs[projectDir] || translatingDirs[projectDir]) ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                  >
                    <span className="sidebar__nav-icon">{rebuildingDirs[projectDir] ? '⏳' : translatingDirs[projectDir] ? '🚫' : '📤'}</span>
                  </NavLink>
                </>
              ) : (
                <NavLink
                  to={`/project/${projectId}/${loadLastProjectTab(projectDir)}`}
                  className={({ isActive }) =>
                    `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
                  }
                  title={projectName}
                >
                  <span className="sidebar__nav-icon">📁</span>
                </NavLink>
              )}
            </div>
          );
        })}
      </nav>

      <nav className="sidebar__bottom-nav">
        <NavLink
          to="/backend-profiles"
          className={({ isActive }) =>
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
          title={t('nav.backendProfiles')}
        >
          <span className="sidebar__nav-icon">🤖</span>
          {expanded && <span className="sidebar__nav-label">{t('nav.backendProfiles')}</span>}
        </NavLink>

        <NavLink
          to="/common-dictionaries"
          className={({ isActive }) =>
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
          title={t('nav.commonDictionaries')}
        >
          <span className="sidebar__nav-icon">📚</span>
          {expanded && <span className="sidebar__nav-label">{t('nav.commonDictionaries')}</span>}
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
          title={t('nav.settings')}
        >
          <span className="sidebar__nav-icon">⚙️</span>
          {expanded && <span className="sidebar__nav-label">{t('nav.settings')}</span>}
        </NavLink>
      </nav>

      <div className="sidebar__footer">
        <button
          className="sidebar__toggle-btn"
          type="button"
          onClick={toggleExpanded}
          title={expanded ? t('sidebar.collapseSidebar') : t('sidebar.expandSidebar')}
        >
          <span className={`sidebar__toggle-icon ${expanded ? 'sidebar__toggle-icon--flip' : ''}`}>
            ▶
          </span>
          {expanded && <span className="sidebar__toggle-label">{t('sidebar.collapse')}</span>}
        </button>
      </div>

      {contextMenu && (
        <div
          className="sidebar__context-menu"
          ref={contextMenuRef}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="sidebar__context-menu-item"
            type="button"
            onClick={() => {
              handleRequestClose(contextMenu.projectDir);
              setContextMenu(null);
            }}
          >
            {t('sidebar.closeProject')}
          </button>
          <button
            className="sidebar__context-menu-item"
            type="button"
            disabled={openProjects.length <= 1}
            onClick={() => {
              onCloseOtherProjects(contextMenu.projectDir);
              setContextMenu(null);
            }}
          >
            {t('sidebar.closeOtherProjects')}
          </button>
          <button
            className="sidebar__context-menu-item sidebar__context-menu-item--danger"
            type="button"
            disabled={openProjects.length === 0}
            onClick={() => {
              onCloseAllProjects();
              setContextMenu(null);
            }}
          >
            {t('sidebar.closeAllProjects')}
          </button>
        </div>
      )}

      {rebuildToast ? (
        <div className="sidebar__toast-host" aria-live="assertive">
          <InlineFeedback
            tone="error"
            title={t('sidebar.rebuildOutputFailedTitle')}
            description={rebuildToast}
            autoDismiss={2800}
            onDismiss={() => setRebuildToast(null)}
          />
        </div>
      ) : null}
    </aside>
  );
}
