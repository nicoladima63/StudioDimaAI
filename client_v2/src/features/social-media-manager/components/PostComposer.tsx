/**
 * PostComposer Component - MVP Phase 1
 * Modal per creare/editare posts (versione semplificata MVP)
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  CFormCheck,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilX } from '@coreui/icons';
import { useSocialMediaStore } from '@/store/socialMedia.store';
import CategorySelector from './CategorySelector';
import TemplateSelector from './TemplateSelector';
import PostPreview from './PostPreview';
import MediaUploader from './MediaUploader';
import HashtagsInput from './HashtagsInput';
import toast from 'react-hot-toast';
import type { Post } from '../types';

interface PostComposerProps {
  visible: boolean;
  onClose: () => void;
  editPost?: Post | null;
  postId?: number | null;
}

const PostComposer: React.FC<PostComposerProps> = ({ visible, onClose, editPost: editPostProp, postId }) => {
  const { createPost, updatePost, isLoading, posts, loadPostById, accounts, loadAccounts, invalidateCache } = useSocialMediaStore();
  const [fetchedPost, setFetchedPost] = useState<Post | null>(null);

  const editPost = editPostProp || fetchedPost;

  // Load accounts when modal opens (to get fresh data including logos)
  useEffect(() => {
    if (visible) {
      // Invalida la cache per forzare il reload dal server
      invalidateCache('accounts');
      loadAccounts();
    }
  }, [visible, loadAccounts, invalidateCache]);

  // Build account logos map - recalculate when accounts change
  const accountLogos = useMemo(() => {
    return accounts.reduce((acc, account) => {
      acc[account.platform] = account.logo_url || null;
      return acc;
    }, {} as Record<string, string | null>);
  }, [accounts]);

  useEffect(() => {
    if (postId && !editPostProp) {
      const found = posts.find(p => p.id === postId);
      if (found) {
        setFetchedPost(found);
      } else {
        loadPostById(postId).then(post => {
          if (post) setFetchedPost(post);
        });
      }
    } else if (!postId && !editPostProp) {
      setFetchedPost(null);
    }
  }, [postId, editPostProp, posts, loadPostById]);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category_id: null as number | null,
    content_type: 'post',
    platforms: [] as string[],
    hashtags: [] as string[],
    media_urls: [] as string[]
  });

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

  // Handler per applicare template
  const handleTemplateApply = (templateContent: string, templateName: string) => {
    setFormData(prev => ({
      ...prev,
      content: templateContent,
      title: prev.title || templateName, // Usa template name se title vuoto
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
      size="xl"
      backdrop="static"
    >
      <CModalHeader>
        <CModalTitle>
          {editPost ? 'Modifica Post' : 'Nuovo Post'}
        </CModalTitle>
      </CModalHeader>

      <CModalBody>
        <CRow>
          {/* Colonna Sinistra: Form */}
          <CCol md={7}>
            <CForm>

              <CCard className='mb-2'>
                <CCardHeader className='fw-bold'>Pubblica su</CCardHeader>
                <CCardBody>
                  {/* Piattaforme */}
                  <div className="mb-3">
                    <div className="d-flex gap-3 justify-content-between">
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
                </CCardBody>
              </CCard>
              <CCard className='mb-2'>
                <CCardHeader className='fw-bold'>Contenuti multimediali</CCardHeader>
                <CCardBody>
                  {/* Media Uploader */}
                  <div className="mb-3">
                    <MediaUploader
                      mediaUrls={formData.media_urls}
                      onChange={(urls) => setFormData(prev => ({ ...prev, media_urls: urls }))}
                      maxFiles={4}
                    />
                  </div>

                  {/* Tipo Contenuto (hidden per MVP, sempre 'post') */}
                  <input type="hidden" value={formData.content_type} />

                </CCardBody>
              </CCard>

              <CCard className='mb-2'>
                <CCardHeader className='fw-bold'>Dettagli del post</CCardHeader>
                <CCardBody>
                  <div className="d-flex justify-content-between gap-3">
                    {/* Categoria */}
                    <div className="mb-2 w-50">
                      <CFormLabel className="form-text text-body-secondary small">Categoria</CFormLabel>
                      <CategorySelector
                        value={formData.category_id}
                        onChange={(categoryId) => setFormData(prev => ({ ...prev, category_id: categoryId }))}
                      />
                    </div>

                    {/* Template Selector */}
                    <div className="mb-2 w-50">
                      <CFormLabel className="form-text text-body-secondary small">Template</CFormLabel>
                      <TemplateSelector
                        templateType="social"
                        categoryId={formData.category_id}
                        onTemplateApply={handleTemplateApply}
                      />
                    </div>
                  </div>
                  {/* Titolo */}
                  <div className="mb-2">
                    <CFormLabel className="form-text text-body-secondary small" htmlFor="post-title">Titolo *</CFormLabel>
                    <CFormInput
                      type="text"
                      id="post-title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="-- titolo del post --"
                      required
                    />
                  </div>


                  {/* Contenuto */}
                  <div className="mb-2">
                    <CFormLabel className="form-text text-body-secondary small" htmlFor="post-content">Contenuto *</CFormLabel>
                    <CFormTextarea
                      id="post-content"
                      rows={6}
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="-- contenuto del post --"
                      required
                    />
                  </div>

                  {/* Hashtags */}
                  <div className="mb-2">
                    <CFormLabel className="form-text text-body-secondary small">Hashtags</CFormLabel>
                    <HashtagsInput
                      hashtags={formData.hashtags}
                      onChange={(hashtags) => setFormData(prev => ({ ...prev, hashtags }))}
                      maxHashtags={30}
                    />
                  </div>
                </CCardBody>
              </CCard>

              <CCard>
                <CCardHeader className='fw-bold'>Opzioni di programmazione (opzionale)</CCardHeader>
                <CCardBody>
                  {/* Schedulazione Separata */}
                  <div className="mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <div className="flex-grow-1">
                        <CFormInput
                          type="date"
                          id="post-scheduled-date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          placeholder="-- Data --"
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

                </CCardBody>
              </CCard>


            </CForm>
          </CCol>

          {/* Colonna Destra: Preview */}
          <CCol md={5}>
            <PostPreview
              title={formData.title}
              content={formData.content}
              mediaUrls={formData.media_urls}
              hashtags={formData.hashtags}
              platforms={formData.platforms}
              accountLogos={accountLogos}
            />
          </CCol>
        </CRow>
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
