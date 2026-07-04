import { useEffect, useRef, useState } from 'react';
import { speakerStyle } from '../lib/speaker';
import { resolveSpeakerName } from '../lib/useNameDict';
import { toDisplayError } from '../lib/errors';
import { getLocale, t } from '../i18n';
import type {
  FileProgress,
  Job,
  ProjectRuntimeErrorEntry,
  ProjectRuntimeSuccessEntry,
  RuntimeJob,
} from '../lib/api';

export function RuntimeErrorRow({ entry }: { entry: ProjectRuntimeErrorEntry }) {
  const [copied, setCopied] = useState(false);
  const [isMessageTruncated, setIsMessageTruncated] = useState(false);
  const messageRef = useRef<HTMLParagraphElement | null>(null);
  const messageText = (entry.message || '').trim();
  const displayMessageText = messageText ? toDisplayError(messageText) : '';
  const kindLabel = getErrorKindLabel(entry.kind);
  const modelLabel = compactModelLabel(entry.model);

  useEffect(() => {
    const el = messageRef.current;
    if (!el) {
      setIsMessageTruncated(false);
      return;
    }

    const updateTruncation = () => {
      const truncated = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      setIsMessageTruncated(truncated);
    };

    updateTruncation();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      updateTruncation();
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [displayMessageText]);

  const handleCopyMessage = async () => {
    if (!messageText) return;
    const ok = await copyTextToClipboard(messageText);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <article className="runtime-event runtime-event--error">
      <div className="runtime-event__header">
        <div className="runtime-event__badges">
          <span className="runtime-event__pill runtime-event__pill--danger">{kindLabel}</span>
          {(entry.retry_count ?? 0) > 0 ? <span className="runtime-event__pill">{t('runtime.retryCount', { count: entry.retry_count ?? 0 })}</span> : null}
        </div>
        <div className="runtime-event__header-right">
          <div className="runtime-event__error-time-action">
            <time className="runtime-event__timestamp runtime-event__timestamp--error">{formatTime(entry.ts)}</time>
            <button
              type="button"
              className={`icon-btn runtime-event__copy-btn runtime-event__time-copy${copied ? ' runtime-event__copy-btn--copied' : ''}`}
              onClick={() => void handleCopyMessage()}
              disabled={!messageText}
              title={!messageText ? t('runtime.noCopyContent') : (copied ? t('runtime.copied') : t('runtime.copyError'))}
              aria-label={!messageText ? t('runtime.noCopyContent') : t('runtime.copyError')}
            >
              {copied ? (
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
                  <path d="M3.2 8.6l3.1 3.1 6.5-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
                  <rect x="6" y="2.5" width="7.5" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M4.5 5.5H3.9A1.4 1.4 0 0 0 2.5 6.9v5.2a1.4 1.4 0 0 0 1.4 1.4h4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      <p
        ref={messageRef}
        className="runtime-event__message"
        title={isMessageTruncated && displayMessageText ? displayMessageText : undefined}
      >
        {displayMessageText || t('runtime.noErrorDetails')}
      </p>
      <dl className="runtime-event__meta">
        {entry.kind !== 'api' && (
          <div>
            <dd>{`${stripAllExtensions(entry.filename) || '—'}: ${entry.index_range || '—'}`}</dd>
          </div>
        )}
        <div className="runtime-event__meta-model">
          <dd>{modelLabel || '—'}</dd>
        </div>
        {(entry.sleep_seconds ?? 0) > 0 ? <span className="runtime-event__pill">{t('runtime.backoffSeconds', { seconds: Number(entry.sleep_seconds).toFixed(3) })}</span> : null}
      </dl>
    </article>
  );
}

export function RuntimeSuccessRow({
  entry,
  isFresh,
  isSuccessFileFilterActive,
  onToggleSuccessFileFilter,
  nameDict }: {
  entry: ProjectRuntimeSuccessEntry;
  isFresh: boolean;
  isSuccessFileFilterActive: boolean;
  onToggleSuccessFileFilter: (filename: string) => void;
  nameDict: Map<string, string>;
}) {
  const rawSpeakerLabel = Array.isArray(entry.speaker) ? entry.speaker.join(' / ') : entry.speaker;
  const speakerLabel = rawSpeakerLabel
    ? (Array.isArray(entry.speaker)
        ? entry.speaker.map((s) => resolveSpeakerName(s, nameDict)).join(' / ')
        : resolveSpeakerName(rawSpeakerLabel, nameDict))
    : rawSpeakerLabel;
  const speakerStyleVal = rawSpeakerLabel ? speakerStyle(rawSpeakerLabel) : undefined;
  const entryFilename = entry.filename || t('runtime.unnamedFile');
  const filterFilename = entry.filename;
  const translatorLabel = compactModelLabel(entry.trans_by);

  return (
    <article className={`runtime-event runtime-event--success${isFresh ? ' runtime-event--fresh' : ''}`}>
      <div className="runtime-event__header">
        <div className="runtime-event__badges">
          <span className="runtime-event__pill runtime-event__pill--success">#{entry.index}</span>
          <span
            className={`runtime-event__pill runtime-event__pill--file${filterFilename ? ' runtime-event__pill--file-clickable' : ''}${isSuccessFileFilterActive ? ' runtime-event__pill--file-active' : ''}`}
            title={entryFilename}
          >
            {filterFilename ? (
              <button
                aria-label={t('runtime.filterSuccessStream')}
                aria-pressed={isSuccessFileFilterActive}
                className="runtime-event__file-name-btn"
                onClick={() => onToggleSuccessFileFilter(filterFilename)}
                title={t('runtime.filterSuccessStream')}
                type="button"
              >
                {entryFilename}
              </button>
            ) : (
              <span className="runtime-event__file-text">{entryFilename}</span>
            )}
          </span>
        </div>
        <div className="runtime-event__header-right">
          {translatorLabel ? <span className="runtime-event__pill runtime-event__pill--translator">{translatorLabel}</span> : null}
          <time className="runtime-event__timestamp">{formatTime(entry.ts)}</time>
        </div>
      </div>
      <div className="runtime-success-compact">
        <p className="runtime-success-compact__line">
          <span className="runtime-success-compact__label">SRC</span>
          {speakerLabel ? <span className="runtime-success-compact__speaker-inline" style={speakerStyleVal}>{speakerLabel}</span> : null}
          <span title={entry.source_preview || undefined}>{entry.source_preview || '—'}</span>
        </p>
        <p className="runtime-success-compact__line">
          <span className="runtime-success-compact__label">DST</span>
          {speakerLabel ? <span className="runtime-success-compact__speaker-inline" style={speakerStyleVal}>{speakerLabel}</span> : null}
          <span title={entry.translation_preview || undefined}>{entry.translation_preview || '—'}</span>
        </p>
      </div>
    </article>
  );
}

export function FileProgressRow({
  file,
  isSuccessFileFilterActive,
  onToggleSuccessFileFilter }: {
  file: FileProgress;
  isSuccessFileFilterActive: boolean;
  onToggleSuccessFileFilter: (filename: string) => void;
}) {
  const percent = file.total > 0 ? Math.round((file.translated / file.total) * 100) : 0;
  const isComplete = file.translated === file.total && file.total > 0;
  const hasFailed = file.failed > 0;

  return (
    <div className="file-progress-row file-progress-row--runtime">
      <div className="file-progress-row__info">
        <div className="file-progress-row__identity">
          <span className="file-progress-row__name-wrap">
            <span className="file-progress-row__name">{file.filename}</span>
            <button
              aria-label={t('runtime.filterSuccessStream')}
              aria-pressed={isSuccessFileFilterActive}
              className={`file-progress-row__filter-toggle${isSuccessFileFilterActive ? ' file-progress-row__filter-toggle--active' : ''}`}
              onClick={() => onToggleSuccessFileFilter(file.filename)}
              title={t('runtime.filterSuccessStream')}
              type="button"
            >
              <FilterFunnelIcon className="file-progress-row__filter-icon" />
              <span className="file-progress-row__filter-tooltip">{t('runtime.filterSuccessStream')}</span>
              {isSuccessFileFilterActive ? <span className="file-progress-row__filter-check">✓</span> : null}
            </button>
          </span>
          <span className="file-progress-row__state">{isComplete ? t('runtime.file.completed') : percent > 0 ? t('runtime.file.processing') : t('runtime.file.queued')}</span>
        </div>
        <span className="file-progress-row__count">
          {file.translated}/{file.total}
          {hasFailed ? <span className="file-progress-row__failed"> · {t('runtime.file.failedCount', { count: file.failed })}</span> : null}
        </span>
      </div>
      <div className="progress-bar progress-bar--small">
        <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function FilterFunnelIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path d="M3 5h18l-7 8v5.5l-4 1.9V13L3 5z" fill="currentColor" />
    </svg>
  );
}

export function toRuntimeJob(job: Job): RuntimeJob {
  return {
    job_id: job.job_id,
    status: job.status,
    translator: job.translator,
    created_at: job.created_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
    error: job.error,
    gendic_added_entries: job.gendic_added_entries,
    gendic_duplicated_entries: job.gendic_duplicated_entries,
  };
}

export function getStatusLabel(status?: RuntimeJob['status']) {
  switch (status) {
    case 'running':
      return t('runtime.status.running');
    case 'pending':
      return t('runtime.status.pending');
    case 'completed':
      return t('runtime.status.completed');
    case 'failed':
      return t('runtime.status.failed');
    case 'cancelled':
      return t('runtime.status.cancelled');
    default:
      return t('runtime.status.idle');
  }
}

export function getErrorKindLabel(kind: string): string {
  const normalized = (kind || '').trim().toLowerCase();
  if (normalized === 'parse') return t('runtime.errorKind.parse');
  if (normalized === 'api') return t('runtime.errorKind.api');
  return kind || 'error';
}

function compactModelLabel(value: string | null | undefined): string {
  const text = (value || '').trim();
  if (!text) return '';
  const idx = text.lastIndexOf('/');
  if (idx < 0) return text;
  const tail = text.slice(idx + 1).trim();
  return tail || text;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export function formatDate(isoString: string): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return date.toLocaleString(getLocale(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit' });
  } catch {
    return isoString;
  }
}

export function formatTime(isoString: string): string {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleTimeString(getLocale(), {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit' });
  } catch {
    return isoString;
  }
}

export function formatSpeed(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return t('runtime.speed.zero');
  return t('runtime.speed.linesPerMinute', { value: value.toFixed(value >= 10 ? 0 : 1) });
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return t('runtime.duration.seconds', { count: Math.round(seconds) });
  if (seconds < 3600) return t('runtime.duration.minutes', { count: Math.round(seconds / 60) });
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return t('runtime.duration.hoursMinutes', { hours, minutes });
}

export function formatElapsedTime(job: RuntimeJob | null, nowMs: number): string {
  if (!job?.started_at) {
    return job?.status === 'pending' ? t('runtime.waitingStart') : '—';
  }

  const startMs = Date.parse(job.started_at);
  if (Number.isNaN(startMs)) return '—';

  const endMs = job.finished_at ? Date.parse(job.finished_at) : nowMs;
  const safeEndMs = Number.isNaN(endMs) ? nowMs : endMs;
  const elapsedSeconds = Math.max(0, Math.floor((safeEndMs - startMs) / 1000));

  if (elapsedSeconds < 60) return t('runtime.duration.seconds', { count: elapsedSeconds });
  if (elapsedSeconds < 3600) {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return t('runtime.elapsed.minutesSeconds', { minutes, seconds });
  }

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  return t('runtime.duration.hoursMinutes', { hours, minutes });
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function formatPercentDisplay(value: number): string {
  const clamped = clampPercent(value);
  const rounded = Number(clamped.toFixed(1));
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function stripAllExtensions(filename: string): string {
  return filename.replace(/(\.[^.]+)+$/, '');
}
