import React, { useState, useEffect } from "react";
import {
  CCard,
  CCardBody,
  CCardHeader,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CButton,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CAlert,
  CSpinner,
  CBadge,
  CButtonGroup,
} from "@coreui/react";
import CIcon from "@coreui/icons-react";
import { cilPlus, cilPencil, cilTrash, cilSave, cilX } from "@coreui/icons";
import apiClient from "@/api/client";

import ContiTable from './ContiTable'
//import BrancheTable, { Branca } from './BrancheTable'
//import SottocontiTable, { Sottoconto } from './SottocontiTable'
export interface Conto {
  id: number;
  nome: string;
}

export interface Branca {
  id: number;
  contoid: number;
  nome: string;
  conto_nome?: string;
}

export interface Sottoconto {
  id: number;
  contoid: number;
  brancaid: number;
  nome: string;
  conto_nome?: string;
  branca_nome?: string;
}

const CrudStrutturaConti: React.FC = () => {
  const [activeTab, setActiveTab] = useState("conti");

  // Stati dati
  const [conti, setConti] = useState<Conto[]>([]);
  const [branche, setBranche] = useState<Branca[]>([]);
  const [sottoconti, setSottoconti] = useState<Sottoconto[]>([]);

  // Stati UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning,setWarning]=useState("");
  const [success, setSuccess] = useState("");

  // Modal stati
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"create" | "edit">("create");
  const [modalEntity, setModalEntity] = useState<
    "conto" | "branca" | "sottoconto"
  >("conto");
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form stati
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    caricaDati();
  }, []);

  const caricaDati = async () => {
    try {
      setLoading(true);
      setError("");

      const [contiRes, brancheRes, sottocontiRes] = await Promise.all([
        apiClient.get("/api/struttura-conti/conti"),
        apiClient.get("/api/struttura-conti/branche"),
        apiClient.get("/api/struttura-conti/sottoconti"),
      ]);

      if (contiRes.data.success) setConti(contiRes.data.data);
      if (brancheRes.data.success) setBranche(brancheRes.data.data);
      if (sottocontiRes.data.success) setSottoconti(sottocontiRes.data.data);
    } catch (error: any) {
      setError(`Errore caricamento dati: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = (entity: "conto" | "branca" | "sottoconto") => {
    setModalType("create");
    setModalEntity(entity);
    setEditingItem(null);
    setFormData({});
    setShowModal(true);
  };

  const handleEdit = (entity: "conto" | "branca" | "sottoconto", item: any) => {
    setModalType("edit");
    setModalEntity(entity);
    setEditingItem(item);
    setFormData({ ...item });
    setShowModal(true);
  };

  const handleDelete = async (
    entity: "conto" | "branca" | "sottoconto",
    id: number
  ) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo elemento?")) return;
    try {
      setLoading(true);
      const response = await apiClient.delete(
        `/api/struttura-conti/${entity}${
          entity === "conto"
            ? ""
            : entity === "branca"
            ? "branche"
            : "sottoconti"
        }/${id}`
      );

      if (response.data.success) {
        setSuccess(response.data.message);
        await caricaDati();
      } else {
        setError(response.data.error);
      }
    } catch (error: any) {
      setError(
        `Errore eliminazione: ${error.response?.data?.error || error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      let endpoint = "";
      let method = modalType === "create" ? "post" : "put";
      let url = `/api/struttura-conti/`;

      switch (modalEntity) {
        case "conto":
          url += modalType === "create" ? "conti" : `conti/${editingItem?.id}`;
          break;
        case "branca":
          url +=
            modalType === "create" ? "branche" : `branche/${editingItem?.id}`;
          break;
        case "sottoconto":
          url +=
            modalType === "create"
              ? "sottoconti"
              : `sottoconti/${editingItem?.id}`;
          break;
      }

      const response = await apiClient[method](url, formData);

      if (response.data.success) {
        setSuccess(response.data.message);
        setShowModal(false);
        await caricaDati();
      } else {
        setError(response.data.error);
      }
    } catch (error: any) {
      setError(
        `Errore salvataggio: ${error.response?.data?.error || error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  // CRUD funzioni per conti
  const addConto = async (newItem: Partial<Conto>) => {
    try {
      setLoading(true)
      const res = await apiClient.post('/api/struttura-conti/conti', newItem)
      if (res.data.success) {
        setSuccess(res.data.message)
        await caricaDati()
      } else setError(res.data.error || 'Errore creazione conto')
    } catch (err: any) {
      setError(err.message || 'Errore creazione conto')
    } finally {
      setLoading(false)
    }
  }

  const editConto = async (updated: Conto) => {
    try {
      setLoading(true)
      const res = await apiClient.put(`/api/struttura-conti/conti/${updated.id}`, updated)
      if (res.data.success) {
        setSuccess(res.data.message)
        await caricaDati()
      } else setError(res.data.error || 'Errore modifica conto')
    } catch (err: any) {
      setError(err.message || 'Errore modifica conto')
    } finally {
      setLoading(false)
    }
  }

  const deleteConto = async (item: Conto) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo conto?')) return
    try {
      setLoading(true)
      const res = await apiClient.delete(`/api/struttura-conti/conti/${item.id}`)
      if (res.data.success) {
        setSuccess(res.data.message)
        await caricaDati()
      } else setError(res.data.error || 'Errore eliminazione conto')
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Errore eliminazione conto')
    } finally {
      setLoading(false)
    }
  }

  // CRUD funzioni per branche
  const addBranca = async (newItem: Partial<Branca>) => {
    try {
      setLoading(true)
      const res = await apiClient.post('/api/struttura-conti/branche', newItem)
      if (res.data.success) {
        setSuccess(res.data.message)
        await caricaDati()
      } else setError(res.data.error || 'Errore creazione branca')
    } catch (err: any) {
      setError(err.message || 'Errore creazione branca')
    } finally {
      setLoading(false)
    }
  }

  const editBranca = async (updated: Branca) => {
    try {
      setLoading(true)
      const res = await apiClient.put(`/api/struttura-conti/branche/${updated.id}`, updated)
      if (res.data.success) {
        setSuccess(res.data.message)
        await caricaDati()
      } else setError(res.data.error || 'Errore modifica branca')
    } catch (err: any) {
      setError(err.message || 'Errore modifica branca')
    } finally {
      setLoading(false)
    }
  }

  const deleteBranca = async (item: Branca) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa branca?')) return
    try {
      setLoading(true)
      const res = await apiClient.delete(`/api/struttura-conti/branche/${item.id}`)
      if (res.data.success) {
        setSuccess(res.data.message)
        await caricaDati()
      } else setError(res.data.error || 'Errore eliminazione branca')
    } catch (err: any) {
      setError(err.message || 'Errore eliminazione branca')
    } finally {
      setLoading(false)
    }
  }

  // CRUD funzioni per sottoconti
  const addSottoconto = async (newItem: Partial<Sottoconto>) => {
    try {
      setLoading(true)
      const res = await apiClient.post('/api/struttura-conti/sottoconti', newItem)
      if (res.data.success) {
        setSuccess(res.data.message)
        await caricaDati()
      } else setError(res.data.error || 'Errore creazione sottoconto')
    } catch (err: any) {
      setError(err.message || 'Errore creazione sottoconto')
    } finally {
      setLoading(false)
    }
  }

  const editSottoconto = async (updated: Sottoconto) => {
    try {
      setLoading(true)
      const res = await apiClient.put(`/api/struttura-conti/sottoconti/${updated.id}`, updated)
      if (res.data.success) {
        setSuccess(res.data.message)
        await caricaDati()
      } else setError(res.data.error || 'Errore modifica sottoconto')
    } catch (err: any) {
      setError(err.message || 'Errore modifica sottoconto')
    } finally {
      setLoading(false)
    }
  }

  const deleteSottoconto = async (item: Sottoconto) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo sottoconto?')) return
    try {
      setLoading(true)
      const res = await apiClient.delete(`/api/struttura-conti/sottoconti/${item.id}`)
      if (res.data.success) {
        setSuccess(res.data.message)
        await caricaDati()
      } else setError(res.data.error || 'Errore eliminazione sottoconto')
    } catch (err: any) {
      setError(err.message || 'Errore eliminazione sottoconto')
    } finally {
      setLoading(false)
    }
  }



  const renderContiTab = () => (
    <CTabPane visible={activeTab === "conti"}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6>Gestione Conti ({conti.length})</h6>
        <CButton color="primary" onClick={() => handleCreate("conto")}>
          <CIcon icon={cilPlus} className="me-1" />
          Nuovo Conto
        </CButton>
      </div>

      <CTable striped hover responsive>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>ID</CTableHeaderCell>
            <CTableHeaderCell>Nome</CTableHeaderCell>
            <CTableHeaderCell>Azioni</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {conti.map((conto) => (
            <CTableRow key={conto.id}>
              <CTableDataCell>{conto.id}</CTableDataCell>
              <CTableDataCell>
                <strong>{conto.nome}</strong>
              </CTableDataCell>
              <CTableDataCell>
                <CButtonGroup size="sm">
                  <CButton
                    color="warning"
                    variant="outline"
                    onClick={() => handleEdit("conto", conto)}
                  >
                    <CIcon icon={cilPencil} />
                  </CButton>
                  <CButton
                    color="danger"
                    variant="outline"
                    onClick={() => handleDelete("conto", conto.id)}
                  >
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CButtonGroup>
              </CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
    </CTabPane>
  );

  const renderBrancheTab = () => (
    <CTabPane visible={activeTab === "branche"}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6>Gestione Branche ({branche.length})</h6>
        <CButton color="success" onClick={() => handleCreate("branca")}>
          <CIcon icon={cilPlus} className="me-1" />
          Nuova Branca
        </CButton>
      </div>

      <CTable striped hover responsive>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>ID</CTableHeaderCell>
            <CTableHeaderCell>Conto</CTableHeaderCell>
            <CTableHeaderCell>Nome Branca</CTableHeaderCell>
            <CTableHeaderCell>Azioni</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {branche.map((branca) => (
            <CTableRow key={branca.id}>
              <CTableDataCell>{branca.id}</CTableDataCell>
              <CTableDataCell>
                <CBadge color="primary">{branca.conto_nome}</CBadge>
              </CTableDataCell>
              <CTableDataCell>
                <strong>{branca.nome}</strong>
              </CTableDataCell>
              <CTableDataCell>
                <CButtonGroup size="sm">
                  <CButton
                    color="warning"
                    variant="outline"
                    onClick={() => handleEdit("branca", branca)}
                  >
                    <CIcon icon={cilPencil} />
                  </CButton>
                  <CButton
                    color="danger"
                    variant="outline"
                    onClick={() => handleDelete("branca", branca.id)}
                  >
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CButtonGroup>
              </CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
    </CTabPane>
  );

  const renderSottocontiTab = () => (
    <CTabPane visible={activeTab === "sottoconti"}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6>Gestione Sottoconti ({sottoconti.length})</h6>
        <CButton color="info" onClick={() => handleCreate("sottoconto")}>
          <CIcon icon={cilPlus} className="me-1" />
          Nuovo Sottoconto
        </CButton>
      </div>

      <CTable striped hover responsive>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>ID</CTableHeaderCell>
            <CTableHeaderCell>Conto</CTableHeaderCell>
            <CTableHeaderCell>Branca</CTableHeaderCell>
            <CTableHeaderCell>Nome Sottoconto</CTableHeaderCell>
            <CTableHeaderCell>Azioni</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {sottoconti.map((sottoconto) => (
            <CTableRow key={sottoconto.id}>
              <CTableDataCell>{sottoconto.id}</CTableDataCell>
              <CTableDataCell>
                <CBadge color="primary" className="small">
                  {sottoconto.conto_nome}
                </CBadge>
              </CTableDataCell>
              <CTableDataCell>
                <CBadge color="success" className="small">
                  {sottoconto.branca_nome}
                </CBadge>
              </CTableDataCell>
              <CTableDataCell>
                <strong>{sottoconto.nome}</strong>
              </CTableDataCell>
              <CTableDataCell>
                <CButtonGroup size="sm">
                  <CButton
                    color="warning"
                    variant="outline"
                    onClick={() => handleEdit("sottoconto", sottoconto)}
                  >
                    <CIcon icon={cilPencil} />
                  </CButton>
                  <CButton
                    color="danger"
                    variant="outline"
                    onClick={() => handleDelete("sottoconto", sottoconto.id)}
                  >
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CButtonGroup>
              </CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
    </CTabPane>
  );

  const renderSmartTab = () => (
    <CTabPane visible={activeTab === "smart"}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6>Gestione Conti Smart</h6>
      </div>

      <ContiTable
        conti={conti}
        onAdd={addConto}
        onEdit={editConto}
        onDelete={deleteConto}
        branche={branche}
        onAddBranca={addBranca}
        onEditBranca={editBranca}
        onDeleteBranca={deleteBranca}
        sottoconti={sottoconti}
        onAddSottoconto={addSottoconto}
        onEditSottoconto={editSottoconto}
        onDeleteSottoconto={deleteSottoconto}
      />
    </CTabPane>
  );

  const renderModal = () => {
    const isCreate = modalType === "create";
    const title = `${isCreate ? "Nuovo" : "Modifica"} ${
      modalEntity === "conto"
        ? "Conto"
        : modalEntity === "branca"
        ? "Branca"
        : "Sottoconto"
    }`;

    return (
      <CModal visible={showModal} onClose={() => setShowModal(false)}>
        <CModalHeader>
          <CModalTitle>{title}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            {modalEntity === "branca" && (
              <div className="mb-3">
                <CFormLabel>Conto</CFormLabel>
                <CFormSelect
                  value={formData.contoid || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contoid: parseInt(e.target.value),
                    })
                  }
                  required
                >
                  <option value="">Seleziona Conto</option>
                  {conti.map((conto) => (
                    <option key={conto.id} value={conto.id}>
                      {conto.nome}
                    </option>
                  ))}
                </CFormSelect>
              </div>
            )}

            {modalEntity === "sottoconto" && (
              <div className="mb-3">
                <CFormLabel>Branca</CFormLabel>
                <CFormSelect
                  value={formData.brancaid || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      brancaid: parseInt(e.target.value),
                    })
                  }
                  required
                >
                  <option value="">Seleziona Branca</option>
                  {branche.map((branca) => (
                    <option key={branca.id} value={branca.id}>
                      {branca.conto_nome} → {branca.nome}
                    </option>
                  ))}
                </CFormSelect>
              </div>
            )}

            <div className="mb-3">
              <CFormLabel>Nome</CFormLabel>
              <CFormInput
                type="text"
                value={formData.nome || ""}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                placeholder={`Nome ${modalEntity}...`}
                required
              />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowModal(false)}>
            <CIcon icon={cilX} className="me-1" />
            Annulla
          </CButton>
          <CButton color="primary" onClick={handleSave} disabled={loading}>
            {loading && <CSpinner size="sm" className="me-1" />}
            <CIcon icon={cilSave} className="me-1" />
            Salva
          </CButton>
        </CModalFooter>
      </CModal>
    );
  };

  return (
    <CCard>
      <CCardHeader>
        <h5 className="mb-0">🔧 CRUD Struttura Conti</h5>
        <small className="text-muted">
          Gestione completa di Conti, Branche e Sottoconti
        </small>
      </CCardHeader>

      <CCardBody>
      {error && (
          <CAlert color="danger" dismissible onClose={() => setError("")}>
            {error}
          </CAlert>
        )}
        {warning && (
          <CAlert color="warning" dismissible onClose={() => setWarning("")}>
            {warning}
          </CAlert>
        )}

        {success && (
          <CAlert color="success" dismissible onClose={() => setSuccess("")}>
            {success}
          </CAlert>
        )}

        {loading && (
          <div className="text-center p-3">
            <CSpinner color="primary" />
          </div>
        )}

        {/* Tabs Navigation */}
        <CNav variant="tabs" className="mb-4">
          <CNavItem>
            <CNavLink
              active={activeTab === "conti"}
              onClick={() => setActiveTab("conti")}
              style={{ cursor: "pointer" }}
            >
              📋 Conti ({conti.length})
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === "branche"}
              onClick={() => setActiveTab("branche")}
              style={{ cursor: "pointer" }}
            >
              🌿 Branche ({branche.length})
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === "sottoconti"}
              onClick={() => setActiveTab("sottoconti")}
              style={{ cursor: "pointer" }}
            >
              📁 Sottoconti ({sottoconti.length})
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === "smart"}
              onClick={() => setActiveTab("smart")}
              style={{ cursor: "pointer" }}
            >
              📁 SMART Tab
            </CNavLink>
          </CNavItem>
        </CNav>

        {/* Tab Content */}
        <CTabContent>
          {renderContiTab()}
          {renderBrancheTab()}
          {renderSottocontiTab()}
          {renderSmartTab()}
        </CTabContent>

        {/* Modal */}
        {renderModal()}
      </CCardBody>
    </CCard>
  );
};

export default CrudStrutturaConti;
