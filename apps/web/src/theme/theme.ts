import { alpha, createTheme, type Shadows } from '@mui/material/styles';
import {
  blue,
  brand,
  colors,
  focusRing,
  navy,
  purple,
  radii,
  shadows,
  slate,
  spacingUnit,
  status,
  transitions,
  typography,
  zIndex,
} from './tokens';

declare module '@mui/material/styles' {
  interface Palette {
    neutral: Palette['primary'];
    navy: typeof navy;
    slate: typeof slate;
  }
  interface PaletteOptions {
    neutral?: PaletteOptions['primary'];
    navy?: typeof navy;
    slate?: typeof slate;
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    neutral: true;
  }
}

declare module '@mui/material/IconButton' {
  interface IconButtonPropsColorOverrides {
    neutral: true;
  }
}

const s = typography.scale;
const px = (n: number) => `${n}px`;

/** MUI expects 25 elevation levels. We only use a handful, mapped onto our token shadows. */
const elevation: Shadows = [
  'none',
  shadows.xs,
  shadows.sm,
  shadows.sm,
  shadows.md,
  shadows.md,
  shadows.md,
  shadows.md,
  shadows.lg,
  ...Array<string>(16).fill(shadows.lg),
] as Shadows;

const focusVisible = {
  outline: focusRing.outline,
  outlineOffset: focusRing.offset,
};

export const theme = createTheme({
  spacing: spacingUnit,
  shape: { borderRadius: radii.md },
  zIndex,
  shadows: elevation,
  palette: {
    mode: 'light',
    primary: { main: brand.deepPurple, light: purple[500], dark: purple[700], contrastText: brand.white },
    secondary: { main: brand.blue, light: blue[100], dark: blue[800], contrastText: brand.white },
    info: { main: status.info.main, light: status.info.bg, dark: blue[800], contrastText: brand.white },
    success: { main: status.success.main, light: status.success.bg, dark: '#0A5C3B', contrastText: brand.white },
    warning: { main: status.warning.main, light: status.warning.bg, dark: '#7A4700', contrastText: brand.white },
    error: { main: status.error.main, light: status.error.bg, dark: '#9E1C2F', contrastText: brand.white },
    neutral: { main: slate[700], light: slate[100], dark: slate[900], contrastText: brand.white },
    navy,
    slate,
    text: { primary: colors.textPrimary, secondary: colors.textSecondary, disabled: slate[400] },
    background: { default: colors.background, paper: colors.surface },
    divider: colors.border,
    action: {
      hover: alpha(slate[500], 0.06),
      selected: alpha(brand.deepPurple, 0.08),
      focus: alpha(brand.purple, 0.12),
      disabled: slate[400],
      disabledBackground: slate[100],
    },
  },
  typography: {
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    htmlFontSize: 16,
    fontWeightRegular: typography.weights.regular,
    fontWeightMedium: typography.weights.medium,
    fontWeightBold: typography.weights.semibold,
    h1: { fontSize: px(s.h1.size), lineHeight: px(s.h1.line), letterSpacing: s.h1.tracking, fontWeight: s.h1.weight, color: colors.heading },
    h2: { fontSize: px(s.h2.size), lineHeight: px(s.h2.line), letterSpacing: s.h2.tracking, fontWeight: s.h2.weight, color: colors.heading },
    h3: { fontSize: px(s.h3.size), lineHeight: px(s.h3.line), letterSpacing: s.h3.tracking, fontWeight: s.h3.weight, color: colors.heading },
    h4: { fontSize: px(s.h4.size), lineHeight: px(s.h4.line), letterSpacing: s.h4.tracking, fontWeight: s.h4.weight, color: colors.heading },
    h5: { fontSize: px(s.body.size), lineHeight: px(s.body.line), fontWeight: 600, color: colors.heading },
    h6: { fontSize: px(s.bodySmall.size), lineHeight: px(s.bodySmall.line), fontWeight: 600, color: colors.heading },
    subtitle1: { fontSize: px(s.body.size), lineHeight: px(s.body.line), fontWeight: 500 },
    subtitle2: { fontSize: px(s.bodySmall.size), lineHeight: px(s.bodySmall.line), fontWeight: 500 },
    body1: { fontSize: px(s.body.size), lineHeight: px(s.body.line) },
    body2: { fontSize: px(s.bodySmall.size), lineHeight: px(s.bodySmall.line) },
    caption: { fontSize: px(s.caption.size), lineHeight: px(s.caption.line), color: colors.textSecondary },
    overline: {
      fontSize: px(s.overline.size),
      lineHeight: px(s.overline.line),
      letterSpacing: s.overline.tracking,
      fontWeight: 600,
      textTransform: 'uppercase',
    },
    button: { fontSize: px(s.body.size), fontWeight: 500, textTransform: 'none', letterSpacing: '-0.003em' },
  },
  transitions: {
    easing: {
      easeInOut: transitions.easing,
      easeOut: transitions.easing,
      easeIn: transitions.easing,
      sharp: transitions.easing,
    },
    duration: {
      shortest: transitions.fast,
      shorter: transitions.fast,
      short: transitions.base,
      standard: transitions.base,
      complex: transitions.slow,
      enteringScreen: transitions.base,
      leavingScreen: transitions.fast,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility' },
        body: { backgroundColor: colors.background, color: colors.textPrimary, fontFeatureSettings: '"cv11", "ss01"' },
        '::selection': { backgroundColor: purple[200] },
        a: { color: colors.link },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
      styleOverrides: { root: { '&.Mui-focusVisible': focusVisible } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: radii.md,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          minWidth: 0,
          transition: `background-color ${transitions.fast}ms ${transitions.easing}, border-color ${transitions.fast}ms ${transitions.easing}, color ${transitions.fast}ms ${transitions.easing}`,
        },
        sizeSmall: { height: 30, padding: '0 10px', fontSize: 13 },
        sizeMedium: { height: 36, padding: '0 14px' },
        sizeLarge: { height: 42, padding: '0 18px', fontSize: 15 },
        startIcon: { marginRight: 6, '& > *:nth-of-type(1)': { fontSize: 18 } },
        endIcon: { marginLeft: 6, '& > *:nth-of-type(1)': { fontSize: 18 } },
        containedPrimary: {
          backgroundColor: brand.deepPurple,
          '&:hover': { backgroundColor: purple[700] },
          '&:active': { backgroundColor: purple[800] },
        },
        outlined: {
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          '&:hover': { borderColor: slate[300], backgroundColor: slate[50] },
        },
        text: { '&:hover': { backgroundColor: alpha(slate[500], 0.08) } },
      },
      variants: [
        {
          props: { variant: 'outlined', color: 'neutral' },
          style: { color: slate[800], borderColor: colors.borderStrong, boxShadow: shadows.xs },
        },
        {
          props: { variant: 'text', color: 'neutral' },
          style: { color: slate[700] },
        },
        {
          props: { variant: 'outlined', color: 'error' },
          style: { borderColor: status.error.border, '&:hover': { borderColor: status.error.main, backgroundColor: status.error.bg } },
        },
      ],
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: radii.md, color: slate[500], '&:hover': { backgroundColor: alpha(slate[500], 0.08), color: slate[800] } },
        sizeSmall: { padding: 5 },
      },
    },
    MuiLink: {
      defaultProps: { underline: 'hover' },
      styleOverrides: { root: { color: colors.link, fontWeight: 500, '&.Mui-focusVisible, &:focus-visible': { ...focusVisible, borderRadius: 2 } } },
    },
    MuiInputLabel: {
      defaultProps: { shrink: true },
      styleOverrides: {
        root: {
          position: 'relative',
          transform: 'none',
          maxWidth: '100%',
          marginBottom: 6,
          fontSize: 13,
          lineHeight: '18px',
          fontWeight: 500,
          color: slate[700],
          whiteSpace: 'normal',
          '&.MuiInputLabel-shrink': { transform: 'none', maxWidth: '100%' },
          '&.Mui-focused': { color: slate[800] },
          '&.Mui-error': { color: slate[700] },
          '&.Mui-disabled': { color: slate[500] },
        },
        asterisk: { color: status.error.main },
      },
    },
    MuiFormLabel: {
      styleOverrides: { root: { fontSize: 13, fontWeight: 500, color: slate[700], '&.Mui-focused': { color: slate[800] } } },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { fontSize: 14 },
        input: { '&::placeholder': { color: slate[400], opacity: 1 } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radii.md,
          backgroundColor: colors.surface,
          transition: `box-shadow ${transitions.fast}ms ${transitions.easing}`,
          '& .MuiOutlinedInput-notchedOutline': {
            top: 0,
            borderColor: colors.borderStrong,
            transition: `border-color ${transitions.fast}ms ${transitions.easing}`,
            '& legend': { display: 'none' },
          },
          '&:hover:not(.Mui-disabled, .Mui-error) .MuiOutlinedInput-notchedOutline': { borderColor: slate[300] },
          '&.Mui-focused': { boxShadow: focusRing.shadow },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: brand.purple, borderWidth: 1 },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: status.error.main },
          '&.Mui-error.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(status.error.main, 0.18)}` },
          '&.Mui-disabled': { backgroundColor: slate[50] },
        },
        input: { padding: '9px 12px', height: 20 },
        inputSizeSmall: { padding: '5px 10px' },
        adornedStart: { paddingLeft: 12 },
        adornedEnd: { paddingRight: 8 },
        inputAdornedStart: { paddingLeft: 0 },
      },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginLeft: 0, marginRight: 0, marginTop: 6, fontSize: 12, lineHeight: '16px', color: slate[500] } },
    },
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiSelect: {
      defaultProps: { MenuProps: { slotProps: { paper: { sx: { mt: 1 } } } } },
      styleOverrides: { icon: { color: slate[500], right: 8 } },
    },
    MuiAutocomplete: {
      styleOverrides: {
        inputRoot: { '&.MuiOutlinedInput-root': { padding: '0 8px 0 0', '& .MuiAutocomplete-input': { padding: '9px 12px' } } },
        paper: { marginTop: 4, border: `1px solid ${colors.border}`, boxShadow: shadows.md, borderRadius: radii.md },
        listbox: { padding: 4, '& .MuiAutocomplete-option': { borderRadius: radii.sm, fontSize: 14, minHeight: 34 } },
        noOptions: { fontSize: 13 },
      },
    },
    MuiCheckbox: { defaultProps: { size: 'small' } },
    MuiRadio: { defaultProps: { size: 'small' } },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: 'none' }, rounded: { borderRadius: radii.lg } },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: radii.lg, borderColor: colors.border, backgroundColor: colors.surface } },
    },
    MuiCardHeader: {
      defaultProps: { slotProps: { title: { variant: 'h3' }, subheader: { variant: 'body2' } } },
      styleOverrides: { root: { padding: '16px 20px' }, action: { margin: 0, alignSelf: 'center' } },
    },
    MuiCardContent: {
      styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: colors.border } } },
    MuiTableContainer: { styleOverrides: { root: { overflowX: 'auto' } } },
    MuiTable: { defaultProps: { size: 'small' } },
    MuiTableHead: {
      styleOverrides: { root: { backgroundColor: slate[25] } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${colors.border}`, fontSize: 14, padding: '10px 16px' },
        sizeSmall: { padding: '10px 16px' },
        head: {
          fontSize: 12,
          fontWeight: 500,
          color: slate[500],
          paddingTop: 8,
          paddingBottom: 8,
          whiteSpace: 'nowrap',
          letterSpacing: '0.01em',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: { root: { '&:last-child td': { borderBottom: 0 }, '&.MuiTableRow-hover:hover': { backgroundColor: slate[25] } } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: radii.lg, boxShadow: shadows.lg, border: `1px solid ${colors.border}` },
        paperFullScreen: { borderRadius: 0, border: 0 },
      },
    },
    MuiBackdrop: {
      styleOverrides: { root: { '&:not(.MuiBackdrop-invisible)': { backgroundColor: alpha(navy[950], 0.45) } } },
    },
    MuiDialogTitle: {
      defaultProps: { variant: 'h3' },
      styleOverrides: { root: { padding: '20px 24px 8px' } },
    },
    MuiDialogContent: { styleOverrides: { root: { padding: '8px 24px 16px' } } },
    MuiDialogContentText: { styleOverrides: { root: { fontSize: 14, color: slate[600] } } },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '12px 24px 20px', gap: 8, '& > :not(style) ~ :not(style)': { marginLeft: 0 } } },
    },
    MuiDrawer: {
      styleOverrides: { paper: { border: 0 } },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 40, borderBottom: `1px solid ${colors.border}` },
        indicator: { height: 2, backgroundColor: brand.purple },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 40,
          minWidth: 0,
          padding: '0 2px',
          marginRight: 20,
          fontWeight: 500,
          color: slate[500],
          '&.Mui-selected': { color: colors.heading },
        },
      },
    },
    MuiMenu: {
      defaultProps: { slotProps: { paper: { elevation: 4 } } },
      styleOverrides: {
        paper: { border: `1px solid ${colors.border}`, borderRadius: radii.md, minWidth: 180 },
        list: { padding: 4 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: radii.sm,
          fontSize: 14,
          minHeight: 34,
          padding: '6px 10px',
          '&.Mui-selected': { backgroundColor: purple[50], '&:hover': { backgroundColor: purple[100] } },
          '&.Mui-focusVisible': { backgroundColor: slate[100], outline: 'none' },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 30, color: slate[500], '& svg': { fontSize: 18 } } } },
    MuiListItemText: { styleOverrides: { primary: { fontSize: 14 } } },
    MuiTooltip: {
      defaultProps: { arrow: false, enterDelay: 300 },
      styleOverrides: {
        tooltip: { backgroundColor: navy[950], fontSize: 12, fontWeight: 500, padding: '6px 8px', borderRadius: radii.sm, lineHeight: '16px' },
      },
    },
    MuiAlert: {
      defaultProps: { variant: 'standard' },
      styleOverrides: {
        root: { borderRadius: radii.md, fontSize: 13, lineHeight: '19px', padding: '8px 12px', border: '1px solid', alignItems: 'flex-start' },
        icon: { padding: '2px 0', marginRight: 10, fontSize: 18, opacity: 1 },
        message: { padding: '1px 0' },
        action: { paddingTop: 0, marginRight: -4 },
        standardSuccess: { backgroundColor: status.success.bg, color: '#0A4F33', borderColor: status.success.border, '& .MuiAlert-icon': { color: status.success.main } },
        standardInfo: { backgroundColor: status.info.bg, color: blue[800], borderColor: status.info.border, '& .MuiAlert-icon': { color: status.info.main } },
        standardWarning: { backgroundColor: status.warning.bg, color: '#6B3F00', borderColor: status.warning.border, '& .MuiAlert-icon': { color: status.warning.main } },
        standardError: { backgroundColor: status.error.bg, color: '#8C1A2B', borderColor: status.error.border, '& .MuiAlert-icon': { color: status.error.main } },
        filledSuccess: { backgroundColor: navy[950], color: brand.white, borderColor: navy[950] },
      },
    },
    MuiAlertTitle: { styleOverrides: { root: { fontSize: 13, fontWeight: 600, marginBottom: 2, marginTop: 0 } } },
    MuiSnackbarContent: {
      styleOverrides: { root: { backgroundColor: navy[950], borderRadius: radii.md, fontSize: 14 } },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radii.sm, fontWeight: 500, fontSize: 12, height: 22 },
        sizeSmall: { height: 20, fontSize: 12 },
        label: { paddingLeft: 7, paddingRight: 7 },
        labelSmall: { paddingLeft: 6, paddingRight: 6 },
      },
    },
    MuiSkeleton: {
      defaultProps: { animation: 'wave' },
      styleOverrides: {
        root: { backgroundColor: slate[100], borderRadius: radii.sm },
        text: { transform: 'none', borderRadius: radii.xs },
      },
    },
    MuiAvatar: {
      styleOverrides: { root: { fontSize: 12, fontWeight: 600, backgroundColor: purple[100], color: purple[800] } },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: radii.full, backgroundColor: slate[100] }, bar: { borderRadius: radii.full } },
    },
    MuiCircularProgress: { defaultProps: { thickness: 4.5 } },
  },
});
