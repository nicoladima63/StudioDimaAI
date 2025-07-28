import React from 'react';
import Card from '@/components/ui/Card';
import Protocolli from '@/views/Protocolli';
import RicettaAuthStatus from '../components/RicettaAuthStatus';

const RicettaSettingPage: React.FC = () => {
  return (
    <div>
      <Card 
        title="Gestione Protocolli Terapeutici"
        headerAction={<RicettaAuthStatus />}
      >
        <Protocolli />
      </Card>
    </div>
  )
};

export default RicettaSettingPage;