import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Info,
  CheckCircle2,
  AlertTriangle,
  Download,
  Code2,
  Copy,
  Check,
  FileJson,
  FileCode,
} from 'lucide-react';
import { ProcessingResult } from '../types';
import { downloadFile } from '../utils/cgaDither';
import { getContrastTextColor } from '../constants/palettes';

interface ColorDistributionWidgetProps {
  result: ProcessingResult | null;
}

export const ColorDistributionWidget: React.FC<ColorDistributionWidgetProps> = ({ result }) => {
  const [previewFormat, setPreviewFormat] = useState<'json' | 'css' | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<'json' | 'css' | null>(null);

  const exportedSnippets = useMemo(() => {
    if (!result) return null;
    const { palette, stats } = result;
    const safeId = palette.id.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase();

    const jsonPayload = {
      name: palette.name,
      id: palette.id,
      category: palette.category,
      description: palette.description,
      colors: palette.colors.map((c) => ({
        digit: c.index,
        name: c.name,
        hex: c.hex,
        rgb: c.rgb,
        usage: {
          pixels: stats.counts[c.index],
          percentage: stats.percentages[c.index],
        },
      })),
    };
    const jsonText = JSON.stringify(jsonPayload, null, 2);

    const usedSlugs = new Set<string>();
    const aliasLines = palette.colors.map((c) => {
      let slug = c.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!slug || usedSlugs.has(slug)) {
        slug = `${slug || 'color'}-${c.index}`;
      }
      usedSlugs.add(slug);
      return `  --cga-${slug}: ${c.hex};`;
    });

    const cssLines = [
      `/* ${palette.name} (${palette.id}) — 2-Bit CGA 4-Color Palette */`,
      `:root {`,
      ...palette.colors.map(
        (c) =>
          `  --cga-color-${c.index}: ${c.hex}; /* Digit ${c.index}: ${c.name} (${stats.percentages[c.index]}%) */`
      ),
      ...palette.colors.map(
        (c) => `  --cga-color-${c.index}-rgb: ${c.rgb.join(', ')};`
      ),
      ``,
      `  /* Named Aliases */`,
      ...aliasLines,
      `}`,
    ];
    const cssText = cssLines.join('\n');

    return {
      safeId,
      jsonText,
      jsonFilename: `cga_palette_${safeId}.json`,
      cssText,
      cssFilename: `cga_palette_${safeId}.css`,
    };
  }, [result]);

  if (!result || !exportedSnippets) {
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

  const handleDownloadJson = () => {
    downloadFile(
      exportedSnippets.jsonText,
      exportedSnippets.jsonFilename,
      'application/json'
    );
  };

  const handleDownloadCss = () => {
    downloadFile(
      exportedSnippets.cssText,
      exportedSnippets.cssFilename,
      'text/css'
    );
  };

  const handleCopySnippet = (fmt: 'json' | 'css') => {
    const content = fmt === 'json' ? exportedSnippets.jsonText : exportedSnippets.cssText;
    navigator.clipboard.writeText(content);
    setCopiedFormat(fmt);
    setTimeout(() => setCopiedFormat(null), 1800);
  };

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
                      color: getContrastTextColor(col.rgb),
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
                    color: getContrastTextColor(col.rgb),
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

      {/* Palette Export Bar (JSON / CSS Variables) */}
      <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
            <Code2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="uppercase font-semibold text-neutral-300">
              Export 4-Color Palette:
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="btn-export-palette-json"
              onClick={handleDownloadJson}
              className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border border-neutral-700 hover:border-cyan-600/70 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title={`Download ${exportedSnippets.jsonFilename}`}
            >
              <FileJson className="w-3 h-3 text-cyan-400" />
              <span>.JSON</span>
              <Download className="w-2.5 h-2.5 opacity-75" />
            </button>

            <button
              id="btn-export-palette-css"
              onClick={handleDownloadCss}
              className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-purple-300 border border-neutral-700 hover:border-purple-600/70 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title={`Download ${exportedSnippets.cssFilename}`}
            >
              <FileCode className="w-3 h-3 text-purple-400" />
              <span>.CSS</span>
              <Download className="w-2.5 h-2.5 opacity-75" />
            </button>

            <button
              id="btn-preview-palette-code"
              onClick={() =>
                setPreviewFormat((prev) =>
                  prev === null ? 'css' : prev === 'css' ? 'json' : null
                )
              }
              className={`px-2 py-1 rounded border text-[10px] transition-colors cursor-pointer ${
                previewFormat
                  ? 'bg-cyan-950/70 text-cyan-300 border-cyan-700'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border-neutral-800'
              }`}
              title="Preview or copy JSON / CSS palette code"
            >
              {previewFormat ? `Hide (${previewFormat.toUpperCase()})` : 'Preview'}
            </button>
          </div>
        </div>

        {/* Expandable Code Preview & Copy */}
        {previewFormat && (
          <div className="border-t border-neutral-800 pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPreviewFormat('css')}
                  className={`px-2 py-0.5 rounded border cursor-pointer ${
                    previewFormat === 'css'
                      ? 'bg-purple-950/60 text-purple-300 border-purple-700 font-bold'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                  }`}
                >
                  CSS Variables
                </button>
                <button
                  onClick={() => setPreviewFormat('json')}
                  className={`px-2 py-0.5 rounded border cursor-pointer ${
                    previewFormat === 'json'
                      ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700 font-bold'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                  }`}
                >
                  JSON
                </button>
              </div>

              <button
                id="btn-copy-palette-snippet"
                onClick={() => handleCopySnippet(previewFormat)}
                className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 flex items-center gap-1 cursor-pointer"
              >
                {copiedFormat === previewFormat ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-neutral-400" />
                    <span>Copy {previewFormat.toUpperCase()}</span>
                  </>
                )}
              </button>
            </div>

            <pre className="bg-black border border-neutral-800 rounded p-2 text-[10px] text-neutral-300 overflow-x-auto max-h-40 leading-relaxed select-all">
              {previewFormat === 'json'
                ? exportedSnippets.jsonText
                : exportedSnippets.cssText}
            </pre>
          </div>
        )}
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
