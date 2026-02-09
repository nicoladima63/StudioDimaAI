/**
 * SocialMediaCalendarPage - Phase 2
 * Pagina calendario per visualizzare e gestire posts schedulati
 */

import React, { useState } from 'react';
import { CRow, CCol } from '@coreui/react';
import CalendarView from '../components/CalendarView';
import PostComposer from '../components/PostComposer';

const SocialMediaCalendarPage: React.FC = () => {
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);

  // Gestisci edit post da calendario
  const handleEditPost = (postId: number) => {
    setEditingPostId(postId);
    setShowPostComposer(true);
  };

  // Gestisci delete post da calendario
  const handleDeletePost = async (postId: number) => {
    // TODO: Implementare conferma e chiamata API delete
    console.log('Delete post:', postId);
  };

  // Gestisci chiusura composer
  const handleCloseComposer = () => {
    setShowPostComposer(false);
    setEditingPostId(null);
  };

  return (
    <div className="social-media-calendar">
      {/* Header */}
      <CRow className="mb-3">
        <CCol>
          <h2 className="mb-0">Calendario Pubblicazioni</h2>
          <p className="text-muted mb-0">
            Visualizza e gestisci i post schedulati. Trascina gli eventi per modificare la data.
          </p>
        </CCol>
      </CRow>

      {/* Calendar */}
      <CRow>
        <CCol xs={12}>
          <CalendarView
            onEditPost={handleEditPost}
            onDeletePost={handleDeletePost}
          />
        </CCol>
      </CRow>

      {/* Post Composer Modal */}
      {showPostComposer && (
        <PostComposer
          visible={showPostComposer}
          onClose={handleCloseComposer}
          postId={editingPostId}
        />
      )}
    </div>
  );
};

export default SocialMediaCalendarPage;
