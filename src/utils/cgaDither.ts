import {
  CgaPalette,
  DitherAlgorithm,
  FitMode,
  ImageAdjustments,
  ProcessingResult,
  TxtExportFormat,
} from '../types';

export const CGA_WIDTH = 320;
export const CGA_HEIGHT = 200;
export const TOTAL_PIXELS = CGA_WIDTH * CGA_HEIGHT; // 64,000

// Bayer 4x4 matrix
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Bayer 8x8 matrix
const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

// Perceptual color distance (Redmean approximation)
function colorDistanceSq(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const rmean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return (
    ((512 + rmean) * dr * dr) / 256 +
    4 * dg * dg +
    ((767 - rmean) * db * db) / 256
  );
}

// Find closest palette index (0, 1, 2, 3)
function findClosestColorIndex(
  r: number,
  g: number,
  b: number,
  palette: CgaPalette
): 0 | 1 | 2 | 3 {
  let bestIndex: 0 | 1 | 2 | 3 = 0;
  let minDistance = Infinity;

  for (let i = 0; i < 4; i++) {
    const palColor = palette.colors[i];
    const dist = colorDistanceSq(
      r,
      g,
      b,
      palColor.rgb[0],
      palColor.rgb[1],
      palColor.rgb[2]
    );
    if (dist < minDistance) {
      minDistance = dist;
      bestIndex = i as 0 | 1 | 2 | 3;
    }
  }

  return bestIndex;
}

// Clamp helper
function clamp(val: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Resizes and preprocesses the source image onto a 320x200 buffer
 */
export function preprocessImage(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  fitMode: FitMode,
  adjustments: ImageAdjustments
): Float32Array {
  // Target 320x200 canvas
  const canvas = document.createElement('canvas');
  canvas.width = CGA_WIDTH;
  canvas.height = CGA_HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create canvas context');

  // Background is black (color index 0 default)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CGA_WIDTH, CGA_HEIGHT);

  let destX = 0;
  let destY = 0;
  let destW = CGA_WIDTH;
  let destH = CGA_HEIGHT;

  if (fitMode === 'fit') {
    const scale = Math.min(CGA_WIDTH / sourceWidth, CGA_HEIGHT / sourceHeight);
    destW = Math.round(sourceWidth * scale);
    destH = Math.round(sourceHeight * scale);
    destX = Math.round((CGA_WIDTH - destW) / 2);
    destY = Math.round((CGA_HEIGHT - destH) / 2);
  } else if (fitMode === 'cover') {
    const scale = Math.max(CGA_WIDTH / sourceWidth, CGA_HEIGHT / sourceHeight);
    destW = Math.round(sourceWidth * scale);
    destH = Math.round(sourceHeight * scale);
    destX = Math.round((CGA_WIDTH - destW) / 2);
    destY = Math.round((CGA_HEIGHT - destH) / 2);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, destX, destY, destW, destH);

  const rawImgData = ctx.getImageData(0, 0, CGA_WIDTH, CGA_HEIGHT);
  const src = rawImgData.data;

  // Pre-allocate float buffer: 320 * 200 * 3 (R, G, B as floats)
  const buffer = new Float32Array(CGA_WIDTH * CGA_HEIGHT * 3);

  // Precompute adjustment factors
  const brightness = adjustments.brightness; // -100 to 100
  const contrastFactor =
    (259 * (adjustments.contrast + 255)) / (255 * (259 - adjustments.contrast));
  const satFactor = (adjustments.saturation + 100) / 100;
  const gamma = adjustments.gamma || 1.0;
  const invert = adjustments.invert;

  for (let i = 0, j = 0; i < src.length; i += 4, j += 3) {
    let r = src[i];
    let g = src[i + 1];
    let b = src[i + 2];
    const a = src[i + 3] / 255;

    // Blend with black background if transparent
    r = r * a;
    g = g * a;
    b = b * a;

    if (invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    // Brightness
    r += brightness;
    g += brightness;
    b += brightness;

    // Contrast
    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;

    // Saturation
    if (satFactor !== 1.0) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + satFactor * (r - gray);
      g = gray + satFactor * (g - gray);
      b = gray + satFactor * (b - gray);
    }

    // Gamma correction
    if (gamma !== 1.0) {
      r = 255 * Math.pow(Math.max(0, r) / 255, 1 / gamma);
      g = 255 * Math.pow(Math.max(0, g) / 255, 1 / gamma);
      b = 255 * Math.pow(Math.max(0, b) / 255, 1 / gamma);
    }

    buffer[j] = clamp(r);
    buffer[j + 1] = clamp(g);
    buffer[j + 2] = clamp(b);
  }

  return buffer;
}

/**
 * Main 2-bit CGA Dithering and Quantization
 * Produces exactly 320x200 digits (Uint8Array of values 0, 1, 2, 3)
 */
export function processCgaDither(
  rgbBuffer: Float32Array,
  palette: CgaPalette,
  algorithm: DitherAlgorithm,
  adjustments: ImageAdjustments
): ProcessingResult {
  const digits = new Uint8Array(TOTAL_PIXELS);
  const counts: [number, number, number, number] = [0, 0, 0, 0];

  // Work on a copy of the RGB buffer so error diffusion doesn't mutate cached inputs
  const buf = new Float32Array(rgbBuffer);

  const strength = adjustments.ditherStrength ?? 1.0;
  const serpentine = adjustments.serpentine ?? true;

  if (algorithm === 'none') {
    // Nearest neighbor quantization without dithering
    for (let y = 0; y < CGA_HEIGHT; y++) {
      for (let x = 0; x < CGA_WIDTH; x++) {
        const idx = y * CGA_WIDTH + x;
        const bIdx = idx * 3;
        const r = clamp(buf[bIdx]);
        const g = clamp(buf[bIdx + 1]);
        const b = clamp(buf[bIdx + 2]);

        const digit = findClosestColorIndex(r, g, b, palette);
        digits[idx] = digit;
        counts[digit]++;
      }
    }
  } else if (algorithm === 'bayer-4x4' || algorithm === 'bayer-8x8') {
    // Ordered dithering
    const is8 = algorithm === 'bayer-8x8';
    const matrix = is8 ? BAYER_8X8 : BAYER_4X4;
    const mSize = is8 ? 8 : 4;
    const mMax = is8 ? 64 : 16;
    const spread = 64 * strength;

    for (let y = 0; y < CGA_HEIGHT; y++) {
      for (let x = 0; x < CGA_WIDTH; x++) {
        const idx = y * CGA_WIDTH + x;
        const bIdx = idx * 3;
        const threshold = (matrix[y % mSize][x % mSize] / mMax - 0.5) * spread;

        const r = clamp(buf[bIdx] + threshold);
        const g = clamp(buf[bIdx + 1] + threshold);
        const b = clamp(buf[bIdx + 2] + threshold);

        const digit = findClosestColorIndex(r, g, b, palette);
        digits[idx] = digit;
        counts[digit]++;
      }
    }
  } else {
    // Error diffusion algorithms
    const distributeError = (
      targetX: number,
      targetY: number,
      errR: number,
      errG: number,
      errB: number,
      weight: number
    ) => {
      if (
        targetX >= 0 &&
        targetX < CGA_WIDTH &&
        targetY >= 0 &&
        targetY < CGA_HEIGHT
      ) {
        const tIdx = (targetY * CGA_WIDTH + targetX) * 3;
        buf[tIdx] += errR * weight * strength;
        buf[tIdx + 1] += errG * weight * strength;
        buf[tIdx + 2] += errB * weight * strength;
      }
    };

    for (let y = 0; y < CGA_HEIGHT; y++) {
      // Serpentine scanning alternates left-to-right and right-to-left
      const leftToRight = !serpentine || y % 2 === 0;
      const startX = leftToRight ? 0 : CGA_WIDTH - 1;
      const endX = leftToRight ? CGA_WIDTH : -1;
      const stepX = leftToRight ? 1 : -1;

      for (let x = startX; x !== endX; x += stepX) {
        const idx = y * CGA_WIDTH + x;
        const bIdx = idx * 3;

        const oldR = clamp(buf[bIdx]);
        const oldG = clamp(buf[bIdx + 1]);
        const oldB = clamp(buf[bIdx + 2]);

        const digit = findClosestColorIndex(oldR, oldG, oldB, palette);
        digits[idx] = digit;
        counts[digit]++;

        const chosenColor = palette.colors[digit].rgb;
        const errR = oldR - chosenColor[0];
        const errG = oldG - chosenColor[1];
        const errB = oldB - chosenColor[2];

        const dir = leftToRight ? 1 : -1;

        if (algorithm === 'floyd-steinberg') {
          // Floyd-Steinberg:
          // x + dir: 7/16
          // x - dir, y + 1: 3/16
          // x, y + 1: 5/16
          // x + dir, y + 1: 1/16
          distributeError(x + dir, y, errR, errG, errB, 7 / 16);
          distributeError(x - dir, y + 1, errR, errG, errB, 3 / 16);
          distributeError(x, y + 1, errR, errG, errB, 5 / 16);
          distributeError(x + dir, y + 1, errR, errG, errB, 1 / 16);
        } else if (algorithm === 'atkinson') {
          // Atkinson distributes 1/8 each to 6 neighbors (keeps 2/8 for contrast)
          const w = 1 / 8;
          distributeError(x + dir, y, errR, errG, errB, w);
          distributeError(x + 2 * dir, y, errR, errG, errB, w);
          distributeError(x - dir, y + 1, errR, errG, errB, w);
          distributeError(x, y + 1, errR, errG, errB, w);
          distributeError(x + dir, y + 1, errR, errG, errB, w);
          distributeError(x, y + 2, errR, errG, errB, w);
        } else if (algorithm === 'burkes') {
          // Burkes: 8/32, 4/32, 2/32
          distributeError(x + dir, y, errR, errG, errB, 8 / 32);
          distributeError(x + 2 * dir, y, errR, errG, errB, 4 / 32);
          distributeError(x - 2 * dir, y + 1, errR, errG, errB, 2 / 32);
          distributeError(x - dir, y + 1, errR, errG, errB, 4 / 32);
          distributeError(x, y + 1, errR, errG, errB, 8 / 32);
          distributeError(x + dir, y + 1, errR, errG, errB, 4 / 32);
          distributeError(x + 2 * dir, y + 1, errR, errG, errB, 2 / 32);
        } else if (algorithm === 'sierra-lite') {
          // Sierra Lite:
          distributeError(x + dir, y, errR, errG, errB, 2 / 4);
          distributeError(x - dir, y + 1, errR, errG, errB, 1 / 4);
          distributeError(x, y + 1, errR, errG, errB, 1 / 4);
        }
      }
    }
  }

  // Generate 320x200 ImageData for screen rendering
  const outCanvas = document.createElement('canvas');
  outCanvas.width = CGA_WIDTH;
  outCanvas.height = CGA_HEIGHT;
  const outCtx = outCanvas.getContext('2d');
  const imgData = outCtx!.createImageData(CGA_WIDTH, CGA_HEIGHT);
  const pixels = imgData.data;

  for (let i = 0; i < TOTAL_PIXELS; i++) {
    const digit = digits[i];
    const col = palette.colors[digit].rgb;
    const pIdx = i * 4;
    pixels[pIdx] = col[0];
    pixels[pIdx + 1] = col[1];
    pixels[pIdx + 2] = col[2];
    pixels[pIdx + 3] = 255;
  }

  const percentages: [number, number, number, number] = [
    Number(((counts[0] / TOTAL_PIXELS) * 100).toFixed(1)),
    Number(((counts[1] / TOTAL_PIXELS) * 100).toFixed(1)),
    Number(((counts[2] / TOTAL_PIXELS) * 100).toFixed(1)),
    Number(((counts[3] / TOTAL_PIXELS) * 100).toFixed(1)),
  ];

  return {
    digits,
    width: CGA_WIDTH,
    height: CGA_HEIGHT,
    stats: {
      counts,
      percentages,
      totalPixels: TOTAL_PIXELS,
    },
    imageData: imgData,
    palette,
  };
}

/**
 * Generates the downloaded text output in various requested formats
 */
export function generateDigitsText(
  digits: Uint8Array,
  format: TxtExportFormat,
  palette: CgaPalette
): { text: string; filename: string; mimeType: string; byteCount: number } {
  const baseName = `cga_digits_320x200_${palette.id}`;

  switch (format) {
    case 'raw_grid': {
      // Exactly 200 lines, each line has 320 digits (0, 1, 2, 3)
      const rows: string[] = new Array(CGA_HEIGHT);
      for (let y = 0; y < CGA_HEIGHT; y++) {
        let rowStr = '';
        const offset = y * CGA_WIDTH;
        for (let x = 0; x < CGA_WIDTH; x++) {
          rowStr += digits[offset + x];
        }
        rows[y] = rowStr;
      }
      const text = rows.join('\n');
      return {
        text,
        filename: `${baseName}_grid.txt`,
        mimeType: 'text/plain',
        byteCount: text.length,
      };
    }

    case 'space_separated': {
      // 200 lines, 320 digits separated by space
      const rows: string[] = new Array(CGA_HEIGHT);
      for (let y = 0; y < CGA_HEIGHT; y++) {
        const offset = y * CGA_WIDTH;
        const slice = digits.subarray(offset, offset + CGA_WIDTH);
        rows[y] = Array.from(slice).join(' ');
      }
      const text = rows.join('\n');
      return {
        text,
        filename: `${baseName}_space_separated.txt`,
        mimeType: 'text/plain',
        byteCount: text.length,
      };
    }

    case 'comma_separated': {
      // 200 lines, CSV format
      const rows: string[] = new Array(CGA_HEIGHT);
      for (let y = 0; y < CGA_HEIGHT; y++) {
        const offset = y * CGA_WIDTH;
        const slice = digits.subarray(offset, offset + CGA_WIDTH);
        rows[y] = Array.from(slice).join(',');
      }
      const text = rows.join('\n');
      return {
        text,
        filename: `${baseName}_csv.txt`,
        mimeType: 'text/plain',
        byteCount: text.length,
      };
    }

    case 'c_array': {
      // C/C++ Header/Array format
      let lines = [
        `/**`,
        ` * CGA 320x200 2-Bit Digits Image Matrix`,
        ` * Palette: ${palette.name}`,
        ` * Values: 0=${palette.colors[0].name} (${palette.colors[0].hex}), 1=${palette.colors[1].name} (${palette.colors[1].hex}), 2=${palette.colors[2].name} (${palette.colors[2].hex}), 3=${palette.colors[3].name} (${palette.colors[3].hex})`,
        ` * Total Dimensions: 320 x 200 (64,000 digits)`,
        ` */`,
        `#include <stdint.h>`,
        ``,
        `const uint8_t CGA_IMAGE_320x200[200][320] = {`,
      ];

      for (let y = 0; y < CGA_HEIGHT; y++) {
        const offset = y * CGA_WIDTH;
        const row = Array.from(digits.subarray(offset, offset + CGA_WIDTH)).join(
          ','
        );
        lines.push(`  { ${row} }${y < CGA_HEIGHT - 1 ? ',' : ''}`);
      }
      lines.push(`};`);
      const text = lines.join('\n');
      return {
        text,
        filename: `${baseName}_array.txt`,
        mimeType: 'text/plain',
        byteCount: text.length,
      };
    }

    case 'basic_data': {
      // QBasic / GW-BASIC DATA statements (16 numbers per DATA line)
      const lines = [
        `10 REM -----------------------------------------`,
        `20 REM CGA 320x200 2-BIT DIGITS (0, 1, 2, 3)`,
        `30 REM PALETTE: ${palette.name.toUpperCase()}`,
        `40 REM -----------------------------------------`,
      ];
      let lineNum = 1000;
      const CHUNK_SIZE = 32;
      for (let i = 0; i < TOTAL_PIXELS; i += CHUNK_SIZE) {
        const chunk = Array.from(
          digits.subarray(i, Math.min(i + CHUNK_SIZE, TOTAL_PIXELS))
        ).join(',');
        lines.push(`${lineNum} DATA ${chunk}`);
        lineNum += 10;
      }
      const text = lines.join('\n');
      return {
        text,
        filename: `${baseName}_basic.txt`,
        mimeType: 'text/plain',
        byteCount: text.length,
      };
    }

    case 'packed_hex': {
      // 4 pixels per byte (2 bits each: p0<<6 | p1<<4 | p2<<2 | p3)
      // 80 bytes per row * 200 rows = 16,000 bytes
      const hexLines: string[] = [
        `# CGA 320x200 Packed 2-Bit Hex Bytes`,
        `# Format: 4 pixels per byte (MSB -> LSB), 80 bytes per line, 200 lines`,
        `# Palette: ${palette.name}`,
        ``,
      ];
      for (let y = 0; y < CGA_HEIGHT; y++) {
        let lineHex = '';
        for (let x = 0; x < CGA_WIDTH; x += 4) {
          const idx = y * CGA_WIDTH + x;
          const p0 = digits[idx] & 3;
          const p1 = digits[idx + 1] & 3;
          const p2 = digits[idx + 2] & 3;
          const p3 = digits[idx + 3] & 3;
          const byteVal = (p0 << 6) | (p1 << 4) | (p2 << 2) | p3;
          lineHex += byteVal.toString(16).padStart(2, '0').toUpperCase() + ' ';
        }
        hexLines.push(lineHex.trim());
      }
      const text = hexLines.join('\n');
      return {
        text,
        filename: `${baseName}_packed_hex.txt`,
        mimeType: 'text/plain',
        byteCount: text.length,
      };
    }

    case 'flat_stream':
    default: {
      // Single continuous string of 64,000 characters
      let str = '';
      for (let i = 0; i < TOTAL_PIXELS; i++) {
        str += digits[i];
      }
      return {
        text: str,
        filename: `${baseName}_stream.txt`,
        mimeType: 'text/plain',
        byteCount: str.length,
      };
    }
  }
}

/**
 * Triggers browser download of text content
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType = 'text/plain'
) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
