import React from 'react';
import Card from '@/components/ui/Card';
import IncassiDashboard from './components/IncassiDashboard';

const IncassiPage: React.FC = () => {
  return (
    <Card title="Gestione Incassi">
      <IncassiDashboard />
    </Card>
  );
};

export default IncassiPage; 