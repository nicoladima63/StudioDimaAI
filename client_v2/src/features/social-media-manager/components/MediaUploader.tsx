/**
 * MediaUploader Component
 * Supporta sia URL esterni che upload di file locali
 */

import React, { useState, useRef } from 'react';
import {
  CFormInput,
  CFormLabel,
  CButton,
  CSpinner,
  CCard,
  CCardBody,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCloudUpload, cilX, cilLink } from '@coreui/icons';
import toast from 'react-hot-toast';
import apiClient from '@/services/api/client';

interface MediaUploaderProps {
  /**
   * Array di URL media correnti
   */
  mediaUrls: string[];

  /**
   * Callback quando le URL cambiano
   */
  onChange: (urls: string[]) => void;

  /**
   * Max numero di file (default: 4)
   */
  maxFiles?: number;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({
  mediaUrls = [],
  onChange,
  maxFiles = 4,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Aggiungi URL manuale
  const handleAddUrl = () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      toast.error('Inserisci un URL valido');
      return;
    }

    if (mediaUrls.length >= maxFiles) {
      toast.error(`Puoi aggiungere massimo ${maxFiles} media`);
      return;
    }

    if (mediaUrls.includes(trimmedUrl)) {
      toast.error('URL già presente');
      return;
    }

    onChange([...mediaUrls, trimmedUrl]);
    setUrlInput('');
    toast.success('URL aggiunto');
  };

  // Rimuovi URL
  const handleRemoveUrl = (url: string) => {
    onChange(mediaUrls.filter(u => u !== url));
    toast.success('Media rimosso');
  };

  // Upload file
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (mediaUrls.length + files.length > maxFiles) {
      toast.error(`Puoi caricare massimo ${maxFiles} file`);
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post('/social-media/upload-media', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.success) {
          return response.data.data.url;
        } else {
          throw new Error(response.data.error || 'Upload fallito');
        }
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      onChange([...mediaUrls, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} file caricati con successo`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error || error.message || 'Errore durante l\'upload');
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Drag & Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Click sul file input
  const handleFileInputClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="media-uploader">

      {/* File Upload Area */}
      <div
        className={`border rounded p-3 mb-3 text-center ${dragActive ? 'border-primary bg-light' : 'border-secondary'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{ cursor: 'pointer', minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={handleFileInputClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFileUpload(e.target.files)}
        />

        {uploading ? (
          <div>
            <CSpinner size="sm" className="me-2" />
            <span>Upload in corso...</span>
          </div>
        ) : (
          <div>
            <CIcon icon={cilCloudUpload} size="xl" className="mb-2 text-secondary" />
            <div>
              <strong>Trascina file qui</strong> oppure <CButton variant="outline" className="text-primary">clicca per selezionare</CButton>
            </div>
            <small className="text-muted">
              Formati supportati: PNG, JPG, GIF, WEBP, MP4, MOV (max 50MB)
            </small>
          </div>
        )}
      </div>

      {/* Preview Media caricati */}
      {mediaUrls.length > 0 && (
        <div className="mb-2">
          <small className="text-muted d-block mb-2">
            Media caricati ({mediaUrls.length}/{maxFiles}):
          </small>
          <div className="d-flex flex-wrap gap-2">
            {mediaUrls.map((url, index) => (
              <CCard key={index} style={{ width: '120px', position: 'relative' }}>
                <CButton
                  color="danger"
                  size="sm"
                  className="position-absolute top-0 end-0 m-1"
                  style={{ zIndex: 10, padding: '2px 6px' }}
                  onClick={() => handleRemoveUrl(url)}
                >
                  <CIcon icon={cilX} size="sm" />
                </CButton>
                <CCardBody className="p-1">
                  <img
                    src={url}
                    alt={`Media ${index + 1}`}
                    style={{
                      width: '100%',
                      height: '80px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                    }}
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </CCardBody>
              </CCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaUploader;
