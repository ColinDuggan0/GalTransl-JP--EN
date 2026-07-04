import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '../../components/Panel';
import { t } from '../../i18n';

interface RetranslKeySectionProps {
  config: Record<string, unknown> | null;
  onChange: (keys: string[]) => void;
  onDirty: () => void;
}

function readKeys(config: Record<string, unknown> | null): string[] {
  const common = (config?.common as Record<string, unknown>) || {};
  const raw = common.retranslKey;
  if (Array.isArray(raw)) {
    return raw.map((k) => String(k ?? '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw.split(/\r?\n/).map((k) => k.trim()).filter(Boolean);
  }
  return [];
}

export function RetranslKeySection({ config, onChange, onDirty }: RetranslKeySectionProps) {
  const keys = useMemo(() => readKeys(config), [config]);

  const [draft, setDraft] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingIndex !== null) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingIndex]);

  const commit = (next: string[]) => {
    onChange(next);
    onDirty();
  };

  const handleAdd = () => {
    const value = draft.trim();
    if (!value) return;
    if (keys.includes(value)) {
      setDraft('');
      return;
    }
    commit([...keys, value]);
    setDraft('');
  };

  const handleDelete = (idx: number) => {
    const next = keys.filter((_, i) => i !== idx);
    commit(next);
    if (editingIndex === idx) {
      setEditingIndex(null);
      setEditingDraft('');
    }
  };

  const handleStartEdit = (idx: number) => {
    setEditingIndex(idx);
    setEditingDraft(keys[idx] ?? '');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingDraft('');
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const value = editingDraft.trim();
    if (!value) {
      handleDelete(editingIndex);
      return;
    }
    // Deduplicate: if another entry already has this value, just drop the current one
    const duplicateIdx = keys.findIndex((k, i) => i !== editingIndex && k === value);
    let next: string[];
    if (duplicateIdx >= 0) {
      next = keys.filter((_, i) => i !== editingIndex);
    } else {
      next = keys.map((k, i) => (i === editingIndex ? value : k));
    }
    commit(next);
    setEditingIndex(null);
    setEditingDraft('');
  };

  return (
    <Panel
      title={t('projectConfig.retransl.title')}
      description={t('projectConfig.retransl.description')}
    >
      <div className="retransl-key-section">
        <div className="retransl-key-section__add">
          <input
            type="text"
            className="retransl-key-section__input"
            placeholder={t('projectConfig.retransl.placeholder')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <button
            type="button"
            className="retransl-key-section__btn retransl-key-section__btn--primary"
            onClick={handleAdd}
            disabled={!draft.trim()}
          >
            {t('common.add')}
          </button>
        </div>

        {keys.length === 0 ? (
          <div className="retransl-key-section__empty">
            {t('projectConfig.retransl.empty')}
          </div>
        ) : (
          <ul className="retransl-key-section__list">
            {keys.map((key, idx) => {
              const isEditing = editingIndex === idx;
              return (
                <li
                  key={`${idx}-${key}`}
                  className={`retransl-key-section__item${isEditing ? ' retransl-key-section__item--editing' : ''}`}
                >
                  <span className="retransl-key-section__index">{idx + 1}</span>
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      className="retransl-key-section__input retransl-key-section__input--inline"
                      value={editingDraft}
                      onChange={(e) => setEditingDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveEdit();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          handleCancelEdit();
                        }
                      }}
                    />
                  ) : (
                    <span className="retransl-key-section__text" title={key}>{key}</span>
                  )}
                  <div className="retransl-key-section__actions">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="retransl-key-section__btn retransl-key-section__btn--primary"
                          onClick={handleSaveEdit}
                          disabled={!editingDraft.trim()}
                        >
                          {t('common.save')}
                        </button>
                        <button
                          type="button"
                          className="retransl-key-section__btn retransl-key-section__btn--ghost"
                          onClick={handleCancelEdit}
                        >
                          {t('common.cancel')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="retransl-key-section__btn retransl-key-section__btn--ghost"
                          onClick={() => handleStartEdit(idx)}
                          title={t('common.edit')}
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          className="retransl-key-section__btn retransl-key-section__btn--danger"
                          onClick={() => handleDelete(idx)}
                          title={t('common.delete')}
                        >
                          {t('common.delete')}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}
