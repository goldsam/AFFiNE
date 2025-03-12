import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const filePopoverContainer = style({
  padding: '8px 0 0 0',
  width: '415px',
});

export const filePopoverContent = style({
  padding: '0',
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

export const fileListContainer = style({
  display: 'flex',
  flexDirection: 'column',
});

export const fileItem = style({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '4px 8px',
  gap: '8px',
  overflow: 'hidden',
});

export const fileItemContent = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  overflow: 'hidden',
});

export const fileName = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '14px',
});

export const menuButton = style({
  display: 'flex',
  height: '20px',
  width: '20px',
  flexShrink: 0,
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: '2px',
  cursor: 'pointer',
  color: cssVarV2.icon.primary,
  ':hover': {
    backgroundColor: cssVarV2.layer.background.hoverOverlay,
  },
});

export const cellContainer = style({
  width: '100%',
  position: 'relative',
  gap: '6px',
  display: 'flex',
  flexWrap: 'wrap',
  overflow: 'hidden',
});

export const fileItemCell = style({
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
  height: '24px',
});

export const fileItemImagePreview = style({
  height: '136px',
  borderRadius: '2px',
});

export const progressIconContainer = style({
  position: 'relative',
  width: '24px',
  height: '24px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});

export const progressSvg = style({
  transform: 'rotate(-90deg)',
});

export const progressCircle = style({
  transition: 'stroke-dasharray 0.3s ease-in-out',
});

export const imagePreviewIcon = style({
  borderRadius: '2px',
  height: '100%',
});

export const filePreviewContainer = style({
  width: '100%',
  height: '100%',
  backgroundColor: cssVarV2.database.attachment.fileSolidBackground,
  padding: '1px 4px',
  fontSize: '14px',
  lineHeight: '22px',
  borderRadius: '2px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const imagePreviewContainer = style({
  height: '24px',
  borderRadius: '2px',
  border: 'none',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const uploadContainer = style({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 16px',
  borderTop: '1px solid',
  borderColor: cssVarV2.layer.insideBorder.border,
});

export const uploadButtonStyle = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '4px',
  cursor: 'pointer',
});

export const uploadPopoverContainer = style({
  padding: '12px',
  width: '415px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
});

export const fileNameStyle = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
