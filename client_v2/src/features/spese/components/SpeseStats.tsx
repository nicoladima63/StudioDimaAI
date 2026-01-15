import React, { useEffect, useState } from "react";
import { CRow, CCol, CCard, CCardBody, CWidgetStatsA } from "@coreui/react";
import { speseFornitioriService } from "../services/spese.service";
import { FiltriSpese } from "../types";

interface SpeseStatsProps {
    filtri: FiltriSpese;
}

const SpeseStats: React.FC<SpeseStatsProps> = ({ filtri }) => {
    const [stats, setStats] = useState({
        total_costo: 0,
        total_iva: 0,
        total_grand: 0,
        count: 0,
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const response = await speseFornitioriService.getStats(filtri);
                if (response.success) {
                    setStats(response.data);
                }
            } catch (error) {
                console.error("Error loading stats:", error);
            } finally {
                setLoading(false);
            }
        };

        // Debounce to avoid too many calls
        const timer = setTimeout(() => {
            fetchStats();
        }, 300);

        return () => clearTimeout(timer);
    }, [filtri]);

    return (
        <CRow className="mb-4">
            <CCol sm={3}>
                <CCard className="text-white bg-primary">
                    <CCardBody>
                        <div className="text-medium-emphasis text-white fs-6">Imponibile</div>
                        <div className="fs-4 fw-bold">
                            {loading ? "..." : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(stats.total_costo)}
                        </div>
                    </CCardBody>
                </CCard>
            </CCol>
            <CCol sm={3}>
                <CCard className="text-white bg-info">
                    <CCardBody>
                        <div className="text-medium-emphasis text-white fs-6">IVA</div>
                        <div className="fs-4 fw-bold">
                            {loading ? "..." : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(stats.total_iva)}
                        </div>
                    </CCardBody>
                </CCard>
            </CCol>
            <CCol sm={3}>
                <CCard className="text-white bg-success">
                    <CCardBody>
                        <div className="text-medium-emphasis text-white fs-6">Totale</div>
                        <div className="fs-4 fw-bold">
                            {loading ? "..." : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(stats.total_grand)}
                        </div>
                    </CCardBody>
                </CCard>
            </CCol>
            <CCol sm={3}>
                <CCard className="text-white bg-warn"> {/* bg-warn might not exist in standard coreui, use bg-warming or style */}
                    <CCardBody style={{ backgroundColor: "#f9b115" }}>
                        <div className="text-medium-emphasis text-white fs-6">Numero Fatture</div>
                        <div className="fs-4 fw-bold text-white">
                            {loading ? "..." : stats.count}
                        </div>
                    </CCardBody>
                </CCard>
            </CCol>
        </CRow>
    );
};

export default SpeseStats;
