import React from "react";
import { Card } from "@/components/ui";
import CrudStrutturaConti from "../../spese/components/CrudStrutturaConti";

const ContiPage: React.FC = () => {
  return (
    <Card className="p-4">
      <div className="mb-4">
        <h2 className="mb-2">📊 Gestione Conti</h2>
        <p className="text-muted">
          Gestisci la struttura contabile: conti, branche e sottoconti
        </p>
      </div>
      
      <CrudStrutturaConti />
    </Card>
  );
};

export default ContiPage;