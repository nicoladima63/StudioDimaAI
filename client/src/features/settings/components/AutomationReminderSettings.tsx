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
} from "@coreui/react";
import apiClient from "@/api/client";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const AutomationReminderSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(true);
  const [hour, setHour] = useState(15);
  const [minute, setMinute] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [log, setLog] = useState<
    { message: string; type: "info" | "success" | "error"; timestamp: Date }[]
  >([]);
  const [smsMode, setSmsMode] = useState<"prod" | "test">("prod");
  const [smsModeLoading, setSmsModeLoading] = useState(true);
  const [smsModeSaving, setSmsModeSaving] = useState(false);

  const addLog = (
    message: string,
    type: "info" | "success" | "error" = "info"
  ) => {
    setLog((prev) =>
      [{ message, type, timestamp: new Date() }, ...prev].slice(0, 10)
    );
  };

  // Carica impostazioni e modalità SMS promemoria
  useEffect(() => {
    fetchSettings();
    fetchSmsMode();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    addLog("Caricamento impostazioni...", "info");
    try {
      const res = await apiClient.get("/api/settings/appointment-reminder");
      setEnabled(res.data.reminder_enabled ?? true);
      setHour(res.data.reminder_hour ?? 15);
      setMinute(res.data.reminder_minute ?? 0);
      addLog("Impostazioni caricate con successo", "success");
    } catch {
      setError("Errore nel recupero delle impostazioni");
      addLog("Errore nel recupero delle impostazioni", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSmsMode = async () => {
    setSmsModeLoading(true);
    try {
      const res = await apiClient.get("/api/settings/sms-promemoria-mode");
      setSmsMode(res.data.mode ?? "prod");
    } catch {
      addLog("Errore nel recupero modalità SMS promemoria", "error");
    } finally {
      setSmsModeLoading(false);
    }
  };

  const handleSmsModeChange = async (mode: "prod" | "test") => {
    setSmsModeSaving(true);
    try {
      await apiClient.post("/api/settings/sms-promemoria-mode", { mode });
      setSmsMode(mode);
      addLog(`Modalità SMS promemoria impostata su ${mode}`, "success");
    } catch {
      addLog("Errore nel salvataggio modalità SMS promemoria", "error");
    } finally {
      setSmsModeSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    addLog("Salvataggio impostazioni in corso...", "info");
    try {
      await apiClient.post("/api/settings/appointment-reminder", {
        reminder_enabled: enabled,
        reminder_hour: hour,
        reminder_minute: minute,
      });
      setSuccess("Impostazioni salvate con successo!");
      addLog("Impostazioni salvate con successo", "success");
    } catch {
      setError("Errore nel salvataggio delle impostazioni");
      addLog("Errore nel salvataggio delle impostazioni", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CCard className="mb-4">
        <CCardBody>
          <h5 className="mb-3">Automazione Promemoria Appuntamenti</h5>
          {/* Switch modalità SMS promemoria */}
          <div className="mb-3 d-flex align-items-center gap-3">
            <CFormLabel className="mb-0">Modalità SMS promemoria:</CFormLabel>
            <CFormSwitch
              id="sms-mode-switch"
              checked={smsMode === "prod"}
              onChange={(e) =>
                handleSmsModeChange(e.target.checked ? "prod" : "test")
              }
              disabled={smsModeLoading || smsModeSaving}
              label={smsMode === "prod" ? "Produzione" : "Test"}
              className={
                smsMode === "prod" ? "toggle-warning" : "toggle-success"
              }
            />
            {smsModeLoading && <CSpinner size="sm" />}
          </div>
          {error && <CAlert color="danger">{error}</CAlert>}
          {success && <CAlert color="success">{success}</CAlert>}
          {loading ? (
            <CSpinner color="primary" />
          ) : (
            <>
              {/* Switch automazione attiva */}
              <CRow className="align-items-center mb-3">
                <CCol md={4} className="mb-2 mb-md-0">
                  <CFormLabel htmlFor="reminder-switch">
                    Automazione attiva
                  </CFormLabel>
                  <CFormSwitch
                    id="reminder-switch"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    label={enabled ? "Attiva" : "Disattiva"}
                    className={
                      enabled
                        ? smsMode === "prod"
                          ? "toggle-warning"
                          : "toggle-success"
                        : "toggle-secondary"
                    }
                  />
                </CCol>
                <CCol md={4} className="mb-2 mb-md-0">
                  <CFormLabel>Orario invio</CFormLabel>
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
                <CCol
                  md={4}
                  className="d-flex align-items-end justify-content-end"
                >
                  <CButton
                    color="primary"
                    onClick={handleSave}
                    disabled={saving || loading}
                  >
                    {saving ? <CSpinner size="sm" /> : "Salva"}
                  </CButton>
                </CCol>
              </CRow>
            </>
          )}
          <div className="text-muted small mt-2">
            L’automazione invia ogni giorno alle{" "}
            {hour.toString().padStart(2, "0")}:
            {minute.toString().padStart(2, "0")} un SMS di promemoria per gli
            appuntamenti del giorno successivo (esclusi sabato e domenica).
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
    </>
  );
};

export default AutomationReminderSettings;
