import { Button } from '../../components/Button';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import type { ConnectionPhase } from '../../lib/api';
import { t } from '../../i18n';

type ConnectionStatusCardProps = {
  backendUrl: string;
  connectionMessage: string;
  connectionPhase: ConnectionPhase;
  isRefreshing: boolean;
  onRefresh: () => void;
  translatorCount: number;
};

export function ConnectionStatusCard({
  backendUrl,
  connectionMessage,
  connectionPhase,
  isRefreshing,
  onRefresh,
  translatorCount,
}: ConnectionStatusCardProps) {
  return (
    <Panel
      title={t('connection.title')}
      description={t('connection.description')}
      actions={
        <Button disabled={isRefreshing} onClick={onRefresh} variant="secondary">
          {isRefreshing ? t('connection.refreshing') : t('connection.reconnect')}
        </Button>
      }
    >
      <div className="connection-card__status-row">
        <StatusBadge label={getPhaseLabel(connectionPhase)} tone={connectionPhase} />
        <span className="connection-card__url">{backendUrl}</span>
      </div>

      <p className="connection-card__message">{connectionMessage}</p>

      <dl className="meta-grid">
        <div>
          <dt>{t('connection.translatorCount')}</dt>
          <dd>{translatorCount}</dd>
        </div>
        <div>
          <dt>{t('connection.pollingFrequency')}</dt>
          <dd>{t('connection.everyTwoSeconds')}</dd>
        </div>
      </dl>
    </Panel>
  );
}

function getPhaseLabel(phase: ConnectionPhase) {
  switch (phase) {
    case 'online':
      return t('connection.online');
    case 'offline':
      return t('connection.offline');
    default:
      return t('connection.connecting');
  }
}
