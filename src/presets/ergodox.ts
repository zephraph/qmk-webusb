import { KeyboardConfig } from 'keyboard';

const Ergodox: KeyboardConfig = {
  keyCount: 76,
  keyLayoutMap: [
    [0, 1, 2, 3, 4, 5, 6, 38, 39, 40, 41, 42, 43, 44],
    [7, 8, 9, 10, 11, 12, 13, 45, 46, 47, 48, 49, 50, 51],
    [14, 15, 16, 17, 18, 19, -1, -1, 52, 53, 54, 55, 56, 57],
    [20, 21, 22, 23, 24, 25, 26, 58, 59, 60, 61, 62, 63, 64],
    [27, 28, 29, 30, 31, -1, -1, -1, -1, 65, 66, 67, 68, 69],
    [-1, 37, 36, 35, 34, 32, 33, 70, 71, 72, 75, 74, 73],
  ],
  usbSelector: {
    productId: 0x1307,
    vendorId: 0xfeed,
  },
  pairingKey: {
    id: 6,
    layer: 0,
  },
};

export default Ergodox;
