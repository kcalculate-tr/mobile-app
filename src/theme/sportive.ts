// Sportive premium dark theme tokens — onboarding + auth flow için.
// Font naming: @expo-google-fonts/plus-jakarta-sans paketi underscore_weight convention kullanır.

export const sportive = {
  colors: {
    // Backgrounds
    bg:            '#0A0A0A',
    surface:       '#141414',
    input:         '#161616',

    // Glass (over hero image)
    glassBg:       'rgba(255, 255, 255, 0.10)',
    glassBorder:   'rgba(255, 255, 255, 0.18)',
    glassActive:   'rgba(200, 240, 60, 0.15)',
    glassInputBg:  'rgba(255, 255, 255, 0.06)',

    // Borders
    border:        '#232323',
    borderHover:   '#2E2E2E',
    borderActive:  '#C8F03C',

    // Text
    textPrimary:    '#FFFFFF',
    textSecondary:  'rgba(255, 255, 255, 0.70)',
    textTertiary:   'rgba(255, 255, 255, 0.50)',
    textMuted:      'rgba(255, 255, 255, 0.35)',

    // Brand
    accent:        '#C8F03C',
    accentDark:    '#A8D830',
    accentText:    '#0A0A0A',

    // Semantic
    success:       '#C8F03C',
    error:         '#FF6B6B',
    warning:       '#FFB84D',

    // Overlays
    overlayLight:  'rgba(10, 10, 10, 0.55)',
    overlayHeavy:  'rgba(10, 10, 10, 0.88)',
    blurTint:      'rgba(10, 24, 16, 0.65)',
  },

  radius: {
    pill: 9999,
    card: 20,
    input: 12,
    button: 100,
    avatar: 9999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  // Weights aligned with the main app (HomeScreen/Cart/Profile/Tracker):
  // titles -> 700 Bold, emphasis -> 600 SemiBold, body -> 400 Regular,
  // big numbers -> 800 ExtraBold. Font family already matched the registered
  // @expo-google-fonts/plus-jakarta-sans names; the visible mismatch was weight.
  type: {
    h1:        { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
    h2:        { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, lineHeight: 28, letterSpacing: -0.5 },
    h3:        { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, lineHeight: 24, letterSpacing: -0.4 },
    body:      { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 20 },
    bodySm:    { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 18 },
    caption:   { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 16 },
    tactical:  { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, lineHeight: 12, letterSpacing: 1.2, textTransform: 'uppercase' as const },
    button:    { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, lineHeight: 18, letterSpacing: -0.2 },
    number:    { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 60, lineHeight: 64, letterSpacing: -2 },
  },
};

export type SportiveTheme = typeof sportive;
