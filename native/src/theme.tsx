import { createContext, useContext, type ReactNode } from 'react';
import {
  DEFAULT_THEME,
  selectedTheme,
  THEME_TOKENS,
  type ThemeTokens,
} from '../../src/engine';
import { useGameStore } from './store';

export const fonts = {
  display: 'Cinzel_700Bold',
  displayBlack: 'Cinzel_900Black',
  ui: 'SourceSans3_400Regular',
  uiBold: 'SourceSans3_700Bold',
} as const;

const ThemeContext = createContext<ThemeTokens>(THEME_TOKENS[DEFAULT_THEME]);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const id = useGameStore((s) => selectedTheme(s.meta));
  return <ThemeContext.Provider value={THEME_TOKENS[id]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}

/** Classic Dark fallback for leftover static styles. Prefer `useTheme()`. */
export const colors = THEME_TOKENS[DEFAULT_THEME];
