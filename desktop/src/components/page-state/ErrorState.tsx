import type { ReactNode } from 'react';
import { InlineFeedback } from './InlineFeedback';
import { t } from '../../i18n';

type ErrorStateProps = {
  title?: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function ErrorState({
  title = t('common.loadFailed'),
  description,
  action,
  className,
}: ErrorStateProps) {
  return (
    <InlineFeedback
      tone="error"
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}
