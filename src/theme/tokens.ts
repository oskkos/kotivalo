// Kotivalo's colors (CONCEPT.md §2) and the shades the design canvas uses
// around them. Components get these through the MUI theme (theme.ts); use
// a token here only where the theme has no slot for it.
export const colors = {
  // Brand
  plum: '#2B1B3D', // primary, text
  yellow: '#FFB020', // accent
  cream: '#FFF7EA', // background
  lavender: '#CDBEDD', // secondary

  // Text
  plumMuted: '#5A4A6B', // secondary text
  plumSubtle: '#6B5B7B', // inactive navigation
  // The canvas uses #8C7D9C (3.8:1 on white); darkened to reach 4.5:1 on
  // cream and white.
  placeholder: '#7A6B8A',
  onPlumMuted: '#E9DDF2', // secondary text on plum

  // Errors (Design canvas: SignInErrors). Always with an icon and text, never
  // colour alone.
  error: '#B42318', // error text and icons
  errorSurface: '#FBE9E7', // error alerts
  errorBorder: '#E7B4AE',

  // Surfaces and tints
  white: '#FFFFFF',
  yellowTint: '#FFF0CC', // paid chips, hints
  lavenderTint: '#F1EAF6', // expense icons, notes
  sand: '#F1E6D3', // segmented control track, pressed icon button

  // Lines
  cardBorder: '#EFE3CF',
  inputBorder: '#E6D8C2',
  divider: '#F3EADB',
  dashed: '#B9A9C9', // empty states, "attach receipt"
  switchTrack: '#D9CCE3',
} as const

export const shadows = {
  menu: '0 12px 32px rgba(43,27,61,0.18)',
  knob: '0 1px 3px rgba(43,27,61,0.3)',
} as const

/** Corner radii from the design canvas, in px. */
export const radii = {
  input: 14,
  tile: 16, // small cards and notes
  menu: 18,
  card: 20,
  hero: 28, // the plum header cards, bottom sheets
  pill: 999, // buttons, chips, segmented control
} as const

export const fontFamily = "'Nunito Variable', 'Segoe UI', system-ui, sans-serif"
