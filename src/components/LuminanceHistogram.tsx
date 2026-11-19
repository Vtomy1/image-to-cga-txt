import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface LuminanceHistogramProps {
  sourceImage: HTMLImageElement | null;
  imageLabel?: string;
}

interface HistogramData {
  bins64: number[]; // 64 bins (each covers 4 luma levels)
  maxBinCount: number;
  totalPixels: number;
  meanLuma: number;
  shadowsPct: number; // 0..84
  midtonesPct: number; // 85..170
  highlightsPct: number; // 171..255
  shadowClipPct: number; // 0..10
  highlightClipPct: number; // 245..255
  dynamicRange: number; // P95 - P5
}

const BIN_COUNT = 64;
const SAMPLE_MAX_DIM = 320;

export const LuminanceHistogram: React.FC<LuminanceHistogramProps> = ({
  sourceImage,
  imageLabel,
}) => {
  const [scaleMode, setScaleMode] = useState<'linear' | 'log'>('linear');
  const [hoverBin, setHoverBin] = useState<number | null>(null);

  const histogram: HistogramData | null = useMemo(() => {
    if (!sourceImage) return null;

    const srcW = sourceImage.naturalWidth || sourceImage.width;
    const srcH = sourceImage.naturalHeight || sourceImage.height;
    if (!srcW || !srcH) return null;

    // Downscale large images to <= 320px for fast, accurate luminance sampling
    const scale = Math.min(1, SAMPLE_MAX_DIM / Math.max(srcW, srcH));
    const sampleW = Math.max(1, Math.round(srcW * scale));
    const sampleH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(sourceImage, 0, 0, sampleW, sampleH);
    const data = ctx.getImageData(0, 0, sampleW, sampleH).data;

    const bins256 = new Uint32Array(256);
    const bins64 = new Array<number>(BIN_COUNT).fill(0);

    let lumaSum = 0;
    let shadowsCount = 0;
    let midtonesCount = 0;
    let highlightsCount = 0;
    let shadowClipCount = 0;
    let highlightClipCount = 0;

    const totalPixels = sampleW * sampleH;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      // Blend transparent pixels against black matching preprocessImage behavior
      const r = data[i] * a;
      const g = data[i + 1] * a;
      const b = data[i + 2] * a;

      // Rec. 709 perceived luminance (0..255)
      const luma = Math.max(
        0,
        Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b))
      );

      bins256[luma]++;
      bins64[luma >> 2]++;
      lumaSum += luma;

      if (luma <= 84) shadowsCount++;
      else if (luma <= 170) midtonesCount++;
      else highlightsCount++;

      if (luma <= 10) shadowClipCount++;
      if (luma >= 245) highlightClipCount++;
    }

    // Compute P5 and P95 percentiles for dynamic range span
    const p5Target = totalPixels * 0.05;
    const p95Target = totalPixels * 0.95;
    let cumulative = 0;
    let p5 = 0;
    let p95 = 255;
    let foundP5 = false;

    for (let l = 0; l < 256; l++) {
      cumulative += bins256[l];
      if (!foundP5 && cumulative >= p5Target) {
        p5 = l;
        foundP5 = true;
      }
      if (cumulative >= p95Target) {
        p95 = l;
        break;
      }
    }

    const maxBinCount = Math.max(1, ...bins64);

    return {
      bins64,
      maxBinCount,
      totalPixels,
      meanLuma: Math.round(lumaSum / totalPixels),
      shadowsPct: Number(((shadowsCount / totalPixels) * 100).toFixed(1)),
      midtonesPct: Number(((midtonesCount / totalPixels) * 100).toFixed(1)),
      highlightsPct: Number(((highlightsCount / totalPixels) * 100).toFixed(1)),
      shadowClipPct: Number(((shadowClipCount / totalPixels) * 100).toFixed(1)),
      highlightClipPct: Number(((highlightClipCount / totalPixels) * 100).toFixed(1)),
      dynamicRange: Math.max(0, p95 - p5),
    };
  }, [sourceImage]);

  if (!histogram) {
    return (
      <div
        id="luminance-histogram-widget"
        className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-xs font-mono text-neutral-500 flex items-center justify-center gap-2"
      >
        <Activity className="w-4 h-4 animate-pulse text-cyan-500" />
        <span>Awaiting original image luminance data...</span>
      </div>
    );
  }

  // Build adjustment insight from pre-process luminance profile
  let insight: { type: 'info' | 'warning' | 'success'; text: string } = {
    type: 'success',
    text: 'Balanced tonal curve — ready for direct 2-bit dithering.',
  };

  if (histogram.shadowClipPct >= 25 && histogram.meanLuma < 85) {
    insight = {
      type: 'warning',
      text: `Dark source (${histogram.shadowsPct}% shadows). Raise Brightness (+15..+35) or Gamma (>1.2) to preserve detail.`,
    };
  } else if (histogram.highlightClipPct >= 25 && histogram.meanLuma > 175) {
    insight = {
      type: 'warning',
      text: `Bright source (${histogram.highlightsPct}% highlights). Lower Brightness or Gamma (<0.9) to prevent clipping.`,
    };
  } else if (histogram.dynamicRange < 95) {
    insight = {
      type: 'info',
      text: `Narrow contrast span (${histogram.dynamicRange}/255). Boost Contrast (+20..+45) to engage all 4 CGA levels.`,
    };
  } else if (histogram.midtonesPct < 15 && histogram.shadowsPct > 35 && histogram.highlightsPct > 35) {
    insight = {
      type: 'info',
      text: 'High-contrast bimodal input. Lower Contrast slightly or use Floyd-Steinberg for smoother transitions.',
    };
  }

  const meanPct = Math.round((histogram.meanLuma / 255) * 100);
  const svgWidth = 256;
  const svgHeight = 68;
  const barWidth = svgWidth / BIN_COUNT;

  const hoverRangeStart = hoverBin !== null ? hoverBin * 4 : 0;
  const hoverRangeEnd = hoverBin !== null ? hoverBin * 4 + 3 : 0;
  const hoverPct =
    hoverBin !== null
      ? ((histogram.bins64[hoverBin] / histogram.totalPixels) * 100).toFixed(1)
      : null;

  return (
    <div
      id="luminance-histogram-widget"
      className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xl p-3.5 sm:p-4 flex flex-col gap-3 font-mono"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wide truncate">
            Source Luminance
          </h3>
          <span className="text-[9px] bg-neutral-950 border border-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded flex-shrink-0">
            PRE-PROCESS
          </span>
        </div>

        <div className="flex items-center gap-2">
          {imageLabel && (
            <span className="text-[10px] text-neutral-500 truncate max-w-[110px]" title={imageLabel}>
              {imageLabel}
            </span>
          )}
          <span className="text-[10px] bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded text-neutral-400">
            AVG: <strong className="text-amber-300">{histogram.meanLuma}</strong> ({meanPct}%)
          </span>

          {/* Linear / Log scale toggle */}
          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded p-0.5 text-[9px]">
            <button
              type="button"
              onClick={() => setScaleMode('linear')}
              className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                scaleMode === 'linear'
                  ? 'bg-neutral-800 text-cyan-300 font-bold'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
              title="Linear vertical scale"
            >
              LIN
            </button>
            <button
              type="button"
              onClick={() => setScaleMode('log')}
              className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                scaleMode === 'log'
                  ? 'bg-neutral-800 text-cyan-300 font-bold'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
              title="Logarithmic scale (reveals subtle tonal peaks)"
            >
              LOG
            </button>
          </div>
        </div>
      </div>

      {/* SVG Histogram Chart */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-neutral-500 h-4">
          {hoverBin !== null ? (
            <span className="text-cyan-300 font-semibold">
              Luma {hoverRangeStart}–{hoverRangeEnd}: <strong className="text-white">{hoverPct}%</strong> of pixels
            </span>
          ) : (
            <span>0 (Black) → 255 (White)</span>
          )}
          <span>Span: <strong className="text-neutral-300">{histogram.dynamicRange}</strong>/255</span>
        </div>

        <div
          className="relative w-full"
          onMouseLeave={() => setHoverBin(null)}
        >
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-20 block overflow-visible"
            preserveAspectRatio="none"
          >
            {/* Subtle zone background dividers (Shadows | Midtones | Highlights) */}
            <line
              x1={svgWidth / 3}
              y1={0}
              x2={svgWidth / 3}
              y2={svgHeight}
              stroke="#262626"
              strokeDasharray="2 2"
              strokeWidth={0.75}
            />
            <line
              x1={(svgWidth * 2) / 3}
              y1={0}
              x2={(svgWidth * 2) / 3}
              y2={svgHeight}
              stroke="#262626"
              strokeDasharray="2 2"
              strokeWidth={0.75}
            />

            {/* Mean luminance marker line */}
            <line
              x1={(histogram.meanLuma / 255) * svgWidth}
              y1={0}
              x2={(histogram.meanLuma / 255) * svgWidth}
              y2={svgHeight}
              stroke="#f59e0b"
              strokeOpacity={0.45}
              strokeWidth={1}
            />

            {/* 64 Luminance Histogram Bars */}
            {histogram.bins64.map((count, idx) => {
              const ratio =
                scaleMode === 'log'
                  ? Math.log1p(count) / Math.log1p(histogram.maxBinCount)
                  : count / histogram.maxBinCount;
              const barH = count === 0 ? 0 : Math.max(1.5, ratio * (svgHeight - 2));
              const y = svgHeight - barH;
              const x = idx * barWidth;

              // Luminance shade from dark slate to bright silver/cyan
              const lumaMid = idx * 4 + 2;
              const shade = Math.round(70 + (lumaMid / 255) * 185);
              const isHovered = hoverBin === idx;

              return (
                <g
                  key={idx}
                  onMouseEnter={() => setHoverBin(idx)}
                  className="cursor-crosshair"
                >
                  {/* Full-height invisible hit target for easy hovering */}
                  <rect
                    x={x}
                    y={0}
                    width={barWidth}
                    height={svgHeight}
                    fill="transparent"
                  />
                  {barH > 0 && (
                    <rect
                      x={x + 0.35}
                      y={y}
                      width={Math.max(1, barWidth - 0.7)}
                      height={barH}
                      rx={0.5}
                      fill={
                        isHovered
                          ? '#22d3ee'
                          : `rgb(${shade}, ${Math.min(255, shade + 8)}, ${Math.min(
                              255,
                              shade + 14
                            )})`
                      }
                      fillOpacity={isHovered ? 1 : 0.85}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Bottom Black-to-White Luminance Gradient Scale */}
          <div
            className="w-full h-1.5 rounded-full mt-1 border border-neutral-800"
            style={{
              background: 'linear-gradient(to right, #000000 0%, #808080 50%, #ffffff 100%)',
            }}
          />
        </div>
      </div>

      {/* Shadows / Midtones / Highlights Breakdown */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="p-2 rounded-lg bg-neutral-950/80 border border-neutral-800 flex flex-col">
          <span className="text-[9px] text-neutral-500 uppercase">Shadows (0–84)</span>
          <span className="text-xs font-bold text-neutral-200 mt-0.5">
            {histogram.shadowsPct}%
          </span>
        </div>
        <div className="p-2 rounded-lg bg-neutral-950/80 border border-neutral-800 flex flex-col">
          <span className="text-[9px] text-neutral-500 uppercase">Midtones (85–170)</span>
          <span className="text-xs font-bold text-cyan-300 mt-0.5">
            {histogram.midtonesPct}%
          </span>
        </div>
        <div className="p-2 rounded-lg bg-neutral-950/80 border border-neutral-800 flex flex-col">
          <span className="text-[9px] text-neutral-500 uppercase">Highlights (171+)</span>
          <span className="text-xs font-bold text-white mt-0.5">
            {histogram.highlightsPct}%
          </span>
        </div>
      </div>

      {/* Actionable Pre-Process Guidance */}
      <div
        className={`px-2.5 py-2 rounded-lg border text-[11px] flex items-start gap-2 ${
          insight.type === 'warning'
            ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
            : insight.type === 'info'
            ? 'bg-cyan-950/30 border-cyan-800/60 text-cyan-200'
            : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
        }`}
      >
        {insight.type === 'warning' ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
        ) : insight.type === 'info' ? (
          <Info className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
        )}
        <span className="leading-tight text-[10px]">{insight.text}</span>
      </div>
    </div>
  );
};
