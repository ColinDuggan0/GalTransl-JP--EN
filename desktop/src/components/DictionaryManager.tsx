import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './Button';
import { Panel } from './Panel';
import { EmptyState, ErrorState, InlineFeedback, LoadingState } from './page-state';
import type { DictFileContent, DictionaryCategory } from '../lib/api';
import { t } from '../i18n';

type DictTab = DictionaryCategory;
type DictRowType = 'normal' | 'conditional' | 'situation' | 'gpt' | 'comment' | 'blank';

type DictRow = {
  type: DictRowType;
  values: string[];
  raw: string;
};

type DictRowWithIndex = {
  row: DictRow;
  rowIndex: number;
};

type DictRowGroup = {
  type: DictRowType;
  items: DictRowWithIndex[];
};

type DictionaryManagerData = {
  pre_dict_files: string[];
  gpt_dict_files: string[];
  post_dict_files: string[];
  dict_contents: Record<string, DictFileContent>;
};

type DictionaryManagerProps = {
  title: string;
  description: string;
  data: DictionaryManagerData | null;
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void>;
  onCreateFile: (category: DictTab, filename: string) => Promise<string>;
  onSaveFile: (fileKey: string, content: string) => Promise<void>;
  onDeleteFile: (fileKey: string) => Promise<void>;
  onGenerateGptDict?: () => Promise<void>;
};

type DictContextMenuState = {
  x: number;
  y: number;
  file: string;
};

const PROJECT_DIR_MARKER = '(project_dir)';
const REFRESH_SPIN_CYCLE_MS = 500;

/** Strip the "(project_dir)" prefix for display purposes */
function stripProjectDirMarker(name: string): string {
  return name.replace(PROJECT_DIR_MARKER, '').trim();
}

function getFilesByTab(data: DictionaryManagerData | null, tab: DictTab): string[] {
  if (!data) return [];
  const files = tab === 'pre' ? data.pre_dict_files : tab === 'gpt' ? data.gpt_dict_files : data.post_dict_files;
  return [...files].sort((a, b) => {
    const aMtime = data.dict_contents[a]?.mtime ?? -1;
    const bMtime = data.dict_contents[b]?.mtime ?? -1;
    if (aMtime !== bMtime) {
      return bMtime - aMtime;
    }
    return stripProjectDirMarker(a).localeCompare(stripProjectDirMarker(b));
  });
}

function parseRows(text: string, tab: DictTab): DictRow[] {
  const lines = text.split('\n');
  return lines.map((line) => {
    if (!line.trim() && !line.includes('\t')) return { type: 'blank', values: [], raw: line };
    if (line.startsWith('//') || line.startsWith('#') || line.startsWith('\\\\')) {
      return { type: 'comment', values: [line], raw: line };
    }
    const parts = line.split('\t');
    if (tab === 'gpt') {
      const [src = '', dst = '', ...notes] = parts;
      return { type: 'gpt', values: [src, dst, notes.join('\t')], raw: line };
    }
    if (
      parts.length >= 4
      && ['pre_jp', 'post_jp', 'pre_zh', 'post_zh', 'pre_src', 'post_src', 'pre_dst', 'post_dst'].includes(parts[0])
    ) {
      const [target = '', cond = '', search = '', replace = '', ...rest] = parts;
      return { type: 'conditional', values: [target, cond, search, replace, rest.join('\t')], raw: line };
    }
    if (parts.length >= 3 && ['diag', 'mono'].includes(parts[0])) {
      const [scene = '', search = '', ...replace] = parts;
      return { type: 'situation', values: [scene, search, replace.join('\t')], raw: line };
    }
    const [search = '', replace = '', ...rest] = parts;
    return { type: 'normal', values: [search, replace, rest.join('\t')], raw: line };
  });
}

function rowsToText(rows: DictRow[]): string {
  return rows.map((row) => {
    if (row.type === 'blank') return '';
    if (row.type === 'comment') return row.values[0] ?? row.raw;
    return row.values.join('\t');
  }).join('\n');
}

/** Column labels by tab & row type for the card's header pills */
function getTypeLabel(type: DictRowType, tab: DictTab): string {
  if (type === 'comment') return t('dictionary.type.comment');
  if (type === 'blank') return t('dictionary.type.blank');
  if (type === 'gpt') return 'GPT';
  if (type === 'normal') return t('dictionary.type.normal');
  if (type === 'conditional') return t('dictionary.type.conditional');
  if (type === 'situation') return t('dictionary.type.situation');
  return type;
}

/** Field labels for each row type */
function getFieldLabels(type: DictRowType, _tab: DictTab): string[] {
  if (type === 'gpt') return [t('dictionary.column.source'), t('dictionary.column.translation'), t('dictionary.column.explanationOptional')];
  if (type === 'normal') return [t('dictionary.column.search'), t('dictionary.column.replace'), t('dictionary.column.note')];
  if (type === 'conditional') return [t('dictionary.column.target'), t('dictionary.column.condition'), t('dictionary.column.search'), t('dictionary.column.replace'), t('dictionary.column.note')];
  if (type === 'situation') return [t('dictionary.column.situation'), t('dictionary.column.search'), t('dictionary.column.replace')];
  if (type === 'comment') return [t('dictionary.column.content')];
  return [];
}

/* ── Grouped dict entries card ── */
function DictEntryGroupCard({
  group,
  tab,
  onCellChange,
  onDelete,
  onAddRow,
}: {
  group: DictRowGroup;
  tab: DictTab;
  onCellChange: (rowIndex: number, cellIndex: number, value: string) => void;
  onDelete: (rowIndex: number) => void;
  onAddRow: (rowType: DictRowType, insertAfterRowIndex: number) => void;
}) {
  const labels = getFieldLabels(group.type, tab);
  const tableStyle = { '--dict-column-count': labels.length } as CSSProperties;

  return (
    <article className={`dict-card dict-card--${group.type} dict-card--grouped`}>
      <div className="dict-card__header">
        <div className="dict-card__badges">
          <span className={`dict-card__pill dict-card__pill--${group.type}`}>
            {getTypeLabel(group.type, tab)}
          </span>
          <span className="dict-card__pill dict-card__pill--index">{t('dictionary.itemCount', { count: group.items.length })}</span>
        </div>
      </div>

      <div className="dict-card__table" style={tableStyle}>
        <div className="dict-card__table-head">
          <div className="dict-card__head-cell dict-card__head-cell--index">ID</div>
          {labels.map((label, ci) => (
            <div key={ci} className="dict-card__head-cell">{label || t('dictionary.column.generic', { index: ci + 1 })}</div>
          ))}
        </div>

        {group.items.map(({ row, rowIndex }) => (
          <div key={`${rowIndex}`} className="dict-card__table-row">
            <div className="dict-card__cell dict-card__cell--index">#{rowIndex + 1}</div>
            {labels.map((label, ci) => (
              <div key={ci} className="dict-card__cell">
                <input
                  className="dict-card__input"
                  value={row.values[ci] ?? ''}
                  onChange={(e) => onCellChange(rowIndex, ci, e.target.value)}
                  placeholder={label || t('dictionary.column.generic', { index: ci + 1 })}
                />
              </div>
            ))}
            <button
              type="button"
              className="dict-card__row-delete"
              onClick={() => onDelete(rowIndex)}
              title={t('dictionary.deleteRow')}
            >
              ✕
            </button>
          </div>
        ))}

        <div className="dict-card__table-add-row">
          <button
            type="button"
            className="dict-card__add-row-btn"
            onClick={() => onAddRow(group.type, group.items[group.items.length - 1]?.rowIndex ?? -1)}
            title={t('dictionary.addSameType')}
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}

/* ── Main component ── */
export function DictionaryManager(props: DictionaryManagerProps) {
  const {
    data,
    loading,
    error,
    onReload,
    onCreateFile,
    onSaveFile,
    onDeleteFile,
    onGenerateGptDict,
    title,
    description,
  } = props;

  const [activeTab, setActiveTab] = useState<DictTab>('gpt');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mode, setMode] = useState<'card' | 'text'>('card');
  const [draftText, setDraftText] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingGptDict, setGeneratingGptDict] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newFilename, setNewFilename] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<DictContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const activeFiles = useMemo(() => getFilesByTab(data, activeTab), [data, activeTab]);

  const selectedContent = useMemo(() => {
    if (!data || !selectedFile) return null;
    return data.dict_contents[selectedFile] ?? null;
  }, [data, selectedFile]);

  const parsedRows = useMemo(() => parseRows(draftText, activeTab), [draftText, activeTab]);

  const filteredRows = useMemo(() => {
    const visible = parsedRows
      .map((row, rowIndex) => ({ row, rowIndex }))
      .filter(({ row }) => {
        // 过滤掉注释行（// 或 # 开头）
        if (row.type === 'comment') return false;
        // 过滤掉空行
        if (row.type === 'blank') return false;
        // 过滤掉少于 1 个 tab 分隔的行（即没有 tab 的行）
        if (!row.raw.includes('\t')) return false;
        return true;
      });
    if (!searchTerm.trim()) return visible;
    const needle = searchTerm.toLowerCase();
    return visible.filter(({ row }) => row.values.join('\t').toLowerCase().includes(needle));
  }, [parsedRows, searchTerm]);

  const groupedRows = useMemo(() => {
    const groups: DictRowGroup[] = [];
    for (const item of filteredRows) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.type === item.row.type) {
        lastGroup.items.push(item);
      } else {
        groups.push({ type: item.row.type, items: [item] });
      }
    }
    return groups;
  }, [filteredRows]);

  const handleReload = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const startedAt = Date.now();
    try {
      await onReload();
    } finally {
      const elapsedMs = Date.now() - startedAt;
      const minVisibleMs = 420;
      const minReachedMs = Math.max(elapsedMs, minVisibleMs);
      const remainToFullCycleMs = (REFRESH_SPIN_CYCLE_MS - (minReachedMs % REFRESH_SPIN_CYCLE_MS)) % REFRESH_SPIN_CYCLE_MS;
      const remainMs = Math.max(0, minVisibleMs - elapsedMs) + remainToFullCycleMs;
      if (remainMs > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remainMs));
      }
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!contextMenu) return;

    const onPointerDown = (event: PointerEvent) => {
      const menuEl = contextMenuRef.current;
      if (menuEl && menuEl.contains(event.target as Node)) return;
      setContextMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  const handleRevealFile = async (file: string) => {
    const filePath = data?.dict_contents?.[file]?.path;
    if (!filePath) {
      setLocalError(t('dictionary.errorLocateFile', { file: stripProjectDirMarker(file) }));
      setInfo(null);
      return;
    }

    setLocalError(null);
    setInfo(null);
    try {
      await invoke('reveal_file', { path: filePath });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t('dictionary.errorBrowse', { error: String(e) }));
    }
  };

  const handleGenerateGptDict = async () => {
    if (!onGenerateGptDict || generatingGptDict) return;
    setGeneratingGptDict(true);
    setLocalError(null);
    setInfo(null);
    try {
      await onGenerateGptDict();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t('dictionary.errorStartGpt'));
    } finally {
      setGeneratingGptDict(false);
    }
  };

  const ensureSelection = (nextFiles: string[]) => {
    if (nextFiles.length === 0) {
      setSelectedFile(null);
      setDraftText('');
      setDirty(false);
      return;
    }
    setSelectedFile((prev) => (prev && nextFiles.includes(prev) ? prev : nextFiles[0]));
  };

  useEffect(() => {
    if (!selectedFile && activeFiles.length > 0) {
      const first = activeFiles[0];
      setSelectedFile(first);
      const next = data?.dict_contents[first]?.lines.join('\n') ?? '';
      setDraftText(next);
      setDirty(false);
    }
  }, [activeFiles, selectedFile, data]);

  useEffect(() => {
    if (!selectedFile || !selectedContent || dirty) return;
    const next = selectedContent.lines.join('\n');
    if (draftText !== next) {
      setDraftText(next);
    }
  }, [selectedFile, selectedContent, dirty, draftText]);

  const handleSelectFile = (file: string) => {
    if (dirty && !confirm(t('dictionary.confirmUnsavedSwitchFile'))) {
      return;
    }
    setSelectedFile(file);
    const next = data?.dict_contents[file]?.lines.join('\n') ?? '';
    setDraftText(next);
    setDirty(false);
    setInfo(null);
    setLocalError(null);
  };

  const handleTabChange = (tab: DictTab) => {
    if (dirty && !confirm(t('dictionary.confirmUnsavedSwitchCategory'))) {
      return;
    }
    setActiveTab(tab);
    setSearchTerm('');
    const files = getFilesByTab(data, tab);
    ensureSelection(files);
    if (files.length > 0 && data) {
      setDraftText((data.dict_contents[files[0]]?.lines ?? []).join('\n'));
    }
    setDirty(false);
  };

  const updateRowCell = (rowIndex: number, cellIndex: number, value: string) => {
    const next = [...parsedRows];
    const row = next[rowIndex];
    if (!row || row.type === 'blank') return;
    if (row.type === 'comment' && cellIndex > 0) return;
    const nextValues = [...row.values];
    nextValues[cellIndex] = value;
    next[rowIndex] = { ...row, values: nextValues };
    setDraftText(rowsToText(next));
    setDirty(true);
    setInfo(null);
  };

  const deleteRow = (rowIndex: number) => {
    const next = parsedRows.filter((_, i) => i !== rowIndex);
    setDraftText(rowsToText(next));
    setDirty(true);
    setInfo(null);
  };

  const buildRowByType = (rowType: DictRowType): DictRow => {
    if (rowType === 'gpt') return { type: 'gpt', values: ['', '', ''], raw: '' };
    if (rowType === 'conditional') return { type: 'conditional', values: ['pre_src', '', '', '', ''], raw: '' };
    if (rowType === 'situation') return { type: 'situation', values: ['diag', '', ''], raw: '' };
    if (rowType === 'comment') return { type: 'comment', values: [''], raw: '' };
    return { type: 'normal', values: ['', '', ''], raw: '' };
  };

  const addRow = (rowType?: DictRowType, insertAfterRowIndex?: number) => {
    const targetType = rowType ?? (activeTab === 'gpt' ? 'gpt' : 'normal');
    const base = buildRowByType(targetType);
    const insertIndex = typeof insertAfterRowIndex === 'number' ? Math.max(0, insertAfterRowIndex + 1) : parsedRows.length;
    const next = [...parsedRows.slice(0, insertIndex), base, ...parsedRows.slice(insertIndex)];
    setDraftText(rowsToText(next));
    setDirty(true);
    setInfo(null);
  };

  const handleTextEditorKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const nextValue = `${draftText.slice(0, start)}\t${draftText.slice(end)}`;
    setDraftText(nextValue);
    setDirty(true);
    setInfo(null);
    window.requestAnimationFrame(() => {
      target.setSelectionRange(start + 1, start + 1);
      target.focus();
    });
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    if (activeTab === 'gpt') {
      const invalidRow = parsedRows
        .map((row, index) => ({ row, index }))
        .find(({ row }) => {
          if (row.type !== 'gpt') return false;
          const src = row.values[0]?.trim() ?? '';
          const dst = row.values[1]?.trim() ?? '';
          return !src || !dst;
        });
      if (invalidRow) {
        setLocalError(t('dictionary.errorGptRequired', { row: invalidRow.index + 1 }));
        setInfo(null);
        return;
      }
    }
    setSaving(true);
    setLocalError(null);
    setInfo(null);
    try {
      await onSaveFile(selectedFile, draftText);
      setDirty(false);
      setInfo(t('dictionary.saved'));
      await onReload();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t('dictionary.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    const raw = newFilename.trim();
    if (!raw) {
      setLocalError(t('dictionary.errorFileNameRequired'));
      return;
    }
    const name = /\.txt$/i.test(raw) ? raw : `${raw}.txt`;
    setCreating(true);
    setLocalError(null);
    setInfo(null);
    try {
      const createdFileKey = await onCreateFile(activeTab, name);
      setNewFilename('');
      setSelectedFile(createdFileKey);
      await onReload();
      setInfo(t('dictionary.created'));
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t('dictionary.errorCreate'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;
    if (!confirm(t('dictionary.confirmDeleteFile', { file: stripProjectDirMarker(selectedFile) }))) return;
    setDeleting(true);
    setLocalError(null);
    setInfo(null);
    try {
      await onDeleteFile(selectedFile);
      setDirty(false);
      await onReload();
      setInfo(t('dictionary.deleted'));
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t('dictionary.errorDelete'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="project-dictionary-page">
        <div className="project-dictionary-page__header"><h1>{title}</h1></div>
        <LoadingState title={t('dictionary.loadingTitle')} description={t('dictionary.loadingDescription')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-dictionary-page">
        <div className="project-dictionary-page__header"><h1>{title}</h1></div>
        <ErrorState title={t('dictionary.loadFailed')} description={error} />
      </div>
    );
  }

  return (
    <div className="project-dictionary-page">
      <div className="project-dictionary-page__header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {localError && <InlineFeedback tone="error" title={t('common.operationFailed')} description={localError} />}
      {info && <InlineFeedback className="inline-alert--floating" tone="success" title={t('common.success')} description={info} />}

      <div className="project-dictionary-page__content">
        <div className="dict-tabs">
          {(['gpt', 'pre', 'post'] as DictTab[]).map((tab) => (
            <button
              key={tab}
              className={`dict-tab ${activeTab === tab ? 'dict-tab--active' : ''}`}
              type="button"
              onClick={() => handleTabChange(tab)}
            >
              {tab === 'pre' ? t('dictionary.pre') : tab === 'gpt' ? t('dictionary.gpt') : t('dictionary.post')}
              <span className="dict-tab__count">{getFilesByTab(data, tab).length}</span>
            </button>
          ))}
          {activeTab === 'gpt' && onGenerateGptDict ? (
            <Button
              variant="secondary"
              onClick={() => void handleGenerateGptDict()}
              disabled={generatingGptDict}
            >
              {generatingGptDict ? t('dictionary.generating') : t('dictionary.generateGpt')}
            </Button>
          ) : null}
        </div>

        <div className="dict-layout">
          <aside className="dict-layout__sidebar">
            <div className="dict-layout__sidebar-header">
              <h3>{t('dictionary.filesTitle')}</h3>
              <button
                type="button"
                className={`icon-btn icon-btn--refresh${refreshing ? ' icon-btn--spinning' : ''}`}
                onClick={() => void handleReload()}
                disabled={refreshing}
                title={t('dictionary.refreshFiles')}
                aria-label={t('dictionary.refreshFiles')}
              >
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none">
                  <path d="M13.5 8a5.5 5.5 0 11-1.4-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M12 2v3.5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="dict-create-file">
              <input
                type="text"
                placeholder={t('dictionary.newFilePlaceholder')}
                value={newFilename}
                onChange={(e) => setNewFilename(e.target.value)}
              />
              <Button onClick={() => void handleCreate()} disabled={creating}>{t('dictionary.newFile')}</Button>
            </div>
            <div className="dict-file-list">
              {activeFiles.map((file) => {
                const content = data?.dict_contents?.[file];
                const isActive = selectedFile === file;
                return (
                  <button
                    key={file}
                    className={`dict-file-item ${isActive ? 'dict-file-item--active' : ''}`}
                    type="button"
                    onClick={() => handleSelectFile(file)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, file });
                    }}
                  >
                    <span className="dict-file-item__name">{stripProjectDirMarker(file)}</span>
                    {content && <span className="dict-file-item__count">{t('dictionary.itemCount', { count: content.count })}</span>}
                  </button>
                );
              })}
              {activeFiles.length === 0 && (
                <EmptyState title={t('dictionary.emptyCategoryTitle')} description={t('dictionary.emptyCategoryDescription')} />
              )}
            </div>
          </aside>

          <div className="dict-layout__main">
            {selectedFile ? (
              <Panel
                title={stripProjectDirMarker(selectedFile)}
                description={t('dictionary.contentDescription', { count: selectedContent?.count ?? 0, path: selectedContent?.path ?? '' })}
                actions={(
                  <div className="dict-panel-actions">
                    <Button variant="secondary" onClick={() => setMode(mode === 'card' ? 'text' : 'card')}>
                      {mode === 'card' ? t('dictionary.switchText') : t('dictionary.switchCards')}
                    </Button>
                    <Button variant="secondary" onClick={() => void handleDelete()} disabled={deleting}>{t('dictionary.deleteFile')}</Button>
                    <Button onClick={() => void handleSave()} disabled={saving || !dirty}>{t('common.save')}</Button>
                  </div>
                )}
              >
                <div className="dict-toolbar">
                  <input
                    type="text"
                    placeholder={t('dictionary.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="dict-search"
                  />
                  {mode === 'card' && (
                    activeTab === 'gpt' ? (
                      <Button variant="secondary" onClick={() => addRow('gpt')}>
                        {t('dictionary.addEntry')}
                      </Button>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={() => addRow('normal')}>
                          {t('dictionary.addNormalEntry')}
                        </Button>
                        <Button variant="secondary" onClick={() => addRow('conditional')}>
                          {t('dictionary.addConditionalEntry')}
                        </Button>
                      </>
                    )
                  )}
                </div>

                {mode === 'text' ? (
                  <textarea
                    className="dict-text-editor"
                    value={draftText}
                    onChange={(e) => {
                      setDraftText(e.target.value);
                      setDirty(true);
                      setInfo(null);
                    }}
                    onKeyDown={handleTextEditorKeyDown}
                    spellCheck={false}
                  />
                ) : (
                  <div className="dict-card-mode">
                    <div className="dict-card-list">
                      {groupedRows.map((group, groupIndex) => (
                        <DictEntryGroupCard
                          key={`${groupIndex}-${group.type}-${group.items[0]?.rowIndex ?? 0}`}
                          group={group}
                          tab={activeTab}
                          onCellChange={updateRowCell}
                          onDelete={deleteRow}
                          onAddRow={addRow}
                        />
                      ))}
                      {groupedRows.length === 0 && (
                        <EmptyState
                          title={searchTerm.trim() ? t('dictionary.noMatchesTitle') : t('dictionary.emptyTitle')}
                          description={searchTerm.trim() ? t('dictionary.noMatchesDescription') : t('dictionary.emptyDescription')}
                          action={(
                            activeTab === 'gpt' ? (
                              <Button variant="secondary" onClick={() => addRow('gpt')}>{t('dictionary.addEntry')}</Button>
                            ) : (
                              <div className="dict-empty-actions">
                                <Button variant="secondary" onClick={() => addRow('normal')}>{t('dictionary.addNormalEntry')}</Button>
                                <Button variant="secondary" onClick={() => addRow('conditional')}>{t('dictionary.addConditionalEntry')}</Button>
                              </div>
                            )
                          )}
                        />
                      )}
                    </div>
                  </div>
                )}
              </Panel>
            ) : (
              <EmptyState title={t('dictionary.chooseFileTitle')} description={t('dictionary.chooseFileDescription')} />
            )}
          </div>
        </div>
      </div>
      {contextMenu && createPortal(
        <div
          ref={contextMenuRef}
          className="cache-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="cache-context-menu__item"
            onClick={() => {
              const file = contextMenu.file;
              setContextMenu(null);
              void handleRevealFile(file);
            }}
          >
            <span className="cache-context-menu__icon" aria-hidden="true">📂</span>
            <span className="cache-context-menu__label">{t('dictionary.browseInFileManager')}</span>
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
