import { ApiError } from './api';

const DISPLAY_ERROR_MAPPINGS: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^无法连接到后端[：:]\s*(.+)$/u, (match) => `Cannot connect to backend: ${match[1]}`],
  [/^无法连接到本地后端[：:]\s*(.*)$/u, (match) => (
    match[1] ? `Cannot connect to local backend: ${match[1]}` : 'Cannot connect to local backend'
  )],
  [/^请求失败[：:]\s*(.+)$/u, (match) => `Request failed: ${match[1]}`],
  [/^读取任务列表失败[：:]\s*(.*)$/u, (match) => (
    match[1] ? `Failed to read job list: ${match[1]}` : 'Failed to read job list'
  )],
];

export function toDisplayError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return message;

  for (const [pattern, format] of DISPLAY_ERROR_MAPPINGS) {
    const match = trimmed.match(pattern);
    if (match) {
      return format(match);
    }
  }

  return message;
}

export function normalizeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return toDisplayError(error.message);
  }

  if (error instanceof Error && error.message.trim()) {
    return toDisplayError(error.message);
  }

  return toDisplayError(fallback);
}
