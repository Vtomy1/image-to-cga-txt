import React, { useState } from 'react';
import {
  Palette,
  Sliders,
  Sparkles,
  BarChart3,
  RotateCcw,
  Layers,
  Sun,
  Contrast,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import {
  CgaPalette,
  DitherAlgorithm,
  FitMode,
  ImageAdjustments,
  ProcessingResult,
} from '../types';
import { CGA_PALETTES, createCustomPalette } from '../constants/palettes';

interface ControlsPanelProps {
  currentPalette: CgaPalette;
  onSelectPalette: (palette: CgaPalette) => void;
  algorithm: DitherAlgorithm;
  onSelectAlgorithm: (alg: DitherAlgorithm) => void;
  fitMode: FitMode;
  onSelectFitMode: (fit: FitMode) => void;
  adjustments: ImageAdjustments;
  onChangeAdjustments: (adj: Partial<ImageAdjustments>) => void;
  onResetAdjustments: () => void;
  result: ProcessingResult | null;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  currentPalette,
  onSelectPalette,
  algorithm,
  onSelectAlgorithm,
  fitMode,
  onSelectFitMode,
  adjustments,
  onChangeAdjustments,
  onResetAdjustments,
  result,
}) => {
  const [activeTab, setActiveTab] = useState<'palette' | 'dither' | 'adjust' | 'stats'>('palette');
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);

  // Custom colors state
  const [customColors, setCustomColors] = useState<[string, string, string, string]>([
    '#000000',
    '#55ffff',
    '#ff55ff',
    '#ffffff',
  ]);

  const handleApplyCustomPalette = () => {
    const pal = createCustomPalette(
      'Custom Palette',
      customColors[0],
      customColors[1],
      customColors[2],
      customColors[3]
    );
    onSelectPalette(pal);
    setShowCustomModal(false);
  };

  return (
    <div
      id="controls-panel"
      className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xl flex flex-col"
    >
      {/* Navigation Tabs */}
      <div className="flex border-b border-neutral-800 bg-neutral-950 px-2 pt-2 gap-1 text-xs font-mono overflow-x-auto">
        <button
          id="tab-palette"
          onClick={() => setActiveTab('palette')}
          className={`px-3 py-2 rounded-t-lg flex items-center gap-1.5 transition-all border-t border-x ${
            activeTab === 'palette'
              ? 'bg-neutral-900 text-cyan-400 border-neutral-800 font-semibold shadow-sm'
              : 'text-neutral-400 border-transparent hover:text-neutral-200'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>CGA Palette</span>
        </button>

        <button
          id="tab-dither"
          onClick={() => setActiveTab('dither')}
          className={`px-3 py-2 rounded-t-lg flex items-center gap-1.5 transition-all border-t border-x ${
            activeTab === 'dither'
              ? 'bg-neutral-900 text-cyan-400 border-neutral-800 font-semibold shadow-sm'
              : 'text-neutral-400 border-transparent hover:text-neutral-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Dithering</span>
        </button>

        <button
          id="tab-adjust"
          onClick={() => setActiveTab('adjust')}
          className={`px-3 py-2 rounded-t-lg flex items-center gap-1.5 transition-all border-t border-x ${
            activeTab === 'adjust'
              ? 'bg-neutral-900 text-cyan-400 border-neutral-800 font-semibold shadow-sm'
              : 'text-neutral-400 border-transparent hover:text-neutral-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Adjustments</span>
        </button>

        <button
          id="tab-stats"
          onClick={() => setActiveTab('stats')}
          className={`px-3 py-2 rounded-t-lg flex items-center gap-1.5 transition-all border-t border-x ${
            activeTab === 'stats'
              ? 'bg-neutral-900 text-cyan-400 border-neutral-800 font-semibold shadow-sm'
              : 'text-neutral-400 border-transparent hover:text-neutral-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Digit Stats</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-4 flex-1">
        {/* 1. PALETTE TAB */}
        {activeTab === 'palette' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-neutral-400">
                SELECT 4-COLOR 2-BIT PALETTE:
              </span>
              <button
                id="btn-custom-palette-toggle"
                onClick={() => setShowCustomModal(!showCustomModal)}
                className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
              >
                {showCustomModal ? 'Close Custom' : 'Create Custom'}
              </button>
            </div>

            {/* Custom 4 Colors Editor (if open) */}
            {showCustomModal && (
              <div className="p-3 bg-neutral-950 border border-cyan-800/60 rounded-lg space-y-3">
                <span className="text-xs font-mono font-semibold text-cyan-300">
                  Custom 4-Color Definition (Digits 0..3)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono text-neutral-400">
                        Digit {idx}:
                      </label>
                      <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded border border-neutral-800">
                        <input
                          type="color"
                          value={customColors[idx]}
                          onChange={(e) => {
                            const newCols = [...customColors] as [
                              string,
                              string,
                              string,
                              string
                            ];
                            newCols[idx] = e.target.value;
                            setCustomColors(newCols);
                          }}
                          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <span className="text-[10px] font-mono text-neutral-300">
                          {customColors[idx]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleApplyCustomPalette}
                  className="w-full py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-xs font-mono font-semibold rounded transition-colors"
                >
                  Apply Custom 4-Color Palette
                </button>
              </div>
            )}

            {/* Predefined Palettes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CGA_PALETTES.map((pal) => {
                const isSelected = currentPalette.id === pal.id;
                return (
                  <button
                    key={pal.id}
                    id={`btn-select-pal-${pal.id}`}
                    onClick={() => onSelectPalette(pal)}
                    className={`p-2.5 rounded-lg text-left transition-all border ${
                      isSelected
                        ? 'bg-neutral-950 border-cyan-500 ring-1 ring-cyan-500 shadow-md shadow-cyan-950/40'
                        : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-950'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-white">
                        {pal.name}
                      </span>
                      {isSelected && (
                        <span className="text-[9px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-700 px-1.5 py-0.2 rounded">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    {/* 4 Swatches with Digits 0, 1, 2, 3 */}
                    <div className="grid grid-cols-4 gap-1 mb-1.5">
                      {pal.colors.map((c) => (
                        <div
                          key={c.index}
                          className="h-6 rounded border border-white/20 flex items-center justify-center relative overflow-hidden shadow-inner"
                          style={{ backgroundColor: c.hex }}
                          title={`Digit ${c.index}: ${c.name} (${c.hex})`}
                        >
                          <span
                            className="text-[10px] font-mono font-bold drop-shadow-md"
                            style={{
                              color:
                                c.hex === '#ffffff' || c.hex.includes('ff')
                                  ? '#000000'
                                  : '#ffffff',
                            }}
                          >
                            {c.index}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-neutral-400 line-clamp-1">
                      {pal.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Current Active Palette Details */}
            <div className="mt-3 p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 text-xs font-mono">
              <div className="text-neutral-400 text-[11px] mb-1.5">
                ACTIVE 2-BIT MAPPING TABLE:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {currentPalette.colors.map((col) => (
                  <div
                    key={col.index}
                    className="flex items-center gap-2 p-1.5 rounded bg-neutral-900 border border-neutral-800"
                  >
                    <div
                      className="w-5 h-5 rounded border border-white/20 flex items-center justify-center font-bold text-[10px] shadow-sm"
                      style={{
                        backgroundColor: col.hex,
                        color:
                          col.hex === '#ffffff' || col.hex.includes('ff')
                            ? '#000000'
                            : '#ffffff',
                      }}
                    >
                      {col.index}
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-[11px] text-neutral-200 truncate">
                        {col.name}
                      </span>
                      <span className="text-[9px] text-neutral-500">
                        {col.hex}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. DITHERING TAB */}
        {activeTab === 'dither' && (
          <div className="space-y-4 font-mono text-xs">
            {/* Algorithm selector */}
            <div>
              <label className="block text-neutral-400 text-[11px] mb-1.5">
                DITHERING ALGORITHM:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'floyd-steinberg', label: 'Floyd-Steinberg', desc: 'Classic error diffusion' },
                  { id: 'atkinson', label: 'Bill Atkinson', desc: 'High-contrast Mac retro look' },
                  { id: 'bayer-4x4', label: 'Bayer 4×4 Ordered', desc: 'Dot-matrix halftone pattern' },
                  { id: 'bayer-8x8', label: 'Bayer 8×8 Ordered', desc: 'Fine smooth pattern' },
                  { id: 'burkes', label: 'Burkes 7-Neighbor', desc: 'Wide smooth diffusion' },
                  { id: 'sierra-lite', label: 'Sierra Lite', desc: 'Crisp fast diffusion' },
                  { id: 'none', label: 'None (Threshold)', desc: 'Nearest color quantization' },
                ].map((item) => (
                  <button
                    key={item.id}
                    id={`btn-alg-${item.id}`}
                    onClick={() => onSelectAlgorithm(item.id as DitherAlgorithm)}
                    className={`p-2 rounded text-left transition-all border ${
                      algorithm === item.id
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-600 shadow-sm'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">
                      {item.label}
                    </div>
                    <div className="text-[10px] text-neutral-500 line-clamp-1">
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Dither Strength Slider */}
            <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-300 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                  Dither Intensity / Strength:
                </span>
                <span className="text-cyan-400 font-bold">
                  {Math.round((adjustments.ditherStrength ?? 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round((adjustments.ditherStrength ?? 1) * 100)}
                onChange={(e) =>
                  onChangeAdjustments({
                    ditherStrength: Number(e.target.value) / 100,
                  })
                }
                className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-500">
                <span>0% (Posterized)</span>
                <span>50% (Subtle)</span>
                <span>100% (Full Authentic)</span>
              </div>
            </div>

            {/* Serpentine Scan Toggle */}
            <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-lg border border-neutral-800">
              <div>
                <span className="text-neutral-200 font-semibold block">
                  Serpentine Zigzag Scan
                </span>
                <span className="text-[10px] text-neutral-500 block">
                  Reverses direction every row to eliminate directional banding artifacts.
                </span>
              </div>
              <button
                id="toggle-serpentine"
                onClick={() =>
                  onChangeAdjustments({ serpentine: !adjustments.serpentine })
                }
                className={`px-3 py-1 rounded text-xs transition-colors font-semibold border ${
                  adjustments.serpentine
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-600'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
              >
                {adjustments.serpentine ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>
        )}

        {/* 3. ADJUSTMENTS TAB */}
        {activeTab === 'adjust' && (
          <div className="space-y-4 font-mono text-xs">
            {/* Fit mode selector */}
            <div>
              <label className="block text-neutral-400 text-[11px] mb-1.5">
                IMAGE ASPECT FITTING (TO 320x200):
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'stretch', label: 'Stretch', desc: 'Exact 320×200 fill' },
                  { id: 'fit', label: 'Fit (Letterbox)', desc: 'Preserves aspect ratio with black digit 0' },
                  { id: 'cover', label: 'Cover (Crop)', desc: 'Fill without black bars' },
                ].map((item) => (
                  <button
                    key={item.id}
                    id={`btn-fit-${item.id}`}
                    onClick={() => onSelectFitMode(item.id as FitMode)}
                    className={`p-2 rounded text-left transition-all border ${
                      fitMode === item.id
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-600 shadow-sm'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">
                      {item.label}
                    </div>
                    <div className="text-[10px] text-neutral-500 line-clamp-1">
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders for Brightness, Contrast, Saturation, Gamma */}
            <div className="space-y-3 p-3 bg-neutral-950 rounded-lg border border-neutral-800">
              {/* Brightness */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-300 flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-amber-400" /> Brightness
                  </span>
                  <span className="text-cyan-400">{adjustments.brightness}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.brightness}
                  onChange={(e) =>
                    onChangeAdjustments({ brightness: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-300 flex items-center gap-1">
                    <Contrast className="w-3.5 h-3.5 text-blue-400" /> Contrast
                  </span>
                  <span className="text-cyan-400">{adjustments.contrast}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.contrast}
                  onChange={(e) =>
                    onChangeAdjustments({ contrast: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Saturation */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-300 flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5 text-pink-400" /> Saturation
                  </span>
                  <span className="text-cyan-400">{adjustments.saturation}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.saturation}
                  onChange={(e) =>
                    onChangeAdjustments({ saturation: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Gamma */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-300 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-purple-400" /> Gamma
                  </span>
                  <span className="text-cyan-400">{adjustments.gamma.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="250"
                  value={Math.round(adjustments.gamma * 100)}
                  onChange={(e) =>
                    onChangeAdjustments({ gamma: Number(e.target.value) / 100 })
                  }
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Invert toggle & Reset */}
            <div className="flex items-center justify-between gap-3">
              <button
                id="btn-toggle-invert"
                onClick={() =>
                  onChangeAdjustments({ invert: !adjustments.invert })
                }
                className={`px-3 py-1.5 rounded border text-xs font-mono transition-colors flex items-center gap-1.5 ${
                  adjustments.invert
                    ? 'bg-purple-950 text-purple-300 border-purple-600'
                    : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                }`}
              >
                <span>Invert Colors: {adjustments.invert ? 'ON' : 'OFF'}</span>
              </button>

              <button
                id="btn-reset-adjustments"
                onClick={onResetAdjustments}
                className="px-3 py-1.5 rounded border border-neutral-800 bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. DIGIT STATS TAB */}
        {activeTab === 'stats' && result && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
              <span className="text-neutral-400 text-[11px] block mb-2">
                2-BIT COLOR & DIGIT DISTRIBUTION (64,000 TOTAL PIXELS):
              </span>

              {/* Visual Proportion Bar */}
              <div className="h-4 w-full rounded-md overflow-hidden flex border border-neutral-700 mb-3 shadow-inner">
                {result.palette.colors.map((col) => {
                  const pct = result.stats.percentages[col.index];
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={col.index}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: col.hex,
                      }}
                      title={`Digit ${col.index} (${col.name}): ${pct}%`}
                    />
                  );
                })}
              </div>

              {/* 4 Digits breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.palette.colors.map((col) => {
                  const count = result.stats.counts[col.index];
                  const pct = result.stats.percentages[col.index];
                  return (
                    <div
                      key={col.index}
                      className="p-2 bg-neutral-900 rounded border border-neutral-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded border border-white/20 flex items-center justify-center font-bold text-[11px]"
                          style={{
                            backgroundColor: col.hex,
                            color:
                              col.hex === '#ffffff' || col.hex.includes('ff')
                                ? '#000000'
                                : '#ffffff',
                          }}
                        >
                          {col.index}
                        </span>
                        <div>
                          <div className="text-white font-semibold text-xs">
                            Digit '{col.index}'
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            {col.name} ({col.hex})
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-cyan-400 font-bold">{pct}%</div>
                        <div className="text-[10px] text-neutral-500">
                          {count.toLocaleString()} px
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Matrix Architecture Info */}
            <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
              <div className="text-neutral-200 font-semibold">
                IBM CGA Video Memory Architecture:
              </div>
              <p>
                • Framebuffer Resolution: 320 horizontal × 200 vertical scanlines
              </p>
              <p>• Pixel Format: 2 bits per pixel (values 0..3)</p>
              <p>• Raw Uncompressed Matrix: 64,000 ASCII digits</p>
              <p>
                • Packed Video Buffer: 16,000 bytes (80 bytes per row at memory
                segment B800:0000)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
