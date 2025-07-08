import React, { useEffect, useState } from 'react';
import RecallsStatistics from '../components/RecallsStatistics';
import RecallsTable from '../components/RecallsTable';
import { recallsService } from '@/api/services/recalls.service';
import type { Richiamo, RichiamoStatistics } from '@/lib/apiTypes';

const RecallsPage: React.FC = () => {
  const [richiami, setRichiami] = useState<Richiamo[]>([]);
  const [statistics, setStatistics] = useState<RichiamoStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    setLoading(true);
    recallsService.getRecalls().then(res => {
      setRichiami(res.data);
      setLoading(false);
    });
    setLoadingStats(true);
    recallsService.getStatistics().then(res => {
      setStatistics(res.data);
      setLoadingStats(false);
    });
  }, []);

  return (
    <div className="recalls-page">
      <h4>Gestione Richiami</h4>
      {statistics && (
        <RecallsStatistics statistics={statistics} loading={loadingStats} />
      )}
      <RecallsTable richiami={richiami} loading={loading} />
    </div>
  );
};

export default RecallsPage; 