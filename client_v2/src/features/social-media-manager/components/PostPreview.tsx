import React, { useState } from 'react';
import {
  CCard,
  CCardBody,
  CNav,
  CNavItem,
  CNavLink,
  CBadge,
} from '@coreui/react';
// import CIcon from '@coreui/icons-react';
// import { cibInstagram, cibFacebook } from '@coreui/icons';

interface PostPreviewProps {
  title: string;
  content: string;
  mediaUrls?: string[];
  hashtags?: string[];
  platforms: string[];
  accountLogos?: Record<string, string | null>; // { instagram: "url", facebook: "url" }
}

type PreviewPlatform = 'instagram' | 'facebook';

const PostPreview: React.FC<PostPreviewProps> = ({
  title,
  content,
  mediaUrls = [],
  hashtags = [],
  platforms,
  accountLogos = {},
}) => {
  // Default platform: primo selezionato o Instagram
  const defaultPlatform: PreviewPlatform =
    platforms.includes('instagram') ? 'instagram' :
      platforms.includes('facebook') ? 'facebook' : 'instagram';

  const [selectedPlatform, setSelectedPlatform] = useState<PreviewPlatform>(defaultPlatform);

  // Filtra solo piattaforme supportate per preview
  const previewablePlatforms = platforms.filter(p =>
    p === 'instagram' || p === 'facebook'
  );

  return (
    <div className="post-preview">
      <h6 className="mb-3">Anteprima Post</h6>

      {/* Tab selector */}
      {previewablePlatforms.length > 0 && (
        <CNav variant="tabs" className="mb-3">
          {previewablePlatforms.includes('instagram') && (
            <CNavItem>
              <CNavLink
                active={selectedPlatform === 'instagram'}
                onClick={() => setSelectedPlatform('instagram')}
                style={{ cursor: 'pointer' }}
              >
                📷 Instagram
              </CNavLink>
            </CNavItem>
          )}
          {previewablePlatforms.includes('facebook') && (
            <CNavItem>
              <CNavLink
                active={selectedPlatform === 'facebook'}
                onClick={() => setSelectedPlatform('facebook')}
                style={{ cursor: 'pointer' }}
              >
                👥 Facebook
              </CNavLink>
            </CNavItem>
          )}
        </CNav>
      )}

      {/* Preview Card */}
      <CCard className="shadow-sm">
        <CCardBody className="p-0">
          {selectedPlatform === 'instagram' ? (
            <InstagramPreview
              content={content}
              mediaUrls={mediaUrls}
              hashtags={hashtags}
              logoUrl={accountLogos['instagram']}
            />
          ) : (
            <FacebookPreview
              title={title}
              content={content}
              mediaUrls={mediaUrls}
              logoUrl={accountLogos['facebook']}
            />
          )}
        </CCardBody>
      </CCard>

      {/* Info message */}
      {previewablePlatforms.length === 0 && (
        <div className="text-muted small">
          Seleziona almeno una piattaforma (Instagram o Facebook) per visualizzare l'anteprima
        </div>
      )}
    </div>
  );
};

// Skeleton Shimmer Animation CSS
const shimmerStyle = `
@keyframes shimmer {
  0% {
    background-position: -468px 0;
  }
  100% {
    background-position: 468px 0;
  }
}

.skeleton-shimmer {
  animation: shimmer 1.5s infinite linear;
  background: linear-gradient(
    to right,
    #e0e0e0 0%,
    #f0f0f0 20%,
    #e0e0e0 40%,
    #e0e0e0 100%
  );
  background-size: 800px 100px;
}
`;

// Inject shimmer styles
if (typeof document !== 'undefined' && !document.getElementById('skeleton-shimmer-styles')) {
  const style = document.createElement('style');
  style.id = 'skeleton-shimmer-styles';
  style.textContent = shimmerStyle;
  document.head.appendChild(style);
}

// Image Skeleton Component - Facebook style
const ImageSkeleton = () => (
  <div
    className="d-flex align-items-center justify-content-center w-100"
    style={{
      height: '300px',
      backgroundColor: '#e4e6eb',
      borderRadius: '0',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      className="skeleton-shimmer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.6,
      }}
    />
    <svg
      width="80"
      height="80"
      viewBox="0 0 164 164"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'relative', zIndex: 1 }}
    >
      <rect width="164" height="164" rx="2" fill="#b0b3b8" fillOpacity="0.3" />
      <path
        d="M40 134C40 128.477 44.4772 124 50 124H114C119.523 124 124 128.477 124 134V134C124 139.523 119.523 144 114 144H50C44.4772 144 40 139.523 40 134V134Z"
        fill="#b0b3b8"
      />
      <circle cx="82" cy="82" r="20" fill="#b0b3b8" />
      <path
        d="M100 100L124 76V136C124 140.418 120.418 144 116 144H68L100 100Z"
        fill="#b0b3b8"
      />
      <circle cx="120" cy="44" r="8" fill="#b0b3b8" />
    </svg>
  </div>
);

// Instagram Preview Component
const InstagramPreview: React.FC<{
  content: string;
  mediaUrls: string[];
  hashtags: string[];
  logoUrl?: string | null;
}> = ({ content, mediaUrls, hashtags, logoUrl }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const isEmpty = !content && mediaUrls.length === 0 && hashtags.length === 0;

  const displayHashtags =
    hashtags.length > 0
      ? (content ? '\n\n' : '') + hashtags.map(h => `#${h}`).join(' ')
      : '';

  return (
    <div className="instagram-preview">
      {/* Header */}
      <div className="d-flex align-items-center p-3 border-bottom">
        <div
          className="rounded-circle d-flex align-items-center justify-content-center"
          style={{
            width: '32px',
            height: '32px',
            background: logoUrl
              ? '#ffffff'
              : 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)',
            overflow: 'hidden',
            border: logoUrl ? '1px solid #dbdbdb' : 'none',
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Profile"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : null}
        </div>
        <div className="ms-2">
          <strong className="d-block" style={{ fontSize: '14px' }}>
            studio_dentistico_di_martino
          </strong>
        </div>
      </div>

      {/* Media */}
      {mediaUrls.length > 0 ? (
        <div
          className="position-relative bg-light d-flex align-items-center justify-content-center"
          style={{
            height: '300px',
            borderBottom: '1px solid #dbdbdb',
          }}
        >
          {!imageLoaded && <ImageSkeleton />}

          <img
            src={mediaUrls[0]}
            alt="Post media"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              display: imageLoaded ? 'block' : 'none',
            }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(false)}
          />
        </div>
      ) : (
        <ImageSkeleton />
      )}

      {/* Content */}
      <div className="p-3">
        {isEmpty ? (
          <>
            <SkeletonLine width="100%" />
            <SkeletonLine width="80%" />
            <SkeletonLine width="50%" height="10px" />
          </>
        ) : (
          <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>
            <strong>studio_dima</strong> {content}
            {displayHashtags}
          </div>
        )}
      </div>
    </div>
  );
};

// Text Skeleton Line Component
const SkeletonLine: React.FC<{ width?: string; height?: string }> = ({
  width = '100%',
  height = '12px',
}) => (
  <div
    className="skeleton-shimmer mb-2"
    style={{
      width,
      height,
      borderRadius: '4px',
      backgroundColor: '#e4e6eb',
    }}
  />
);

// Facebook Preview Component
const FacebookPreview: React.FC<{
  title: string;
  content: string;
  mediaUrls: string[];
  logoUrl?: string | null;
}> = ({ title, content, mediaUrls, logoUrl }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const isEmpty = !title && !content && mediaUrls.length === 0;

  return (
    <div className="facebook-preview">
      {/* Header */}
      <div className="d-flex align-items-center p-3">
        <div
          className="rounded-circle"
          style={{
            width: '40px',
            height: '40px',
            backgroundColor: logoUrl ? '#ffffff' : '#1877f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            overflow: 'hidden',
            border: logoUrl ? '1px solid #e4e6eb' : 'none',
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Profile"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            'SD'
          )}
        </div>
        <div className="ms-2">
          <strong className="d-block" style={{ fontSize: '15px' }}>
            Studio Dentistico Di Martino Nicola
          </strong>
          <small className="text-muted">Adesso</small>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-2">
        {isEmpty ? (
          <>
            <SkeletonLine width="60%" height="14px" />
            <SkeletonLine width="90%" />
            <SkeletonLine width="75%" />
          </>
        ) : (
          <>
            {title && (
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                {title}
              </div>
            )}
            {content && (
              <div style={{ fontSize: '15px', whiteSpace: 'pre-wrap' }}>
                {content}
              </div>
            )}
          </>
        )}
      </div>

      {/* Media */}
      {mediaUrls.length > 0 ? (
        <div
          className="bg-light d-flex align-items-center justify-content-center position-relative"
          style={{ height: '350px' }}
        >
          {!imageLoaded && <ImageSkeleton />}
          <img
            src={mediaUrls[0]}
            alt="Post media"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'cover',
              display: imageLoaded ? 'block' : 'none',
            }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(false)}
          />
        </div>
      ) : (
        <ImageSkeleton />
      )}

      {/* Actions placeholder */}
      <div className="d-flex gap-3 px-3 py-2 border-top text-muted" style={{ fontSize: '14px' }}>
        <span>👍 Mi piace</span>
        <span>💬 Commento</span>
        <span>↗️ Condividi</span>
      </div>
    </div>
  );
};

export default PostPreview;
