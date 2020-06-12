import Ergodox from './ergodox';
import { KeyboardConfig } from 'keyboard';

export type Preset = 'ergodox-ez';

export const getPreset = (preset: Preset): KeyboardConfig => {
  switch (preset) {
    case 'ergodox-ez':
      return Ergodox;
    default:
      throw new Error('Unknown keyboard preset');
  }
};
