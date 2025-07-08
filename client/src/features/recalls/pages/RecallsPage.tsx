import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
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
      <Card title="Gestione Richiami">
        {statistics && (
          <RecallsStatistics statistics={statistics} loading={loadingStats} />
        )}
        <RecallsTable richiami={richiami} loading={loading} />
      </Card>
    )
};

export default RecallsPage; 