/**
 * LogoUploader Component
 * Componente per upload del logo di un account social
 */

import React, { useState, useRef, useEffect } from 'react';
import { CButton, CSpinner, CFormLabel } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCloudUpload, cilX } from '@coreui/icons';
import apiClient from '@/services/api/client';
import toast from 'react-hot-toast';

interface LogoUploaderProps {
  currentLogoUrl?: string;
  accountId: number;
  accountName: string;
  onLogoChange: (logoUrl: string | null) => void;
}

const LogoUploader: React.FC<LogoUploaderProps> = ({
  currentLogoUrl,
  accountId,
  accountName,
  onLogoChange,
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sincronizza previewUrl quando currentLogoUrl cambia (es. dopo caricamento store)
  useEffect(() => {
    setPreviewUrl(currentLogoUrl || null);
  }, [currentLogoUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validazione tipo file
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato non supportato. Usa PNG, JPG, GIF o WEBP');
      return;
    }

    // Validazione dimensione (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File troppo grande. Max 5MB');
      return;
    }

    setUploading(true);

    try {
      // Upload del file
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await apiClient.post('/social-media/upload-media', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (uploadResponse.data.success) {
        const logoUrl = uploadResponse.data.data.url;
        setPreviewUrl(logoUrl);
        onLogoChange(logoUrl);
        toast.success('Logo caricato con successo');
      } else {
        toast.error(uploadResponse.data.error || 'Errore nel caricamento');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error || 'Errore nel caricamento del logo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    setPreviewUrl(null);
    onLogoChange(null);
    toast.success('Logo rimosso');
  };

  return (
    <div className="logo-uploader mb-3">
      <CFormLabel>Logo Account</CFormLabel>

      <div className="d-flex align-items-start gap-3">
        {/* Preview Logo */}
        <div
          className="border rounded d-flex align-items-center justify-content-center"
          style={{
            width: '80px',
            height: '80px',
            backgroundColor: '#f8f9fa',
            position: 'relative',
          }}
        >
          {previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt={accountName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
              <CButton
                color="danger"
                size="sm"
                className="position-absolute"
                style={{ top: '-8px', right: '-8px', borderRadius: '50%', padding: '2px 6px' }}
                onClick={handleRemoveLogo}
                disabled={uploading}
              >
                <CIcon icon={cilX} size="sm" />
              </CButton>
            </>
          ) : (
            <span className="text-muted small">No logo</span>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex-grow-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpg,image/jpeg,image/gif,image/webp"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          <CButton
            color="secondary"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            size="sm"
          >
            {uploading ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Caricamento...
              </>
            ) : (
              <>
                <CIcon icon={cilCloudUpload} className="me-2" />
                Carica Logo
              </>
            )}
          </CButton>

          <div className="text-muted small mt-1">
            PNG, JPG, GIF o WEBP - Max 5MB
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoUploader;
