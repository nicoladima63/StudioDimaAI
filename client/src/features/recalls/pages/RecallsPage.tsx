import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import RecallsStatistics from '../components/RecallsStatistics';
import RecallsTable from '../components/RecallsTable';
import { getRecalls, getRecallStatistics } from '@/api/services/recalls.service';
import type { Richiamo, RichiamoStatistics } from '@/lib/types';

const RecallsPage: React.FC = () => {
  const [richiami, setRichiami] = useState<Richiamo[]>([]);
  const [statistics, setStatistics] = useState<RichiamoStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  

  useEffect(() => {
    setLoading(true);
    getRecalls().then(res => {
      setRichiami(res.data);
      setLoading(false);
    });

    setLoadingStats(true);
    getRecallStatistics().then(res => {
      setStatistics(res.data);
      setLoadingStats(false);
    });
  }, []);

  return (
    <Card title="Gestione Richiami">
      {statistics && (
        <RecallsStatistics statistics={statistics} loading={loadingStats} />
      )}
      <RecallsTable richiami={richiami} loading={loading} />
    </Card>
  );
};

export default RecallsPage;
