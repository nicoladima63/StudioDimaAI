import { useState, useEffect } from 'react';
import { getDatabaseStatus, toggleDatabaseMode } from '@/services/api/environment.service';
import { CFormSwitch , CFormLabel } from '@coreui/react';

type ApiDbStatus = { status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown' };
type ServiceStatus = { health: 'healthy' | 'unhealthy' | 'degraded' | 'unknown' };

type DbResponse = ApiDbStatus | ServiceStatus;

export default function DatabaseToggle({ onStatusChange }: { onStatusChange?: (s: string) => void }) {
  const [isProdMode, setIsProdMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshStatus() {
    setLoading(true);
    setError(null);
    try {
      const db: DbResponse = await getDatabaseStatus();

      const newStatus =
        'status' in db ? db.status :
        'health' in db ? db.health :
        'unknown';

      // Assuming 'healthy' maps to 'prod' and 'unhealthy' to 'dev' for the toggle
      setIsProdMode(newStatus === 'healthy');
      setStatus(newStatus); // Keep setStatus for onStatusChange if needed
      onStatusChange?.(newStatus);
    } catch (err: any) {
      console.error("Failed to fetch database status:", err);
      setError("Errore nel recupero dello stato del database.");
      setIsProdMode(false); // Default to dev mode on error
      onStatusChange?.('unknown');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    setError(null);
    const previousIsProdMode = isProdMode; // Store current state for optimistic update
    setIsProdMode(!isProdMode); // Optimistic update

    try {
      await toggleDatabaseMode();
      // Rely on optimistic update and initial mount refresh
    } catch (err: any) {
      console.error("Failed to toggle database mode:", err);
      setError("Errore durante il cambio di modalità del database.");
      setIsProdMode(previousIsProdMode); // Revert on error
    } finally {
      setLoading(false);
    }
  };

  // Helper to keep the old setStatus for onStatusChange prop, if it's still used
  const setStatus = (newStatus: string) => {
    // This function is just a placeholder to satisfy onStatusChange,
    // the actual UI state is managed by isProdMode
  };

  return (
    <div className="d-flex align-items-center gap-2">
      <CFormLabel htmlFor="database-mode-toggle" className="mb-0">
        {isProdMode ? 'Modalità Produzione' : 'Modalità Sviluppo'}
      </CFormLabel>
      <CFormSwitch 
        id="database-mode-toggle"
        color="primary"
        checked={isProdMode}
        onChange={handleToggle}
        disabled={loading}
        shape="pill"
      />
      {error && <span className="text-danger ms-2">{error}</span>}
    </div>
  );
}
