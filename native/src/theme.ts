import { StyleSheet } from 'react-native';
import { GRAY_GRID_NUMBERS } from '../../src/engine';

export const colors = {
  bg: '#120e0c',
  bg2: '#1a1410',
  stone: '#2c2520',
  stoneHi: '#3d342e',
  stoneLo: '#1c1714',
  ink: '#f3e6d0',
  muted: '#b5a48c',
  gold: '#e0b44a',
  gold2: '#f3d27a',
  ember: '#ff6b35',
  blood: '#c23b3b',
  ash: '#6a5e56',
  border: '#5a4a38',
  goldBorder: '#a67c2d',
} as const;

export const fonts = {
  display: 'Cinzel_700Bold',
  displayBlack: 'Cinzel_900Black',
  ui: 'SourceSans3_400Regular',
  uiBold: 'SourceSans3_700Bold',
} as const;

export const NUMBER_COLORS = GRAY_GRID_NUMBERS;

export const styles = StyleSheet.create({
  flex: { flex: 1 },
});
