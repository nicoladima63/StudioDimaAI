/**
 * PostComposer Component - MVP Phase 1
 * Modal per creare/editare posts (versione semplificata MVP)
 */

import React, { useState, useEffect } from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CForm,
  CFormInput,
  CFormTextarea,
  CFormLabel,
  CSpinner,
  CFormCheck
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilX } from '@coreui/icons';
import { useSocialMediaStore } from '@/store/socialMedia.store';
import CategorySelector from './CategorySelector';
import toast from 'react-hot-toast';
import type { Post } from '../types';

interface PostComposerProps {
  visible: boolean;
  onClose: () => void;
  editPost?: Post | null;
}

const PostComposer: React.FC<PostComposerProps> = ({ visible, onClose, editPost }) => {
  const { createPost, updatePost, isLoading } = useSocialMediaStore();

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category_id: null as number | null,
    content_type: 'post',
    platforms: [] as string[],
    hashtags: [] as string[],
    media_urls: [] as string[]
  });

  const [hashtagsInput, setHashtagsInput] = useState('');

  // Gestione separata date e time
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (editPost) {
      setFormData({
        title: editPost.title,
        content: editPost.content,
        category_id: editPost.category_id || null,
        content_type: editPost.content_type,
        platforms: editPost.platforms || [],
        hashtags: editPost.hashtags || [],
        media_urls: editPost.media_urls || []
      });
      setHashtagsInput(editPost.hashtags?.join(', ') || '');

      if (editPost.scheduled_at) {
        try {
          const dateObj = new Date(editPost.scheduled_at);
          // Adjust to local time
          const offset = dateObj.getTimezoneOffset() * 60000;
          const localDate = new Date(dateObj.getTime() - offset);

          setScheduledDate(localDate.toISOString().slice(0, 10)); // YYYY-MM-DD
          setScheduledTime(localDate.toISOString().slice(11, 16)); // HH:MM
        } catch (e) {
          setScheduledDate('');
          setScheduledTime('');
        }
      } else {
        setScheduledDate('');
        setScheduledTime('');
      }

    } else {
      // Reset form
      setFormData({
        title: '',
        content: '',
        category_id: null,
        content_type: 'post',
        platforms: [],
        hashtags: [],
        media_urls: []
      });
      setHashtagsInput('');
      setScheduledDate('');
      setScheduledTime('');
    }
  }, [editPost, visible]);

  const handlePlatformToggle = (platform: string) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
    }));
  };

  const clearScheduling = () => {
    setScheduledDate('');
    setScheduledTime('');
  };

  const handleSave = async () => {
    // Validazione
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Titolo e contenuto sono obbligatori');
      return;
    }

    try {
      // Parse hashtags
      const hashtags = hashtagsInput
        .split(',')
        .map(h => h.trim())
        .filter(h => h.length > 0);

      // Gestione schedulazione
      let scheduled_at = null;
      let status = 'draft';

      if (scheduledDate) {
        // Se c'è la data, l'ora è opzionale (default 09:00 se manca)
        const timeToUse = scheduledTime || '09:00';
        const dateTimeString = `${scheduledDate}T${timeToUse}:00`;
        try {
          const dateObj = new Date(dateTimeString);
          if (!isNaN(dateObj.getTime())) {
            scheduled_at = dateObj.toISOString();
            status = 'scheduled';
          }
        } catch (e) {
          console.error("Invalid date:", dateTimeString);
        }
      }

      const postData = {
        ...formData,
        hashtags,
        scheduled_at,
        status
      };

      if (editPost) {
        await updatePost(editPost.id, postData);
        toast.success(status === 'scheduled' ? 'Post schedulato con successo' : 'Post aggiornato con successo');
      } else {
        await createPost(postData);
        toast.success(status === 'scheduled' ? 'Post schedulato con successo' : 'Post creato con successo');
      }

      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Errore nel salvataggio');
    }
  };

  return (
    <CModal
      visible={visible}
      onClose={onClose}
      size="lg"
      backdrop="static"
    >
      <CModalHeader>
        <CModalTitle>
          {editPost ? 'Modifica Post' : 'Nuovo Post'}
        </CModalTitle>
      </CModalHeader>

      <CModalBody>
        <CForm>
          {/* Titolo */}
          <div className="mb-3">
            <CFormLabel htmlFor="post-title">Titolo *</CFormLabel>
            <CFormInput
              type="text"
              id="post-title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Inserisci il titolo del post"
              required
            />
          </div>

          {/* Categoria */}
          <div className="mb-3">
            <CFormLabel htmlFor="post-category">Categoria</CFormLabel>
            <CategorySelector
              value={formData.category_id}
              onChange={(categoryId) => setFormData(prev => ({ ...prev, category_id: categoryId }))}
            />
          </div>

          {/* Contenuto */}
          <div className="mb-3">
            <CFormLabel htmlFor="post-content">Contenuto *</CFormLabel>
            <CFormTextarea
              id="post-content"
              rows={6}
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Scrivi il contenuto del post..."
              required
            />
          </div>

          {/* Schedulazione Separata */}
          <div className="mb-3">
            <CFormLabel>Programma Pubblicazione (Opzionale)</CFormLabel>
            <div className="d-flex align-items-center gap-2">
              <div className="flex-grow-1">
                <CFormInput
                  type="date"
                  id="post-scheduled-date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  placeholder="Data"
                />
              </div>
              <div style={{ width: '130px' }}>
                <CFormInput
                  type="time"
                  id="post-scheduled-time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  placeholder="Ora"
                  disabled={!scheduledDate}
                />
              </div>
              {(scheduledDate || scheduledTime) && (
                <CButton
                  color="danger"
                  variant="ghost"
                  onClick={clearScheduling}
                  title="Rimuovi pianificazione"
                  className="px-2"
                >
                  <CIcon icon={cilX} />
                </CButton>
              )}
            </div>
            <small className="text-muted">
              Seleziona una data per programmare. L'ora è opzionale (default 09:00).
            </small>
          </div>

          {/* Piattaforme */}
          <div className="mb-3">
            <CFormLabel>Piattaforme</CFormLabel>
            <div className="d-flex gap-3">
              <CFormCheck
                id="platform-instagram"
                label="Instagram"
                checked={formData.platforms.includes('instagram')}
                onChange={() => handlePlatformToggle('instagram')}
              />
              <CFormCheck
                id="platform-facebook"
                label="Facebook"
                checked={formData.platforms.includes('facebook')}
                onChange={() => handlePlatformToggle('facebook')}
              />
              <CFormCheck
                id="platform-linkedin"
                label="LinkedIn"
                checked={formData.platforms.includes('linkedin')}
                onChange={() => handlePlatformToggle('linkedin')}
              />
              <CFormCheck
                id="platform-tiktok"
                label="TikTok"
                checked={formData.platforms.includes('tiktok')}
                onChange={() => handlePlatformToggle('tiktok')}
              />
            </div>
          </div>

          {/* Hashtags */}
          <div className="mb-3">
            <CFormLabel htmlFor="post-hashtags">Hashtags (separati da virgola)</CFormLabel>
            <CFormInput
              type="text"
              id="post-hashtags"
              value={hashtagsInput}
              onChange={(e) => setHashtagsInput(e.target.value)}
              placeholder="es: #dental, #odontoiatria, #salute"
            />
            <small className="text-muted">
              Inserisci gli hashtags separati da virgola
            </small>
          </div>

          {/* Tipo Contenuto (hidden per MVP, sempre 'post') */}
          <input type="hidden" value={formData.content_type} />
        </CForm>
      </CModalBody>

      <CModalFooter>
        <CButton color="secondary" onClick={onClose} disabled={isLoading}>
          Annulla
        </CButton>
        <CButton color="primary" onClick={handleSave} disabled={isLoading}>
          {isLoading ? (
            <>
              <CSpinner size="sm" className="me-2" />
              Salvataggio...
            </>
          ) : (
            scheduledDate ? 'Schedula Post' : 'Salva Bozza'
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

export default PostComposer;
