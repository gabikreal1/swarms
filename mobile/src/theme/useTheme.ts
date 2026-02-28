import { useColorScheme } from 'react-native';
import { getColors, ThemeColors } from './colors';
import { typography, Typography } from './typography';
import { spacing, Spacing } from './spacing';

export interface Theme {
  colors: ThemeColors;
  typography: Typography;
  spacing: Spacing;
  isDark: boolean;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return {
    colors: getColors(isDark ? 'dark' : 'light'),
    typography,
    spacing,
    isDark,
  };
}
