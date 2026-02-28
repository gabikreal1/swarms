export interface ThemeColors {
  // Backgrounds
  systemBackground: string;
  secondarySystemBackground: string;
  tertiarySystemBackground: string;
  systemGroupedBackground: string;
  secondarySystemGroupedBackground: string;
  tertiarySystemGroupedBackground: string;

  // Labels
  label: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  quaternaryLabel: string;

  // Fills
  systemFill: string;
  secondarySystemFill: string;
  tertiarySystemFill: string;
  quaternarySystemFill: string;

  // System colors
  tint: string;
  systemBlue: string;
  systemGreen: string;
  systemRed: string;
  systemOrange: string;
  systemYellow: string;
  systemIndigo: string;
  systemPurple: string;
  systemPink: string;
  systemTeal: string;
  systemCyan: string;

  // Other
  separator: string;
  opaqueSeparator: string;
  link: string;

  // Semantic
  destructive: string;
}

export function getColors(scheme: 'light' | 'dark'): ThemeColors {
  if (scheme === 'dark') {
    return {
      systemBackground: '#000000',
      secondarySystemBackground: '#1C1C1E',
      tertiarySystemBackground: '#2C2C2E',
      systemGroupedBackground: '#000000',
      secondarySystemGroupedBackground: '#1C1C1E',
      tertiarySystemGroupedBackground: '#2C2C2E',

      label: '#FFFFFF',
      secondaryLabel: '#EBEBF599',
      tertiaryLabel: '#EBEBF54D',
      quaternaryLabel: '#EBEBF52E',

      systemFill: '#7878805C',
      secondarySystemFill: '#78788052',
      tertiarySystemFill: '#7676803D',
      quaternarySystemFill: '#74748028',

      tint: '#0A84FF',
      systemBlue: '#0A84FF',
      systemGreen: '#30D158',
      systemRed: '#FF453A',
      systemOrange: '#FF9F0A',
      systemYellow: '#FFD60A',
      systemIndigo: '#5E5CE6',
      systemPurple: '#BF5AF2',
      systemPink: '#FF375F',
      systemTeal: '#6AC4DC',
      systemCyan: '#70D7FF',

      separator: '#54545899',
      opaqueSeparator: '#38383A',
      link: '#0984FF',

      destructive: '#FF453A',
    };
  }

  return {
    systemBackground: '#FFFFFF',
    secondarySystemBackground: '#F2F2F7',
    tertiarySystemBackground: '#FFFFFF',
    systemGroupedBackground: '#F2F2F7',
    secondarySystemGroupedBackground: '#FFFFFF',
    tertiarySystemGroupedBackground: '#F2F2F7',

    label: '#000000',
    secondaryLabel: '#3C3C4399',
    tertiaryLabel: '#3C3C434D',
    quaternaryLabel: '#3C3C432E',

    systemFill: '#78788033',
    secondarySystemFill: '#78788029',
    tertiarySystemFill: '#7676801F',
    quaternarySystemFill: '#74748014',

    tint: '#007AFF',
    systemBlue: '#007AFF',
    systemGreen: '#34C759',
    systemRed: '#FF3B30',
    systemOrange: '#FF9500',
    systemYellow: '#FFCC00',
    systemIndigo: '#5856D6',
    systemPurple: '#AF52DE',
    systemPink: '#FF2D55',
    systemTeal: '#5AC8FA',
    systemCyan: '#32ADE6',

    separator: '#3C3C4349',
    opaqueSeparator: '#C6C6C8',
    link: '#007AFF',

    destructive: '#FF3B30',
  };
}
