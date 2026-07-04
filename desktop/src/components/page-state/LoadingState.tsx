import type { ReactNode } from 'react';
import { t } from '../../i18n';

type LoadingStateProps = {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function LoadingState({
  title = t('common.loading'),
  description,
  action,
  className,
}: LoadingStateProps) {
  const classes = ['empty-state', 'page-state', 'page-state--loading', className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="status" aria-live="polite">
      <div className="page-state__icon" aria-hidden="true">⏳</div>
      <div className="page-state__body">
        <strong>{title}</strong>
        {description ? <span>{description}</span> : null}
      </div>
      {action ? <div className="page-state__action">{action}</div> : null}
    </div>
  );
}
