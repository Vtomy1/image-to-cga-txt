import { CgaPalette, CgaColor } from '../types';

export const CGA_PALETTES: CgaPalette[] = [
  {
    id: 'cga_pal1_high',
    name: 'CGA Pal 1 (High Intensity)',
    category: 'cga',
    description: 'Black, Bright Cyan, Bright Magenta, White — The iconic neon DOS gaming palette.',
    colors: [
      { index: 0, name: 'Black', hex: '#000000', rgb: [0, 0, 0] },
      { index: 1, name: 'Bright Cyan', hex: '#55ffff', rgb: [85, 255, 255] },
      { index: 2, name: 'Bright Magenta', hex: '#ff55ff', rgb: [255, 85, 255] },
      { index: 3, name: 'Bright White', hex: '#ffffff', rgb: [255, 255, 255] },
    ],
  },
  {
    id: 'cga_pal1_low',
    name: 'CGA Pal 1 (Low Intensity)',
    category: 'cga',
    description: 'Black, Cyan, Magenta, Light Gray — Softer contrast CGA mode.',
    colors: [
      { index: 0, name: 'Black', hex: '#000000', rgb: [0, 0, 0] },
      { index: 1, name: 'Cyan', hex: '#00aaaa', rgb: [0, 170, 170] },
      { index: 2, name: 'Magenta', hex: '#aa00aa', rgb: [170, 0, 170] },
      { index: 3, name: 'Light Gray', hex: '#aaaaaa', rgb: [170, 170, 170] },
    ],
  },
  {
    id: 'cga_pal2_high',
    name: 'CGA Pal 2 (High Intensity)',
    category: 'cga',
    description: 'Black, Bright Green, Bright Red, Yellow — Warm vibrant arcade tones.',
    colors: [
      { index: 0, name: 'Black', hex: '#000000', rgb: [0, 0, 0] },
      { index: 1, name: 'Bright Green', hex: '#55ff55', rgb: [85, 255, 85] },
      { index: 2, name: 'Bright Red', hex: '#ff5555', rgb: [255, 85, 85] },
      { index: 3, name: 'Yellow', hex: '#ffff55', rgb: [255, 255, 85] },
    ],
  },
  {
    id: 'cga_pal2_low',
    name: 'CGA Pal 2 (Low Intensity)',
    category: 'cga',
    description: 'Black, Green, Red, Brown — Earthy organic 4-color palette.',
    colors: [
      { index: 0, name: 'Black', hex: '#000000', rgb: [0, 0, 0] },
      { index: 1, name: 'Green', hex: '#00aa00', rgb: [0, 170, 0] },
      { index: 2, name: 'Red', hex: '#aa0000', rgb: [170, 0, 0] },
      { index: 3, name: 'Brown', hex: '#aa5500', rgb: [170, 85, 0] },
    ],
  },
  {
    id: 'cga_mode5',
    name: 'CGA Mode 5 (Alternative)',
    category: 'cga',
    description: 'Black, Bright Cyan, Bright Red, White — High impact RGB balance.',
    colors: [
      { index: 0, name: 'Black', hex: '#000000', rgb: [0, 0, 0] },
      { index: 1, name: 'Bright Cyan', hex: '#55ffff', rgb: [85, 255, 255] },
      { index: 2, name: 'Bright Red', hex: '#ff5555', rgb: [255, 85, 85] },
      { index: 3, name: 'Bright White', hex: '#ffffff', rgb: [255, 255, 255] },
    ],
  },
  {
    id: 'cga_amber',
    name: 'Amber CRT (IBM 5153)',
    category: 'retro',
    description: 'Black, Deep Amber, Warm Amber, Phosphor Gold — Warm monochrome glow.',
    colors: [
      { index: 0, name: 'Void Black', hex: '#0b0804', rgb: [11, 8, 4] },
      { index: 1, name: 'Deep Amber', hex: '#92400e', rgb: [146, 64, 14] },
      { index: 2, name: 'Warm Amber', hex: '#f59e0b', rgb: [245, 158, 11] },
      { index: 3, name: 'Phosphor Glow', hex: '#fef08a', rgb: [254, 240, 138] },
    ],
  },
  {
    id: 'cga_green',
    name: 'Green CRT (IBM 5151)',
    category: 'retro',
    description: 'Black, Dark Green, Terminal Green, Phosphor Mint — Hacker terminal.',
    colors: [
      { index: 0, name: 'Deep Black', hex: '#021204', rgb: [2, 18, 4] },
      { index: 1, name: 'Dark Green', hex: '#166534', rgb: [22, 101, 52] },
      { index: 2, name: 'Terminal Green', hex: '#22c55e', rgb: [34, 197, 94] },
      { index: 3, name: 'Phosphor Mint', hex: '#86efac', rgb: [134, 239, 172] },
    ],
  },
  {
    id: 'cga_gray',
    name: 'Grayscale (2-Bit Gray)',
    category: 'retro',
    description: 'Black, Dark Gray, Light Gray, White — Classic 4-level monochrome.',
    colors: [
      { index: 0, name: 'Black', hex: '#000000', rgb: [0, 0, 0] },
      { index: 1, name: 'Dark Gray', hex: '#555555', rgb: [85, 85, 85] },
      { index: 2, name: 'Light Gray', hex: '#aaaaaa', rgb: [170, 170, 170] },
      { index: 3, name: 'Bright White', hex: '#ffffff', rgb: [255, 255, 255] },
    ],
  },
];

export function getContrastTextColor(rgb: [number, number, number]): string {
  const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return luminance > 140 ? '#000000' : '#ffffff';
}

export function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return [r, g, b];
}

export function createCustomPalette(
  name: string,
  c0Hex: string,
  c1Hex: string,
  c2Hex: string,
  c3Hex: string
): CgaPalette {
  return {
    id: 'custom_' + Date.now(),
    name: name || 'Custom 2-Bit Palette',
    category: 'custom',
    description: 'User-defined 4-color palette for 2-bit digits quantization.',
    colors: [
      { index: 0, name: 'Color 0', hex: c0Hex, rgb: hexToRgb(c0Hex) },
      { index: 1, name: 'Color 1', hex: c1Hex, rgb: hexToRgb(c1Hex) },
      { index: 2, name: 'Color 2', hex: c2Hex, rgb: hexToRgb(c2Hex) },
      { index: 3, name: 'Color 3', hex: c3Hex, rgb: hexToRgb(c3Hex) },
    ],
  };
}
