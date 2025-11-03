import React, { useState, useEffect } from 'react';
import { CSpinner } from '@coreui/react';
import automationApi, { type AutomationRule } from '@/features/settings/services/automation.service';

interface MonitorRulesProps {
  monitorId: string;
}

const MonitorRules: React.FC<MonitorRulesProps> = ({ monitorId }) => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRules = async () => {
      if (!monitorId) return;
      setLoading(true);
      try {
        const data = await automationApi.getRules({ monitor_id: monitorId, attiva: true });
        setRules(data);
      } catch (error) {
        console.error(`Failed to fetch rules for monitor ${monitorId}`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, [monitorId]);

  if (loading) {
    return <CSpinner size="sm" />;
  }

  return (
    <small className="text-muted">
      {rules.length > 0 ? (
        <ul className="list-unstyled mb-0">
          {rules.map((rule,index) => (
            <li key={rule.id}>{index+1} - {rule.name}</li>
          ))}
        </ul>
      ) : (
        'Nessuna regola attiva'
      )}
    </small>
  );
};

export default MonitorRules;
