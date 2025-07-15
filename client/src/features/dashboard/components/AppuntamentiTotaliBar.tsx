import React from 'react';

interface TotaleAnno {
  anno: string;
  totale: number;
  colore: string;
  progressivo: number;
}

interface Props {
  totali: TotaleAnno[];
}

const AppuntamentiTotaliBar: React.FC<Props> = ({ totali }) => {
  const max = Math.max(...totali.map(t => t.totale), 1);

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px #0001' }}>
      {totali.map(({ anno, totale, colore, progressivo }) => {
        const progressivoPerc = Math.round((progressivo / max) * 100);
        return (
          <div key={anno} style={{ marginBottom: 32, position: 'relative' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Appuntamenti per l&apos;anno {anno}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative', height: 30 }}>
              <div style={{
                height: 18,
                width: `${Math.round((totale / max) * 100)}%`,
                background: colore,
                borderRadius: 8,
                transition: 'width 0.5s',
                minWidth: 24,
                position: 'relative'
              }} />
              <span style={{ marginLeft: 12, fontWeight: 500, fontSize: 18 }}>
                {totale}
              </span>
              <div style={{
                position: 'absolute',
                left: `calc(${progressivoPerc}% - 1px)`,
                top: -10,
                height: 38,
                width: 2,
                background: colore,
                zIndex: 2,
                borderRadius: 1
              }}>
                <div style={{
                  position: 'absolute',
                  top: -22,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontWeight: 600,
                  fontSize: 14,
                  color: colore
                }}>
                  {progressivo}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AppuntamentiTotaliBar; 