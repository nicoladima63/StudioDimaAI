export { default as EditModal } from './EditModal';
export { default as ConfirmDeleteModal } from './ConfirmDeleteModal';
export { default as DetailViewModal } from './DetailViewModal';
export { default as ModalAnagrafica } from './ModalAnagrafica';
export { default as ModalFattureElenco } from './ModalFattureElenco';
export { default as ModalFatturaDetail } from './ModalFatturaDetail';

// Export dei tipi per TypeScript
export type { EditModalProps, EditModalField } from './EditModal';
export type { ConfirmDeleteModalProps } from './ConfirmDeleteModal';
export type { DetailViewModalProps, DetailViewField, DetailViewSection } from './DetailViewModal';
export type { ModalAnagraficaProps, CampoAnagrafica } from './ModalAnagrafica';
export type { ModalFattureElencoProps, FatturaBase, DettaglioFatturaBase } from './ModalFattureElenco';
export type { ModalFatturaDetailProps, FatturaDetail, DettaglioRigaFattura } from './ModalFatturaDetail';