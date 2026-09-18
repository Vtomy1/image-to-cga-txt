export interface CgaColor {
  index: 0 | 1 | 2 | 3;
  name: string;
  hex: string;
  rgb: [number, number, number];
}

export interface CgaPalette {
  id: string;
  name: string;
  category: 'cga' | 'retro' | 'custom';
  description: string;
  colors: [CgaColor, CgaColor, CgaColor, CgaColor];
}

export type DitherAlgorithm =
  | 'floyd-steinberg'
  | 'atkinson'
  | 'bayer-4x4'
  | 'bayer-8x8'
  | 'burkes'
  | 'sierra-lite'
  | 'none';

export type FitMode = 'stretch' | 'fit' | 'cover';

export type TxtExportFormat =
  | 'raw_grid' // 200 lines x 320 digits without spaces
  | 'space_separated' // 200 lines x 320 digits space-separated
  | 'comma_separated' // 200 lines x 320 digits comma-separated
  | 'c_array' // uint8_t image[200][320] = { ... }
  | 'basic_data' // 1000 DATA 0,1,2,3...
  | 'packed_hex' // 4 pixels per byte (2-bit), 80 bytes per row = 16,000 bytes
  | 'flat_stream'; // Single uninterrupted line of 64,000 digits

export interface ImageAdjustments {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  gamma: number; // 0.2 to 2.5
  invert: boolean;
  ditherStrength: number; // 0 to 1
  serpentine: boolean;
}

export interface DigitStats {
  counts: [number, number, number, number];
  percentages: [number, number, number, number];
  totalPixels: number;
}

export interface ProcessingResult {
  digits: Uint8Array; // length 320 * 200 = 64,000, values 0..3
  width: number;
  height: number;
  stats: DigitStats;
  imageData: ImageData;
  palette: CgaPalette;
}

export interface SampleImage {
  id: string;
  title: string;
  category: string;
  dataUrl: string;
}
