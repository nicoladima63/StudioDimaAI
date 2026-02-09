/**
 * PostList Component - MVP Phase 1
 * Tabella con lista posts, filtri e paginazione
 */

import React, { useEffect, useState } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
  CButton,
  CSpinner,
  CPagination,
  CPaginationItem,
  CFormInput,
  CFormSelect,
  CRow,
  CCol
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPencil, cilTrash, cilReload, cilCloudUpload } from '@coreui/icons';
import { useSocialMediaStore } from '@/store/socialMedia.store';
import apiClient from '@/services/api/client';
import toast from 'react-hot-toast';
import type { Post } from '../types';
import { getPlatformColor, getPlatformAbbr } from '../constants/socialPlatforms';

interface PostListProps {
  onEdit: (post: Post) => void;
}

const PostList: React.FC<PostListProps> = ({ onEdit }) => {
  const {
    posts,
    isLoadingPosts,
    currentPage,
    totalPages,
    filters,
    categories,
    loadPosts,
    loadCategories,
    deletePost,
    setFilters,
    clearFilters
  } = useSocialMediaStore();

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCategories();
    loadPosts();
  }, []);

  const handleSearch = () => {
    setFilters({ search: searchTerm });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    clearFilters();
  };

  const handleDelete = async (post: Post) => {
    if (!window.confirm(`Sei sicuro di voler eliminare il post "${post.title}"?`)) {
      return;
    }

    try {
      await deletePost(post.id);
      toast.success('Post eliminato');
    } catch (error: any) {
      toast.error(error.message || 'Errore nell\'eliminazione');
    }
  };

  const handlePublish = async (post: Post) => {
    if (post.status === 'published') {
      toast('Post già pubblicato');
      return;
    }

    if (!window.confirm(`Pubblicare "${post.title}" su tutte le piattaforme selezionate?`)) {
      return;
    }

    try {
      const response = await apiClient.post(`/social-media/posts/${post.id}/publish`);
      const result = response.data;

      if (result.success) {
        toast.success(result.message || 'Post pubblicato con successo!');
        loadPosts(); // Reload to update status
      } else {
        toast.error(result.error || 'Errore durante la pubblicazione');
      }
    } catch (error: any) {
      console.error('Publish error:', error);
      toast.error(error.response?.data?.error || 'Errore durante la pubblicazione');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'secondary',
      scheduled: 'warning',
      published: 'success',
      failed: 'danger'
    };

    const labels: Record<string, string> = {
      draft: 'Bozza',
      scheduled: 'Schedulato',
      published: 'Pubblicato',
      failed: 'Fallito'
    };

    return (
      <CBadge color={colors[status] || 'secondary'}>
        {labels[status] || status}
      </CBadge>
    );
  };

  const getCategoryName = (categoryId?: number) => {
    if (!categoryId) return '-';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || '-';
  };

  const getPlatformBadges = (platforms: string[]) => {
    if (!platforms || platforms.length === 0) return '-';

    return (
      <div className="d-flex gap-1 flex-wrap">
        {platforms.map(platform => (
          <CBadge
            key={platform}
            className="text-capitalize"
            style={{
              backgroundColor: getPlatformColor(platform),
              color: '#fff'
            }}
          >
            {platform}
          </CBadge>
        ))}
      </div>
    );
  };

  const handlePageChange = (page: number) => {
    loadPosts({ page });
  };

  return (
    <CCard>
      <CCardHeader>
        <strong>Lista Posts</strong>
      </CCardHeader>
      <CCardBody>
        {/* Filtri */}
        <CRow className="mb-3">
          <CCol md={4}>
            <CFormInput
              type="text"
              placeholder="Cerca per titolo o contenuto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </CCol>
          <CCol md={3}>
            <CFormSelect
              value={filters.status || ''}
              onChange={(e) => setFilters({ status: e.target.value || undefined } as any)}
            >
              <option value="">Tutti gli stati</option>
              <option value="draft">Bozza</option>
              <option value="scheduled">Schedulato</option>
              <option value="published">Pubblicato</option>
              <option value="failed">Fallito</option>
            </CFormSelect>
          </CCol>
          <CCol md={3}>
            <CFormSelect
              value={filters.category_id || ''}
              onChange={(e) => setFilters({ category_id: e.target.value ? Number(e.target.value) : undefined } as any)}
            >
              <option value="">Tutte le categorie</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={2} className="d-flex gap-2">
            <CButton color="primary" onClick={handleSearch}>
              Cerca
            </CButton>
            <CButton
              color="secondary"
              variant="outline"
              onClick={handleClearFilters}
              title="Pulisci filtri"
            >
              <CIcon icon={cilReload} />
            </CButton>
          </CCol>
        </CRow>

        {/* Tabella */}
        {isLoadingPosts ? (
          <div className="text-center py-5">
            <CSpinner color="primary" />
            <p className="mt-2 text-muted">Caricamento posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <p>Nessun post trovato</p>
            <small>Crea il tuo primo post per iniziare!</small>
          </div>
        ) : (
          <>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Titolo</CTableHeaderCell>
                  <CTableHeaderCell>Categoria</CTableHeaderCell>
                  <CTableHeaderCell>Piattaforme</CTableHeaderCell>
                  <CTableHeaderCell>Stato</CTableHeaderCell>
                  <CTableHeaderCell>Data Creazione</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Azioni</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {posts.map(post => (
                  <CTableRow key={post.id}>
                    <CTableDataCell>
                      <strong>{post.title}</strong>
                      <br />
                      <small className="text-muted">
                        {post.content.substring(0, 60)}
                        {post.content.length > 60 && '...'}
                      </small>
                    </CTableDataCell>
                    <CTableDataCell>{getCategoryName(post.category_id)}</CTableDataCell>
                    <CTableDataCell>{getPlatformBadges(post.platforms)}</CTableDataCell>
                    <CTableDataCell>{getStatusBadge(post.status)}</CTableDataCell>
                    <CTableDataCell>
                      {new Date(post.created_at!).toLocaleDateString('it-IT')}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      <div className="d-flex gap-1 justify-content-end">
                        <CButton
                          size="sm"
                          color="primary"
                          variant="ghost"
                          onClick={() => onEdit(post)}
                          title="Modifica"
                        >
                          <CIcon icon={cilPencil} />
                        </CButton>
                        <CButton
                          size="sm"
                          color="success"
                          variant="ghost"
                          onClick={() => handlePublish(post)}
                          disabled={post.status === 'published'}
                          title="Pubblica ora"
                        >
                          <CIcon icon={cilCloudUpload} />
                        </CButton>
                        <CButton
                          size="sm"
                          color="danger"
                          variant="ghost"
                          onClick={() => handleDelete(post)}
                          title="Elimina"
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>

            {/* Paginazione */}
            {totalPages > 1 && (
              <div className="d-flex justify-content-center mt-3">
                <CPagination>
                  <CPaginationItem
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    Precedente
                  </CPaginationItem>

                  {[...Array(totalPages)].map((_, i) => (
                    <CPaginationItem
                      key={i + 1}
                      active={currentPage === i + 1}
                      onClick={() => handlePageChange(i + 1)}
                    >
                      {i + 1}
                    </CPaginationItem>
                  ))}

                  <CPaginationItem
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    Successivo
                  </CPaginationItem>
                </CPagination>
              </div>
            )}
          </>
        )}
      </CCardBody>
    </CCard>
  );
};

export default PostList;
