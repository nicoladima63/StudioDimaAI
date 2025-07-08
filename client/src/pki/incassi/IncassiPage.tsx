import React from 'react';
import DashboardCard from '@/components/DashboardCard';
import IncassiDashboard from './components/IncassiDashboard';

const IncassiPage: React.FC = () => {
  return (
    <DashboardCard title="Gestione Incassi">
      <IncassiDashboard />
    </DashboardCard>
  );
};

export default IncassiPage; 