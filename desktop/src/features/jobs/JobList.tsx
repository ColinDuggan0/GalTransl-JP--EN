import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Panel } from '../../components/Panel';
import { InlineFeedback } from '../../components/page-state/InlineFeedback';
import type { Job } from '../../lib/api';
import { t } from '../../i18n';
import { JobCard } from './JobCard';

type JobListProps = {
  jobs: Job[];
  jobsError: string | null;
  loading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
};

export function JobList({ jobs, jobsError, loading, onRefresh, refreshing }: JobListProps) {
  return (
    <Panel
      title={t('jobs.title')}
      description={t('jobs.description')}
      actions={
        <Button disabled={refreshing} onClick={onRefresh} variant="secondary">
          {refreshing ? t('jobs.refreshing') : t('jobs.refreshList')}
        </Button>
      }
    >
      {jobsError ? <InlineFeedback tone="error" title={t('jobs.loadFailed')} description={jobsError} /> : null}

      {loading ? <EmptyState title={t('jobs.loadingTitle')} description={t('jobs.loadingDescription')} /> : null}

      {!loading && jobs.length === 0 ? (
        <EmptyState
          title={t('jobs.emptyTitle')}
          description={t('jobs.emptyDescription')}
        />
      ) : null}

      {!loading && jobs.length > 0 ? (
        <div className="job-list">
          {jobs.map((job) => (
            <JobCard job={job} key={job.job_id} />
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
