import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const multiMemberSelectContainer = style({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  gap: '8px',
});

export const memberInputContainer = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  padding: '8px 12px',
  borderRadius: '8px',
  backgroundColor: cssVarV2.layer.background.secondary,
  minHeight: '40px',
  alignItems: 'center',
});

export const memberSearchInput = style({
  flex: '1',
  minWidth: '100px',
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  fontSize: '14px',
  lineHeight: '22px',
});

export const memberListContainer = style({
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '300px',
  overflow: 'auto',
  borderRadius: '8px',
  backgroundColor: cssVarV2.layer.background.secondary,
});

export const memberDeleteIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  backgroundColor: cssVarV2.layer.background.tertiary,
  color: cssVarV2.text.secondary,
  fontSize: '10px',
  cursor: 'pointer',
  ':hover': {
    backgroundColor: cssVarV2.layer.background.tertiary,
    color: cssVarV2.text.primary,
  },
});
