import { CgaPalette } from '../types';
import { CGA_HEIGHT, CGA_WIDTH, TOTAL_PIXELS } from './cgaDither';

export type BsaveLayout = 'cga_interleaved' | 'qbasic_get_put' | 'linear';

export interface BsaveHeaderInfo {
  validMagic: boolean;
  magicByte: number;
  segment: number;
  offset: number;
  declaredLength: number;
  actualPayloadLength: number;
  totalFileSize: number;
  detectedLayout: BsaveLayout;
  hasHeader: boolean;
}

export interface DecodedBsaveResult {
  header: BsaveHeaderInfo;
  digits: Uint8Array; // 320 * 200 = 64,000 values (0..3)
  warnings: string[];
}

export const BSAVE_MAGIC = 0xfd;
export const CGA_SEGMENT = 0xb800;
export const CGA_BANK_SIZE = 8192; // &H2000
export const CGA_SCREEN_BSAVE_SIZE = 16384; // &H4000 (standard DEF SEG=&HB800 : BSAVE "", 0, 16384)
export const CGA_ACTIVE_SIZE = 16192; // 8192 + 8000
export const CGA_LINEAR_SIZE = 16000; // 80 bytes/row * 200 rows
export const QBASIC_ARRAY_SIZE = 16004; // 4-byte (width*2, height) header + 16,000 bytes

/**
 * Encodes 320x200 2-bit digits (0..3) into a binary QBasic BSAVE file with 7-byte header.
 */
export function encodeQBasicBsave(
  digits: Uint8Array,
  layout: BsaveLayout = 'cga_interleaved',
  segment: number = CGA_SEGMENT,
  offset: number = 0x0000
): Uint8Array {
  let payloadSize = CGA_SCREEN_BSAVE_SIZE;
  if (layout === 'qbasic_get_put') {
    payloadSize = QBASIC_ARRAY_SIZE;
  } else if (layout === 'linear') {
    payloadSize = CGA_LINEAR_SIZE;
  }

  const totalSize = 7 + payloadSize;
  const out = new Uint8Array(totalSize);

  // 7-byte QBasic / GW-BASIC BSAVE header
  out[0] = BSAVE_MAGIC;
  out[1] = segment & 0xff;
  out[2] = (segment >> 8) & 0xff;
  out[3] = offset & 0xff;
  out[4] = (offset >> 8) & 0xff;
  out[5] = payloadSize & 0xff;
  out[6] = (payloadSize >> 8) & 0xff;

  const payloadStart = 7;

  if (layout === 'cga_interleaved') {
    // IBM CGA Mode 4/5 (&HB800) hardware interleaved scanlines:
    // Even rows (0,2,4...198) -> offset 0..7999
    // Odd rows (1,3,5...199) -> offset 8192..16191
    for (let y = 0; y < CGA_HEIGHT; y++) {
      const bankOffset = (y & 1) * CGA_BANK_SIZE + (y >> 1) * 80;
      const rowPixelBase = y * CGA_WIDTH;
      for (let bx = 0; bx < 80; bx++) {
        const px = rowPixelBase + (bx << 2);
        const p0 = digits[px] & 3;
        const p1 = digits[px + 1] & 3;
        const p2 = digits[px + 2] & 3;
        const p3 = digits[px + 3] & 3;
        out[payloadStart + bankOffset + bx] =
          (p0 << 6) | (p1 << 4) | (p2 << 2) | p3;
      }
    }
  } else if (layout === 'qbasic_get_put') {
    // QBasic SCREEN 1 GET (0,0)-(319,199), array% header:
    // Word 0 = width in bits (320 * 2 = 640 = 0x0280)
    // Word 1 = height in pixels (200 = 0x00C8)
    const widthBits = CGA_WIDTH * 2;
    out[payloadStart + 0] = widthBits & 0xff;
    out[payloadStart + 1] = (widthBits >> 8) & 0xff;
    out[payloadStart + 2] = CGA_HEIGHT & 0xff;
    out[payloadStart + 3] = (CGA_HEIGHT >> 8) & 0xff;

    const dataBase = payloadStart + 4;
    for (let y = 0; y < CGA_HEIGHT; y++) {
      const rowByteBase = y * 80;
      const rowPixelBase = y * CGA_WIDTH;
      for (let bx = 0; bx < 80; bx++) {
        const px = rowPixelBase + (bx << 2);
        const p0 = digits[px] & 3;
        const p1 = digits[px + 1] & 3;
        const p2 = digits[px + 2] & 3;
        const p3 = digits[px + 3] & 3;
        out[dataBase + rowByteBase + bx] =
          (p0 << 6) | (p1 << 4) | (p2 << 2) | p3;
      }
    }
  } else {
    // Linear 16,000 bytes (80 bytes per row * 200 rows)
    for (let y = 0; y < CGA_HEIGHT; y++) {
      const rowByteBase = y * 80;
      const rowPixelBase = y * CGA_WIDTH;
      for (let bx = 0; bx < 80; bx++) {
        const px = rowPixelBase + (bx << 2);
        const p0 = digits[px] & 3;
        const p1 = digits[px + 1] & 3;
        const p2 = digits[px + 2] & 3;
        const p3 = digits[px + 3] & 0x03;
        out[payloadStart + rowByteBase + bx] =
          (p0 << 6) | (p1 << 4) | (p2 << 2) | p3;
      }
    }
  }

  return out;
}

/**
 * Inspects a binary buffer's 7-byte QBasic BSAVE header and auto-detects 320x200 2-bit layout.
 */
export function inspectBsaveHeader(bytes: Uint8Array): BsaveHeaderInfo {
  const totalFileSize = bytes.length;
  const hasBsaveMagic = totalFileSize >= 7 && bytes[0] === BSAVE_MAGIC;

  let segment = 0;
  let offset = 0;
  let declaredLength = totalFileSize;
  let actualPayloadLength = totalFileSize;
  let hasHeader = false;

  if (hasBsaveMagic) {
    hasHeader = true;
    segment = bytes[1] | (bytes[2] << 8);
    offset = bytes[3] | (bytes[4] << 8);
    declaredLength = bytes[5] | (bytes[6] << 8);
    actualPayloadLength = totalFileSize - 7;
  }

  const payloadOffset = hasHeader ? 7 : 0;
  let detectedLayout: BsaveLayout = 'cga_interleaved';

  // Detect QBasic SCREEN 1 GET/PUT array header (640 bits wide, 200 rows)
  if (actualPayloadLength >= QBASIC_ARRAY_SIZE) {
    const wBits = bytes[payloadOffset] | (bytes[payloadOffset + 1] << 8);
    const hRows = bytes[payloadOffset + 2] | (bytes[payloadOffset + 3] << 8);
    if (wBits === 640 && hRows === 200) {
      detectedLayout = 'qbasic_get_put';
    }
  }

  if (detectedLayout !== 'qbasic_get_put') {
    if (actualPayloadLength >= CGA_ACTIVE_SIZE) {
      detectedLayout = 'cga_interleaved';
    } else if (
      actualPayloadLength >= CGA_LINEAR_SIZE &&
      actualPayloadLength < CGA_ACTIVE_SIZE
    ) {
      detectedLayout = 'linear';
    } else {
      detectedLayout = 'cga_interleaved';
    }
  }

  return {
    validMagic: hasBsaveMagic,
    magicByte: totalFileSize > 0 ? bytes[0] : 0,
    segment,
    offset,
    declaredLength,
    actualPayloadLength,
    totalFileSize,
    detectedLayout,
    hasHeader,
  };
}

/**
 * Decodes a QBasic BSAVE (or raw 2-bit CGA dump) into 64,000 2-bit digits (0..3).
 */
export function decodeQBasicBsave(
  bytes: Uint8Array,
  overrideLayout?: BsaveLayout
): DecodedBsaveResult {
  const header = inspectBsaveHeader(bytes);
  const layout = overrideLayout ?? header.detectedLayout;
  const warnings: string[] = [];

  if (!header.validMagic) {
    warnings.push(
      `Missing 0xFD BSAVE magic header byte (found 0x${header.magicByte
        .toString(16)
        .padStart(2, '0')
        .toUpperCase()}). Attempting raw 2-bit decode.`
    );
  }

  if (
    header.hasHeader &&
    header.declaredLength !== header.actualPayloadLength &&
    header.declaredLength > 0
  ) {
    warnings.push(
      `Header declares ${header.declaredLength} payload bytes, but file contains ${header.actualPayloadLength} payload bytes.`
    );
  }

  const payloadStart = header.hasHeader ? 7 : 0;
  const payload = bytes.subarray(payloadStart);
  const digits = new Uint8Array(TOTAL_PIXELS);

  if (layout === 'cga_interleaved') {
    if (payload.length < CGA_ACTIVE_SIZE) {
      warnings.push(
        `Payload is ${payload.length} bytes (expected at least ${CGA_ACTIVE_SIZE} bytes for interleaved CGA). Missing scanlines padded with 0.`
      );
    }
    for (let y = 0; y < CGA_HEIGHT; y++) {
      const bankOffset = (y & 1) * CGA_BANK_SIZE + (y >> 1) * 80;
      const rowPixelBase = y * CGA_WIDTH;
      for (let bx = 0; bx < 80; bx++) {
        const idx = bankOffset + bx;
        const b = idx < payload.length ? payload[idx] : 0;
        const px = rowPixelBase + (bx << 2);
        digits[px] = (b >> 6) & 3;
        digits[px + 1] = (b >> 4) & 3;
        digits[px + 2] = (b >> 2) & 3;
        digits[px + 3] = b & 3;
      }
    }
  } else if (layout === 'qbasic_get_put') {
    const dataOffset = 4;
    if (payload.length < QBASIC_ARRAY_SIZE) {
      warnings.push(
        `Payload is ${payload.length} bytes (expected ${QBASIC_ARRAY_SIZE} bytes for 320x200 GET/PUT array).`
      );
    }
    for (let y = 0; y < CGA_HEIGHT; y++) {
      const rowByteBase = dataOffset + y * 80;
      const rowPixelBase = y * CGA_WIDTH;
      for (let bx = 0; bx < 80; bx++) {
        const idx = rowByteBase + bx;
        const b = idx < payload.length ? payload[idx] : 0;
        const px = rowPixelBase + (bx << 2);
        digits[px] = (b >> 6) & 3;
        digits[px + 1] = (b >> 4) & 3;
        digits[px + 2] = (b >> 2) & 3;
        digits[px + 3] = b & 3;
      }
    }
  } else {
    // Linear
    if (payload.length < CGA_LINEAR_SIZE) {
      warnings.push(
        `Payload is ${payload.length} bytes (expected ${CGA_LINEAR_SIZE} bytes for linear 320x200 2-bit dump).`
      );
    }
    for (let y = 0; y < CGA_HEIGHT; y++) {
      const rowByteBase = y * 80;
      const rowPixelBase = y * CGA_WIDTH;
      for (let bx = 0; bx < 80; bx++) {
        const idx = rowByteBase + bx;
        const b = idx < payload.length ? payload[idx] : 0;
        const px = rowPixelBase + (bx << 2);
        digits[px] = (b >> 6) & 3;
        digits[px + 1] = (b >> 4) & 3;
        digits[px + 2] = (b >> 2) & 3;
        digits[px + 3] = b & 3;
      }
    }
  }

  return {
    header,
    digits,
    warnings,
  };
}

/**
 * Generates an ImageData (320x200) directly from 2-bit digits (0..3) and a CGA palette.
 */
export function digitsToImageData(
  digits: Uint8Array,
  palette: CgaPalette
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = CGA_WIDTH;
  canvas.height = CGA_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(CGA_WIDTH, CGA_HEIGHT);
  const pixels = imgData.data;

  for (let i = 0; i < TOTAL_PIXELS; i++) {
    const col = palette.colors[digits[i] & 3].rgb;
    const pIdx = i * 4;
    pixels[pIdx] = col[0];
    pixels[pIdx + 1] = col[1];
    pixels[pIdx + 2] = col[2];
    pixels[pIdx + 3] = 255;
  }

  return imgData;
}

/**
 * Generates ready-to-run QBasic (.BAS) loader & saver example code for the chosen BSAVE layout.
 */
export function generateQBasicBsaveSnippet(
  filename: string,
  layout: BsaveLayout,
  palette: CgaPalette
): string {
  const dosName =
    filename
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 8) || 'CGAIMG';
  const bsvFile = `${dosName}.BSV`;

  const screen1ColorCmd: Record<string, string> = {
    cga_pal1_high: 'COLOR 8, 1',
    cga_pal1_low: 'COLOR 0, 1',
    cga_pal2_high: 'COLOR 8, 0',
    cga_pal2_low: 'COLOR 0, 0',
  };

  if (layout === 'cga_interleaved') {
    return [
      `REM ================================================================`,
      `REM QBasic 2-Bit 320x200 CGA BSAVE Loader & Saver (&HB800 Banked)`,
      `REM File: ${bsvFile} (7-byte BSAVE header + 16,384 bytes VRAM)`,
      `REM Palette: ${palette.name}`,
      `REM ================================================================`,
      `SCREEN 1`,
      screen1ColorCmd[palette.id] ?? `COLOR 0, 1`,
      ``,
      `' --- LOADER: Read BSAVE file directly into CGA Video Memory ---`,
      `DEF SEG = &HB800`,
      `BLOAD "${bsvFile}", 0`,
      `DEF SEG`,
      ``,
      `' Wait for keypress, then demonstrate SAVER:`,
      `WHILE INKEY$ = "": WEND`,
      ``,
      `' --- SAVER: Dump current 320x200 SCREEN 1 VRAM to BSAVE file ---`,
      `DEF SEG = &HB800`,
      `BSAVE "OUT_${dosName.slice(0, 4)}.BSV", 0, 16384`,
      `DEF SEG`,
    ].join('\n');
  }

  if (layout === 'qbasic_get_put') {
    return [
      `REM ================================================================`,
      `REM QBasic 2-Bit 320x200 GET/PUT Array BSAVE Loader & Saver`,
      `REM File: ${bsvFile} (7-byte BSAVE header + 16,004 bytes GET/PUT)`,
      `REM ================================================================`,
      `SCREEN 1`,
      screen1ColorCmd[palette.id] ?? `COLOR 0, 1`,
      `DIM img%(8001) ' 16,004 bytes = 8,002 integers`,
      ``,
      `' --- LOADER: BLOAD into array and blit via PUT ---`,
      `DEF SEG = VARSEG(img%(0))`,
      `BLOAD "${bsvFile}", VARPTR(img%(0))`,
      `DEF SEG`,
      `PUT (0, 0), img%, PSET`,
      ``,
      `' --- SAVER: Capture 320x200 screen and BSAVE ---`,
      `' GET (0, 0)-(319, 199), img%`,
      `' DEF SEG = VARSEG(img%(0))`,
      `' BSAVE "OUT_${dosName.slice(0, 4)}.BSV", VARPTR(img%(0)), 16004`,
      `' DEF SEG`,
    ].join('\n');
  }

  // Linear 16,000-byte loader
  return [
    `REM ================================================================`,
    `REM QBasic 2-Bit 320x200 Linear BSAVE Loader (16,000 bytes)`,
    `REM File: ${bsvFile} (7-byte header + 80 bytes/row * 200 rows)`,
    `REM ================================================================`,
    `SCREEN 1`,
    screen1ColorCmd[palette.id] ?? `COLOR 0, 1`,
    `DIM buf AS STRING * 16000`,
    `OPEN "${bsvFile}" FOR BINARY AS #1`,
    `SEEK #1, 8 ' Skip 7-byte BSAVE header (1-based index)`,
    `GET #1, , buf`,
    `CLOSE #1`,
    ``,
    `' Blit even/odd scanlines into CGA &HB800 video RAM:`,
    `DEF SEG = &HB800`,
    `FOR y% = 0 TO 199`,
    `  vramOff% = ((y% AND 1) * 8192) + ((y% \\ 2) * 80)`,
    `  srcOff% = y% * 80 + 1`,
    `  FOR bx% = 0 TO 79`,
    `    POKE vramOff% + bx%, ASC(MID$(buf, srcOff% + bx%, 1))`,
    `  NEXT bx%`,
    `NEXT y%`,
    `DEF SEG`,
  ].join('\n');
}
