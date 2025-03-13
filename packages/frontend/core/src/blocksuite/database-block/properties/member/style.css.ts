import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const memberPopoverContainer = style({
  padding: '8px 0 0 0',
  width: '415px',
});

export const memberPopoverContent = style({
  padding: '0',
});

export const searchContainer = style({
  padding: '12px 12px 8px 12px',
});

export const searchInput = style({
  width: '100%',
});

export const memberInfoContainer = style({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '14px',
  gap: '8px',
  overflow: 'hidden',
});

export const memberListContainer = style({
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '300px',
  overflow: 'auto',
});

export const memberItem = style({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '4px 8px',
  gap: '8px',
  overflow: 'hidden',
  cursor: 'pointer',
  ':hover': {
    backgroundColor: cssVarV2.layer.background.hoverOverlay,
  },
});

export const memberItemContent = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  overflow: 'hidden',
});

export const memberName = style({
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

export const memberItemCell = style({
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
  height: '24px',
  backgroundColor: cssVarV2.database.attachment.fileSolidBackground,
  padding: '1px 4px',
  borderRadius: '2px',
  gap: '4px',
});

export const avatar = style({
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: cssVarV2.layer.background.tertiary,
  fontSize: '10px',
  color: cssVarV2.text.primary,
});

export const avatarImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const memberNameCell = style({
  fontSize: '14px',
  lineHeight: '22px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const loadingContainer = style({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '16px',
});

export const noResultContainer = style({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '16px',
  color: cssVarV2.text.secondary,
});

export const memberPreviewContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  overflow: 'hidden',
});
