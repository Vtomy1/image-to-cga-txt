import React from 'react';
import { BarChart3, Info, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { ProcessingResult } from '../types';

interface ColorDistributionWidgetProps {
  result: ProcessingResult | null;
}

export const ColorDistributionWidget: React.FC<ColorDistributionWidgetProps> = ({ result }) => {
  if (!result) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-xs font-mono text-neutral-500 flex items-center justify-center gap-2">
        <BarChart3 className="w-4 h-4 animate-pulse text-cyan-500" />
        <span>Awaiting 320×200 image quantization...</span>
      </div>
    );
  }

  const { stats, palette } = result;
  const { counts, percentages, totalPixels } = stats;

  // Derive optimization feedback to help user tune dithering
  const zeroColor = counts.filter((c) => c === 0).length;
  const lowColors = percentages.filter((p) => p > 0 && p < 2.0).length;
  const dominantIndex = percentages.findIndex((p) => p >= 65);
  const minPct = Math.min(...percentages);
  const maxPct = Math.max(...percentages);

  let advice: { type: 'success' | 'warning' | 'info'; message: string; tip?: string } = {
    type: 'success',
    message: 'Well-balanced 4-color distribution across the 64,000-pixel grid.',
    tip: 'Error diffusion algorithms (Floyd-Steinberg / Atkinson) produce smooth transitions.',
  };

  if (dominantIndex !== -1) {
    const domColor = palette.colors[dominantIndex];
    if (dominantIndex === 0) {
      advice = {
        type: 'warning',
        message: `Heavy shadow clipping: Digit 0 (${domColor.name}) covers ${percentages[0]}% of the frame.`,
        tip: 'Try increasing Brightness (+15..+35) or Gamma (>1.2) in the Adjustments tab to lift midtones.',
      };
    } else if (dominantIndex === 3) {
      advice = {
        type: 'warning',
        message: `Highlight blowout: Digit 3 (${domColor.name}) occupies ${percentages[3]}% of the frame.`,
        tip: 'Try decreasing Brightness or reducing Contrast to prevent white highlights from crushing.',
      };
    } else {
      advice = {
        type: 'warning',
        message: `Digit ${dominantIndex} (${domColor.name}) dominates at ${percentages[dominantIndex]}%.`,
        tip: 'Adjust Saturation or Gamma to balance the color diffusion spread.',
      };
    }
  } else if (zeroColor > 0) {
    const missingIndex = counts.findIndex((c) => c === 0);
    const missingColor = palette.colors[missingIndex];
    advice = {
      type: 'warning',
      message: `Digit ${missingIndex} (${missingColor.name}) has 0 pixels in the output!`,
      tip: 'Increase Contrast or adjust Saturation so the dither engine reaches this color threshold.',
    };
  } else if (lowColors > 0) {
    const lowIndex = percentages.findIndex((p) => p > 0 && p < 2.0);
    const lowColor = palette.colors[lowIndex];
    advice = {
      type: 'info',
      message: `Digit ${lowIndex} (${lowColor.name}) is sparsely used (${percentages[lowIndex]}%).`,
      tip: 'Increase Dither Strength (to 100%) or enable Atkinson / Bayer to amplify subtle pixel patterns.',
    };
  } else if (maxPct - minPct <= 25) {
    advice = {
      type: 'success',
      message: 'Optimal 4-color parity: all 4 CGA levels are actively engaged.',
      tip: 'Try switching between Bayer 8×8 and Floyd-Steinberg to test dither grain aesthetics.',
    };
  }

  return (
    <div
      id="color-distribution-widget"
      className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xl p-3.5 sm:p-4 flex flex-col gap-3 font-mono"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wide">
            CGA Color Distribution
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded text-neutral-400">
            <strong className="text-cyan-400 font-semibold">{totalPixels.toLocaleString()}</strong> px total
          </span>
        </div>
      </div>

      {/* Segmented 100% Proportion Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-neutral-400">
          <span>2-BIT MATRIX RATIO</span>
          <span className="text-neutral-500">Ideal balance ~25% each</span>
        </div>
        <div className="h-4.5 w-full bg-neutral-950 rounded-md overflow-hidden flex border border-neutral-800 shadow-inner">
          {palette.colors.map((col) => {
            const pct = percentages[col.index];
            if (pct <= 0) return null;
            return (
              <div
                key={col.index}
                style={{
                  width: `${pct}%`,
                  backgroundColor: col.hex,
                }}
                className="h-full flex items-center justify-center transition-all duration-300 relative group"
                title={`Digit ${col.index} (${col.name}): ${counts[col.index].toLocaleString()} px (${pct}%)`}
              >
                {pct >= 9 && (
                  <span
                    className="text-[9px] font-bold drop-shadow-sm px-0.5 select-none"
                    style={{
                      color:
                        col.hex === '#ffffff' || col.hex.includes('ff')
                          ? '#000000'
                          : '#ffffff',
                    }}
                  >
                    {pct}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4 Color Swatch Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {palette.colors.map((col) => {
          const count = counts[col.index];
          const pct = percentages[col.index];
          const isDominant = pct >= 50;
          const isScarce = pct < 2;

          return (
            <div
              key={col.index}
              className={`p-2 rounded-lg bg-neutral-950/80 border transition-all ${
                isDominant
                  ? 'border-cyan-600/60 ring-1 ring-cyan-500/30'
                  : isScarce
                  ? 'border-neutral-800/80 opacity-75'
                  : 'border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className="w-5 h-5 rounded border border-white/20 flex items-center justify-center font-black text-[11px] shadow-sm flex-shrink-0"
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
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-neutral-200 font-semibold truncate leading-none">
                    {col.name}
                  </div>
                  <div className="text-[9px] text-neutral-500 truncate leading-tight">
                    {col.hex}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xs font-bold text-white tracking-tight">
                  {pct}%
                </span>
                <span className="text-[10px] text-neutral-400">
                  {count.toLocaleString()}
                </span>
              </div>

              {/* Mini visual indicator bar */}
              <div className="w-full bg-neutral-900 rounded-full h-1 mt-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    backgroundColor: col.hex,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Dithering Optimization Insight / Hint */}
      <div
        className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-2 ${
          advice.type === 'warning'
            ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
            : advice.type === 'info'
            ? 'bg-cyan-950/30 border-cyan-800/60 text-cyan-200'
            : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
        }`}
      >
        {advice.type === 'warning' ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
        ) : advice.type === 'info' ? (
          <Info className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 space-y-0.5 leading-tight">
          <p className="font-semibold">{advice.message}</p>
          {advice.tip && (
            <p className="text-[10px] opacity-85">
              <span className="underline font-bold">Optimization Tip:</span> {advice.tip}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
