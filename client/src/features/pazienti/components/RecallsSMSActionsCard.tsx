import {
  CCard,
  CCardBody,
  CFormCheck,
  CButton,
  CSpinner,
} from "@coreui/react";
import { CIcon } from "@coreui/icons-react";
import { cilPhone } from "@coreui/icons";

const RecallsSMSActionsCard = ({
  isSMSEnabled,
  patientsWithPhone,
  allWithPhoneSelected,
  selectedPatients,
  handleSelectAll,
  bulkLoading,
  handleBulkSMS,
}: any) =>
  isSMSEnabled &&
  patientsWithPhone.length > 0 && (
    <CCard>
      <CCardBody className="d-flex align-items-center justify-content-around">
        <div className="d-flex align-items-center">
          <CIcon icon={cilPhone} size="xl" className="text-primary me-3" />
          <div>
            <div className="fs-5 fw-semibold text-primary">
              {patientsWithPhone.length}
            </div>
            <div className="text-muted text-uppercase fw-semibold small">
              con telefono
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center">
          <div>
            <div className="text-muted text-uppercase fw-semibold small">
              <div>
                <CFormCheck
                  id="select-all"
                  checked={allWithPhoneSelected}
                  indeterminate={
                    selectedPatients.size > 0 && !allWithPhoneSelected
                  }
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  label={`Seleziona tutti (${patientsWithPhone.length})`}
                />
              </div>
              <div className="text-muted text-uppercase fw-semibold small">
                <CButton
                  color="primary"
                  size="sm"
                  disabled={selectedPatients.size === 0 || bulkLoading}
                  onClick={handleBulkSMS}
                >
                  {bulkLoading ? (
                    <>
                      <CSpinner size="sm" className="me-2" />
                      Invio...
                    </>
                  ) : (
                    `📤 Invia SMS (${selectedPatients.size})`
                  )}
                </CButton>
              </div>
            </div>
          </div>
        </div>
      </CCardBody>
    </CCard>
  );

export default RecallsSMSActionsCard;
