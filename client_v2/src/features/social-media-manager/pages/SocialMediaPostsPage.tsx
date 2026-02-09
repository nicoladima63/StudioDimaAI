/**
 * SocialMediaPostsPage - MVP Phase 1
 * Pagina dedicata per la gestione dei posts social
 */

import React, { useState } from 'react';
import {
  CRow,
  CCol,
  CButton
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus } from '@coreui/icons';
import PostList from '../components/PostList';
import PostComposer from '../components/PostComposer';
import type { Post } from '../types';

const SocialMediaPostsPage: React.FC = () => {
  const [showComposer, setShowComposer] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const handleNewPost = () => {
    setEditingPost(null);
    setShowComposer(true);
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setShowComposer(true);
  };

  const handleCloseComposer = () => {
    setShowComposer(false);
    setEditingPost(null);
  };

  return (
    <div className="social-media-posts">
      {/* Header con bottone nuovo post */}
      <CRow className="mb-3">
        <CCol>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-0">Posts Social Media</h2>
              <p className="text-muted mb-0">Gestisci i tuoi contenuti social</p>
            </div>
            <CButton
              color="primary"
              onClick={handleNewPost}
            >
              <CIcon icon={cilPlus} className="me-2" />
              Nuovo Post
            </CButton>
          </div>
        </CCol>
      </CRow>

      {/* Post List */}
      <CRow>
        <CCol>
          <PostList onEdit={handleEditPost} />
        </CCol>
      </CRow>

      {/* Post Composer Modal */}
      <PostComposer
        visible={showComposer}
        onClose={handleCloseComposer}
        editPost={editingPost}
      />
    </div>
  );
};

export default SocialMediaPostsPage;
