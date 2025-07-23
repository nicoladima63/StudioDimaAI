import React, { useEffect, useState } from "react";
import {
  CCard,
  CCardBody,
  CFormSwitch,
  CFormLabel,
  CRow,
  CCol,
  CButton,
  CFormSelect,
  CAlert,
  CSpinner,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
} from "@coreui/react";
import apiClient from "@/api/client";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const AutomationCalendarSyncSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(true);
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [log, setLog] = useState<
    { message: string; type: "info" | "success" | "error"; timestamp: Date }[]
  >([]);
  
  // Stati per azioni rapide
  const [clearingAll, setClearingAll] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  
  // Stati per le modal di conferma
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  const addLog = (
    message: string,
    type: "info" | "success" | "error" = "info"
  ) => {
    setLog((prev) =>
      [{ message, type, timestamp: new Date() }, ...prev].slice(0, 10)
    );
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    addLog("Caricamento impostazioni calendario...", "info");
    try {
      const res = await apiClient.get("/api/settings/calendar-sync");
      setEnabled(res.data.calendar_sync_enabled ?? true);
      setHour(res.data.calendar_sync_hour ?? 21);
      setMinute(res.data.calendar_sync_minute ?? 0);
      addLog("Impostazioni calendario caricate con successo", "success");
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Errore nel recupero delle impostazioni";
      setError(errorMsg);
      addLog(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEnabledChange = async (newEnabled: boolean) => {
    setEnabled(newEnabled);
    addLog(`${newEnabled ? 'Attivazione' : 'Disattivazione'} automazione calendario...`, "info");
    try {
      await apiClient.post("/api/settings/calendar-sync", {
        calendar_sync_enabled: newEnabled,
        calendar_sync_hour: hour,
        calendar_sync_minute: minute,
      });
      addLog(`Automazione calendario ${newEnabled ? 'attivata' : 'disattivata'} con successo`, "success");
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Errore nel salvataggio dello stato";
      setError(errorMsg);
      addLog(errorMsg, "error");
      // Ripristina lo stato precedente in caso di errore
      setEnabled(!newEnabled);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    addLog("Salvataggio orario sincronizzazione...", "info");
    try {
      await apiClient.post("/api/settings/calendar-sync", {
        calendar_sync_enabled: enabled,
        calendar_sync_hour: hour,
        calendar_sync_minute: minute,
      });
      setSuccess("Orario sincronizzazione salvato con successo!");
      addLog("Orario sincronizzazione salvato con successo", "success");
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Errore nel salvataggio dell'orario";
      setError(errorMsg);
      addLog(errorMsg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    setShowClearConfirm(false);
    setClearingAll(true);
    addLog("Cancellazione di tutti i calendari...", "info");
    try {
      const res = await apiClient.post("/api/settings/calendar-sync/clear-all");
      const { total_deleted, results } = res.data;
      
      let successMsg = `Cancellati ${total_deleted} eventi totali.`;
      results.forEach((result: any) => {
        if (result.success) {
          successMsg += ` Studio ${result.studio}: ${result.deleted_count} eventi.`;
        } else {
          addLog(`Errore Studio ${result.studio}: ${result.error}`, "error");
        }
      });
      
      addLog(successMsg, "success");
      setSuccess(successMsg);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Errore nella cancellazione dei calendari";
      setError(errorMsg);
      addLog(errorMsg, "error");
    } finally {
      setClearingAll(false);
    }
  };

  const handleSyncAll = async () => {
    setShowSyncConfirm(false);
    setSyncingAll(true);
    addLog("Sincronizzazione di tutti i calendari...", "info");
    try {
      const res = await apiClient.post("/api/settings/calendar-sync/sync-all");
      const { total_synced, results, month } = res.data;
      
      let successMsg = `Sincronizzati ${total_synced} appuntamenti per ${month}.`;
      results.forEach((result: any) => {
        if (result.success) {
          successMsg += ` Studio ${result.studio}: ${result.synced_count} eventi.`;
        } else {
          addLog(`Errore Studio ${result.studio}: ${result.error}`, "error");
        }
      });
      
      addLog(successMsg, "success");
      setSuccess(successMsg);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Errore nella sincronizzazione dei calendari";
      setError(errorMsg);
      addLog(errorMsg, "error");
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <>
      <CCard className="mb-4">
        <CCardBody>
          <h5 className="mb-3">📅 Automazione Sincronizzazione Calendario</h5>
          
          {error && <CAlert color="danger">{error}</CAlert>}
          {success && <CAlert color="success">{success}</CAlert>}
          
          {loading ? (
            <CSpinner color="primary" />
          ) : (
            <>
              {/* Switch automazione attiva */}
              <CRow className="align-items-center mb-3">
                <CCol md={4} className="mb-2 mb-md-0">
                  <CFormLabel htmlFor="calendar-sync-switch">
                    Automazione attiva
                  </CFormLabel>
                  <CFormSwitch
                    id="calendar-sync-switch"
                    checked={enabled}
                    onChange={(e) => handleEnabledChange(e.target.checked)}
                    label={enabled ? "Attiva" : "Disattiva"}
                    className={enabled ? "toggle-success" : "toggle-secondary"}
                  />
                </CCol>
                <CCol md={4} className="mb-2 mb-md-0">
                  <CFormLabel>Orario sincronizzazione</CFormLabel>
                  <div className="d-flex gap-2 align-items-center">
                    <CFormSelect
                      value={hour}
                      onChange={(e) => setHour(Number(e.target.value))}
                      style={{ width: 80 }}
                      disabled={!enabled}
                    >
                      {HOURS.map((h) => (
                        <option key={h} value={h}>
                          {h.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </CFormSelect>
                    <span>:</span>
                    <CFormSelect
                      value={minute}
                      onChange={(e) => setMinute(Number(e.target.value))}
                      style={{ width: 80 }}
                      disabled={!enabled}
                    >
                      {MINUTES.map((m) => (
                        <option key={m} value={m}>
                          {m.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </CFormSelect>
                  </div>
                </CCol>
                <CCol md={4} className="d-flex align-items-end justify-content-end">
                  <CButton
                    color="primary"
                    onClick={handleSave}
                    disabled={saving || loading}
                  >
                    {saving ? <CSpinner size="sm" /> : "Salva Orario"}
                  </CButton>
                </CCol>
              </CRow>

              {/* Azioni rapide */}
              <CRow className="mt-4">
                <CCol md={12}>
                  <CFormLabel className="fw-semibold mb-2">Azioni Rapide:</CFormLabel>
                  <div className="d-flex gap-2 flex-wrap">
                    <CButton
                      color="success"
                      size="sm"
                      onClick={() => setShowSyncConfirm(true)}
                      disabled={syncingAll || clearingAll}
                    >
                      {syncingAll ? (
                        <>
                          <CSpinner size="sm" className="me-1" />
                          Sincronizzando...
                        </>
                      ) : (
                        "🔄 Sincronizza Tutti i Calendari"
                      )}
                    </CButton>
                    <CButton
                      color="danger"
                      size="sm"
                      onClick={() => setShowClearConfirm(true)}
                      disabled={syncingAll || clearingAll}
                    >
                      {clearingAll ? (
                        <>
                          <CSpinner size="sm" className="me-1" />
                          Cancellando...
                        </>
                      ) : (
                        "🗑️ Cancella Tutti i Calendari"
                      )}
                    </CButton>
                  </div>
                </CCol>
              </CRow>
            </>
          )}
          
          <div className="text-muted small mt-3">
            L'automazione sincronizza ogni giorno alle{" "}
            {hour.toString().padStart(2, "0")}:
            {minute.toString().padStart(2, "0")} gli appuntamenti di entrambi gli studi 
            sui rispettivi calendari Google (esclusi sabato e domenica).
            Sincronizza il mese corrente e il prossimo mese.
          </div>
        </CCardBody>
      </CCard>
      
      {/* Log delle azioni */}
      <CCard className="mt-2">
        <CCardBody
          style={{ maxHeight: 180, overflowY: "auto", fontSize: "0.95em" }}
        >
          <strong>Log azioni</strong>
          <ul className="mb-0" style={{ listStyle: "none", paddingLeft: 0 }}>
            {log.length === 0 && (
              <li className="text-muted">Nessuna azione recente</li>
            )}
            {log.map((entry, idx) => (
              <li
                key={idx}
                className={
                  entry.type === "success"
                    ? "text-success"
                    : entry.type === "error"
                    ? "text-danger"
                    : "text-secondary"
                }
              >
                <span style={{ fontSize: "0.85em", marginRight: 6 }}>
                  [{entry.timestamp.toLocaleTimeString()}]
                </span>
                {entry.message}
              </li>
            ))}
          </ul>
        </CCardBody>
      </CCard>

      {/* Modal di conferma sincronizzazione */}
      <CModal
        visible={showSyncConfirm}
        onClose={() => setShowSyncConfirm(false)}
        size="lg"
      >
        <CModalHeader>
          <h5>🔄 Conferma Sincronizzazione</h5>
        </CModalHeader>
        <CModalBody>
          <p>
            Sincronizzare <strong>tutti i calendari</strong> con gli appuntamenti del mese corrente?
          </p>
          <p>
            Questa operazione aggiornerà:
          </p>
          <ul>
            <li><strong>📘 Studio Blu</strong> - Calendario aziendale</li>
            <li><strong>📒 Studio Giallo</strong> - Calendario principale</li>
          </ul>
          <p className="text-muted">
            Gli appuntamenti verranno sincronizzati automaticamente sui rispettivi calendari Google.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => setShowSyncConfirm(false)}
          >
            Annulla
          </CButton>
          <CButton
            color="success"
            onClick={handleSyncAll}
            disabled={syncingAll}
          >
            {syncingAll ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Sincronizzando...
              </>
            ) : (
              "Conferma Sincronizzazione"
            )}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal di conferma cancellazione */}
      <CModal
        visible={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        size="lg"
      >
        <CModalHeader>
          <h5>🗑️ Conferma Cancellazione</h5>
        </CModalHeader>
        <CModalBody>
          <CAlert color="danger">
            <strong>⚠️ ATTENZIONE:</strong> Questa operazione non può essere annullata!
          </CAlert>
          <p>
            Sei sicuro di voler cancellare <strong>TUTTI gli eventi</strong> da entrambi i calendari?
          </p>
          <p>
            Verranno eliminati gli eventi da:
          </p>
          <ul>
            <li><strong>📘 Studio Blu</strong> - Tutti gli eventi presenti</li>
            <li><strong>📒 Studio Giallo</strong> - Tutti gli eventi presenti</li>
          </ul>
          <p className="text-danger fw-semibold">
            Questa azione eliminerà definitivamente tutti gli appuntamenti dai calendari Google.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => setShowClearConfirm(false)}
          >
            Annulla
          </CButton>
          <CButton
            color="danger"
            onClick={handleClearAll}
            disabled={clearingAll}
          >
            {clearingAll ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Cancellando...
              </>
            ) : (
              "Conferma Cancellazione"
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  );
};

export default AutomationCalendarSyncSettings;