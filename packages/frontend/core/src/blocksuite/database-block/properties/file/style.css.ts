import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const filePopoverContainer = style({
  padding: '4px',
  minWidth: '320px',
  maxWidth: '480px',
});

export const filePopoverContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
});

export const loadingContainer = style({
  textAlign: 'center',
  padding: '8px',
});

export const loadingWrapper = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  justifyContent: 'center',
});

export const loadingSpinner = style({
  width: '20px',
  height: '20px',
  border: '2px solid #f3f3f3',
  borderTop: '2px solid #2196f3',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
});

export const uploadButton = style({
  width: '100%',
  fontSize: '16px',
});

export const fileInfoContainer = style({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '14px',
  gap: '8px',
  overflow: 'hidden',
});

export const fileSizeInfo = style({
  color: cssVarV2('text/secondary'),
});

export const upgradeLink = style({
  color: '#1E96F0',
  textDecoration: 'none',
  fontWeight: 500,
  whiteSpace: 'nowrap',
});

export const fileListTitle = style({
  color: 'var(--affine-text-secondary-color)',
  fontSize: '14px',
  lineHeight: '22px',
  marginBottom: '4px',
  marginTop: '8px',
  padding: '0 12px',
  borderBottom: 'none',
});

export const fileListContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '8px 0',
  border: 'none',
});

export const fileItem = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  border: 'none',
  padding: '2px 12px',
  position: 'relative',
  ':hover': {
    background: '#f5f5f5',
  },
});

export const fileItemContent = style({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '8px 0',
  border: 'none',
  borderBottom: 'none',
});

export const fileIcon = style({
  flexShrink: 0,
  width: '16px',
  height: '16px',
  color: cssVarV2('text/secondary'),
});

export const fileName = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '14px',
});

export const menuButton = style({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '4px',
  borderRadius: '4px',
  cursor: 'pointer',
  color: cssVarV2('text/secondary'),
  ':hover': {
    backgroundColor: '#f5f5f5',
  },
  zIndex: 100,
});

export const addFileButton = style({
  display: 'flex',
  alignItems: 'center',
  color: '#1E96F0',
  fontSize: '14px',
  gap: '6px',
  cursor: 'pointer',
});

export const cellContainer = style({
  width: '100%',
  position: 'relative',
});

export const fileListCell = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  width: '100%',
  alignItems: 'center',
  padding: '2px 0',
});

export const fileItemCell = style({
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
  height: '24px',
});

export const fileImagePreview = style({
  width: '24px',
  height: '24px',
  borderRadius: '4px',
  objectFit: 'cover',
  border: 'none',
});

export const fileImagePreviewInPopover = style({
  width: '36px',
  height: '36px',
  borderRadius: '4px',
  objectFit: 'cover',
  border: `1px solid #e0e0e0`,
});

export const fileInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  overflow: 'hidden',
  flex: 1,
});

export const fileCardName = style({
  fontSize: '12px',
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  padding: '2px 6px',
  height: '24px',
  lineHeight: '20px',
  maxWidth: '100px',
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '4px',
  border: 'none',
  background: 'transparent',
});

export const fileImageLoading = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#666',
  fontSize: '12px',
  padding: '8px',
  background: '#f5f5f5',
});
