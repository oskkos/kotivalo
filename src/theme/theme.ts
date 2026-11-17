// The MUI theme: Kotivalo's brand (CONCEPT.md §2) and the component styles of
// the design canvas, with MUI's own component text in the user's language.
import { createTheme, type Theme } from '@mui/material/styles'
import { enUS, fiFI, svSE } from '@mui/material/locale'
import type { Locale } from '#/paraglide/runtime.js'
import { colors, fontFamily, radii, shadows } from './tokens'

declare module '@mui/material/styles' {
  interface Palette {
    accent: Palette['primary']
  }
  interface PaletteOptions {
    accent?: PaletteOptions['primary']
  }
}
declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    accent: true
  }
}
declare module '@mui/material/Fab' {
  interface FabPropsColorOverrides {
    accent: true
  }
}
declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    accent: true
  }
}

/** The smallest touch target, in px (WCAG 2.5.5, Apple HIG). */
export const TOUCH_TARGET = 44

// Custom palette colors are not augmented by createTheme: dark and light are
// derived here so components that use them (Fab, Button) get every shade.
const { augmentColor } = createTheme().palette

const base = createTheme({
  palette: {
    mode: 'light',
    primary: { main: colors.plum, contrastText: colors.cream },
    secondary: { main: colors.lavender, contrastText: colors.plum },
    accent: augmentColor({
      color: {
        main: colors.yellow,
        light: colors.yellowTint,
        contrastText: colors.plum,
      },
      name: 'accent',
    }),
    text: {
      primary: colors.plum,
      secondary: colors.plumMuted,
      disabled: colors.placeholder,
    },
    background: { default: colors.cream, paper: colors.white },
    divider: colors.divider,
  },

  // Weights: 700 for body text, 800 for labels and buttons, 900 for headings
  // and amounts. The canvas uses 600 once, in the logo tagline.
  typography: {
    fontFamily,
    fontWeightLight: 700,
    fontWeightRegular: 700,
    fontWeightMedium: 800,
    fontWeightBold: 900,
    h1: {
      fontSize: 30,
      fontWeight: 900,
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
    },
    h2: {
      fontSize: 24,
      fontWeight: 900,
      letterSpacing: '-0.02em',
      lineHeight: 1.15,
    },
    h3: { fontSize: 17, fontWeight: 900, lineHeight: 1.3 },
    h4: { fontSize: 15, fontWeight: 800, lineHeight: 1.35 },
    subtitle1: { fontSize: 16, fontWeight: 900, lineHeight: 1.35 },
    subtitle2: { fontSize: 14, fontWeight: 800, lineHeight: 1.35 },
    body1: { fontSize: 15, fontWeight: 700, lineHeight: 1.45 },
    body2: { fontSize: 13, fontWeight: 700, lineHeight: 1.4 },
    caption: { fontSize: 12, fontWeight: 700, lineHeight: 1.35 },
    button: {
      fontSize: 15,
      fontWeight: 900,
      textTransform: 'none',
      letterSpacing: 0,
    },
    overline: {
      fontSize: 12,
      fontWeight: 800,
      textTransform: 'none',
      letterSpacing: 0,
    },
  },

  shape: { borderRadius: radii.input },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitFontSmoothing: 'antialiased' },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true, variant: 'contained' },
      styleOverrides: {
        root: {
          borderRadius: radii.pill,
          minHeight: TOUCH_TARGET,
          paddingInline: 20,
        },
        sizeLarge: { minHeight: 56, fontSize: 17 },
        outlined: {
          borderWidth: 1.5,
          borderColor: colors.inputBorder,
          backgroundColor: colors.white,
          color: colors.plum,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: TOUCH_TARGET,
          minHeight: TOUCH_TARGET,
          color: colors.plum,
        },
      },
    },
    MuiFab: {
      defaultProps: { color: 'accent' },
      styleOverrides: { root: { boxShadow: 'none' } },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { rounded: { borderRadius: radii.card } },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderColor: colors.cardBorder } },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: 14, '&:last-child': { paddingBottom: 14 } },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radii.pill, fontSize: 12, fontWeight: 800 },
        clickable: { minHeight: TOUCH_TARGET, fontSize: 14, paddingInline: 6 },
        outlined: {
          borderWidth: 1.5,
          borderColor: colors.inputBorder,
          backgroundColor: colors.white,
        },
      },
      variants: [
        {
          props: { color: 'accent' },
          style: { backgroundColor: colors.yellowTint, color: colors.plum },
        },
      ],
    },

    // Segmented control: a sand track with the selected option in yellow.
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          backgroundColor: colors.sand,
          borderRadius: radii.pill,
          padding: 4,
          gap: 4,
        },
        grouped: {
          border: 'none',
          borderRadius: `${String(radii.pill)}px !important`,
          margin: 0,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          flex: 1,
          minHeight: TOUCH_TARGET,
          border: 'none',
          color: colors.plum,
          fontSize: 15,
          fontWeight: 900,
          '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: colors.yellow,
            color: colors.plum,
          },
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 48,
          borderRadius: radii.input,
          backgroundColor: colors.white,
          fontSize: 16, // 16 px keeps iOS Safari from zooming in on focus
          fontWeight: 800,
          '& .MuiOutlinedInput-notchedOutline': {
            borderWidth: 1.5,
            borderColor: colors.inputBorder,
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        // Full opacity: MUI's default 0.42 would drop below 4.5:1. MUI still
        // hides the placeholder (opacity 0 !important) under a resting label.
        input: { '&::placeholder': { color: colors.placeholder, opacity: 1 } },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontWeight: 700, color: colors.plumMuted } },
    },

    MuiSwitch: {
      styleOverrides: {
        root: { width: 52, height: 32, padding: 0 },
        switchBase: {
          padding: 3,
          '&.Mui-checked': {
            transform: 'translateX(20px)',
            color: colors.white,
            '& + .MuiSwitch-track': {
              backgroundColor: colors.plum,
              opacity: 1,
            },
          },
        },
        thumb: { width: 26, height: 26, boxShadow: shadows.knob },
        track: {
          borderRadius: 16,
          backgroundColor: colors.switchTrack,
          opacity: 1,
        },
      },
    },

    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: radii.menu,
          border: `1px solid ${colors.cardBorder}`,
          boxShadow: shadows.menu,
        },
        list: { padding: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: 48,
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 800,
          gap: 12,
        },
      },
    },

    // Bottom sheets.
    MuiDrawer: {
      styleOverrides: {
        anchorBottom: {
          '& .MuiDrawer-paper': {
            borderTopLeftRadius: radii.hero,
            borderTopRightRadius: radii.hero,
          },
        },
      },
    },

    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          height: 'auto',
          backgroundColor: colors.white,
          borderTop: `1px solid ${colors.cardBorder}`,
          // Room for the iPhone home indicator (the canvas draws it as 26 px).
          padding: '8px 8px calc(8px + env(safe-area-inset-bottom))',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minHeight: 52,
          minWidth: 0,
          color: colors.plumSubtle,
          '&.Mui-selected': { color: colors.plum },
        },
        label: {
          fontSize: 12,
          fontWeight: 800,
          '&.Mui-selected': { fontSize: 12, fontWeight: 900 },
        },
      },
    },
  },
})

// MUI's own component text (pagination, autocomplete, …) per language.
const MUI_LOCALES = { fi: fiFI, sv: svSE, en: enUS } satisfies Record<
  Locale,
  object
>

const themes = Object.fromEntries(
  Object.entries(MUI_LOCALES).map(([locale, muiLocale]) => [
    locale,
    createTheme(base, muiLocale),
  ]),
) as Record<Locale, Theme>

/** The theme for a language. */
export function themeFor(locale: Locale): Theme {
  return themes[locale]
}
