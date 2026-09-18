import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Tv,
  Grid3X3,
  Columns,
  Hash,
  Eye,
  Info,
} from 'lucide-react';
import { ProcessingResult } from '../types';
import { CGA_HEIGHT, CGA_WIDTH } from '../utils/cgaDither';

interface ViewportCanvasProps {
  result: ProcessingResult | null;
  sourceImage: HTMLImageElement | null;
  crtEffect: boolean;
  onToggleCrt: () => void;
  showPixelGrid: boolean;
  onTogglePixelGrid: () => void;
  aspectRatio43: boolean;
  onToggleAspectRatio: () => void;
}

export type ViewMode = 'cga' | 'split' | 'digits';

export const ViewportCanvas: React.FC<ViewportCanvasProps> = ({
  result,
  sourceImage,
  crtEffect,
  onToggleCrt,
  showPixelGrid,
  onTogglePixelGrid,
  aspectRatio43,
  onToggleAspectRatio,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const splitOriginalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('cga');
  const [zoom, setZoom] = useState<number>(2.5);
  const [splitPos, setSplitPos] = useState<number>(50); // percentage 0 to 100
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);

  // Hover pixel probe info
  const [hoverPixel, setHoverPixel] = useState<{
    x: number;
    y: number;
    digit: number;
    colorName: string;
    hex: string;
  } | null>(null);

  // Render processed 320x200 ImageData onto the main canvas
  useEffect(() => {
    if (!result || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.putImageData(result.imageData, 0, 0);
  }, [result]);

  // Render scaled original for split view comparison
  useEffect(() => {
    if (!sourceImage || !splitOriginalCanvasRef.current) return;
    const canvas = splitOriginalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CGA_WIDTH, CGA_HEIGHT);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceImage, 0, 0, CGA_WIDTH, CGA_HEIGHT);
  }, [sourceImage]);

  // Handle canvas mouse move for pixel coordinate inspection
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!result || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (
      clientX < 0 ||
      clientX >= rect.width ||
      clientY < 0 ||
      clientY >= rect.height
    ) {
      setHoverPixel(null);
      return;
    }

    const x = Math.floor((clientX / rect.width) * CGA_WIDTH);
    const y = Math.floor((clientY / rect.height) * CGA_HEIGHT);

    if (x >= 0 && x < CGA_WIDTH && y >= 0 && y < CGA_HEIGHT) {
      const idx = y * CGA_WIDTH + x;
      const digit = result.digits[idx];
      const color = result.palette.colors[digit];
      setHoverPixel({
        x,
        y,
        digit,
        colorName: color?.name ?? 'Unknown',
        hex: color?.hex ?? '#000000',
      });
    }
  };

  const handleMouseLeave = () => {
    setHoverPixel(null);
  };

  // Split view dragging
  const handleSplitMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingSplit || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pos = Math.max(
        0,
        Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
      );
      setSplitPos(pos);
    },
    [isDraggingSplit]
  );

  const handleSplitMouseUp = useCallback(() => {
    setIsDraggingSplit(false);
  }, []);

  useEffect(() => {
    if (isDraggingSplit) {
      window.addEventListener('mousemove', handleSplitMouseMove);
      window.addEventListener('mouseup', handleSplitMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleSplitMouseMove);
        window.removeEventListener('mouseup', handleSplitMouseUp);
      };
    }
  }, [isDraggingSplit, handleSplitMouseMove, handleSplitMouseUp]);

  // Pixel aspect ratio styling:
  // Standard 320x200 is 1.6:1.
  // CGA CRT 4:3 aspect ratio stretches vertical 200 lines to match standard 4:3 (equivalent to 320 x 240, scaleY: 1.2)
  const displayScaleY = aspectRatio43 ? 1.2 : 1.0;

  return (
    <div
      id="viewport-canvas-container"
      className="flex flex-col bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl relative"
    >
      {/* Viewport Top Bar / View Modes & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-neutral-900/80 border-b border-neutral-800 text-xs font-mono">
        {/* Left: View Mode Tabs */}
        <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-lg border border-neutral-800">
          <button
            id="view-mode-cga"
            onClick={() => setViewMode('cga')}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-all ${
              viewMode === 'cga'
                ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>2-Bit CGA</span>
          </button>
          <button
            id="view-mode-split"
            onClick={() => setViewMode('split')}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-all ${
              viewMode === 'split'
                ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Split Compare</span>
          </button>
          <button
            id="view-mode-digits"
            onClick={() => setViewMode('digits')}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-all ${
              viewMode === 'digits'
                ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Inspect 0, 1, 2, 3 digits matrix"
          >
            <Hash className="w-3.5 h-3.5 text-cyan-400" />
            <span>Digits Matrix</span>
          </button>
        </div>

        {/* Right: CRT, Grid, Aspect Ratio, Zoom */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* 4:3 CRT Aspect Ratio Toggle */}
          <button
            id="btn-toggle-aspect"
            onClick={onToggleAspectRatio}
            title={
              aspectRatio43
                ? 'Current: CRT 4:3 Aspect Ratio (1:1.2 pixel aspect ratio)'
                : 'Current: Square Pixels (16:10 / 320x200 native)'
            }
            className={`px-2 py-1 rounded border text-[11px] font-mono transition-colors flex items-center gap-1 ${
              aspectRatio43
                ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
          >
            <span>{aspectRatio43 ? '4:3 CRT Ratio' : '1:1 Pixels'}</span>
          </button>

          {/* CRT Scanline Toggle */}
          <button
            id="btn-toggle-crt"
            onClick={onToggleCrt}
            title="Toggle CRT phosphor scanlines effect"
            className={`p-1.5 rounded border transition-colors ${
              crtEffect
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
          </button>

          {/* Pixel Grid Toggle */}
          <button
            id="btn-toggle-grid"
            onClick={onTogglePixelGrid}
            title="Toggle individual pixel grid borders"
            className={`p-1.5 rounded border transition-colors ${
              showPixelGrid
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded px-1 text-[11px]">
            <button
              id="btn-zoom-out"
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}
              className="p-1 text-neutral-400 hover:text-white"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 text-neutral-300 min-w-[28px] text-center">
              {zoom}x
            </span>
            <button
              id="btn-zoom-in"
              onClick={() => setZoom((z) => Math.min(6, +(z + 0.5).toFixed(1)))}
              className="p-1 text-neutral-400 hover:text-white"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              id="btn-zoom-reset"
              onClick={() => setZoom(2)}
              className="px-1 text-[10px] text-neutral-500 hover:text-cyan-400"
              title="Reset zoom to 2x"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Screen Canvas Display Area */}
      <div
        ref={containerRef}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full min-h-[380px] max-h-[580px] flex items-center justify-center p-4 bg-radial from-neutral-900 to-neutral-950 overflow-auto relative select-none"
      >
        {/* CRT Curved Bezel Outer Frame */}
        <div
          className={`relative border-4 border-neutral-800/80 rounded-xl overflow-hidden transition-transform duration-100 ${
            crtEffect ? 'crt-glow shadow-cyan-950/20' : 'shadow-2xl'
          }`}
          style={{
            transform: `scaleY(${displayScaleY})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Main 320x200 Canvas */}
          <canvas
            ref={canvasRef}
            id="cga-main-canvas"
            width={CGA_WIDTH}
            height={CGA_HEIGHT}
            className={`pixelated block transition-all ${
              showPixelGrid ? 'outline outline-1 outline-neutral-700/50' : ''
            }`}
            style={{
              width: `${CGA_WIDTH * zoom}px`,
              height: `${CGA_HEIGHT * zoom}px`,
            }}
          />

          {/* Split Mode Comparison Overlay */}
          {viewMode === 'split' && (
            <>
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ width: `${splitPos}%` }}
              >
                <canvas
                  ref={splitOriginalCanvasRef}
                  width={CGA_WIDTH}
                  height={CGA_HEIGHT}
                  className="pixelated block"
                  style={{
                    width: `${CGA_WIDTH * zoom}px`,
                    height: `${CGA_HEIGHT * zoom}px`,
                  }}
                />
                <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm border border-neutral-700 px-2 py-0.5 rounded text-[10px] text-white font-mono uppercase">
                  Original Image
                </div>
              </div>
              <div className="absolute top-2 right-2 bg-cyan-950/90 backdrop-blur-sm border border-cyan-700/80 px-2 py-0.5 rounded text-[10px] text-cyan-300 font-mono uppercase pointer-events-none">
                2-Bit CGA
              </div>
              {/* Split Dragger Line */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-cyan-400 cursor-ew-resize z-20 shadow-lg flex items-center justify-center"
                style={{ left: `${splitPos}%`, transform: 'translateX(-50%)' }}
                onMouseDown={() => setIsDraggingSplit(true)}
              >
                <div className="w-5 h-7 rounded-md bg-neutral-900 border border-cyan-400 flex items-center justify-center shadow-md">
                  <Columns className="w-3 h-3 text-cyan-400" />
                </div>
              </div>
            </>
          )}

          {/* Digit Matrix Zoom Overlay Mode */}
          {viewMode === 'digits' && result && (
            <div
              id="digit-matrix-overlay"
              className="absolute inset-0 pointer-events-none flex flex-col justify-between"
              style={{
                width: `${CGA_WIDTH * zoom}px`,
                height: `${CGA_HEIGHT * zoom}px`,
              }}
            >
              {/* Informational badge */}
              <div className="absolute top-2 left-2 bg-neutral-950/95 border border-cyan-500/70 p-2.5 rounded-lg text-xs text-neutral-200 font-mono shadow-xl backdrop-blur-md">
                <div className="text-cyan-300 font-bold flex items-center gap-1.5 mb-1">
                  <Hash className="w-3.5 h-3.5" />
                  <span>2-BIT DIGITS PROBE MODE</span>
                </div>
                <div className="text-[11px] text-neutral-400">
                  Move cursor across canvas to view localized 7×7 digits matrix (0..3)
                </div>
              </div>

              {/* Local Matrix Magnifier Loupe near cursor */}
              {hoverPixel && (
                <div
                  className="absolute z-30 bg-neutral-950/95 border-2 border-cyan-400 rounded-lg p-2 shadow-2xl backdrop-blur-md font-mono pointer-events-none transform -translate-x-1/2 -translate-y-[120%]"
                  style={{
                    left: `${((hoverPixel.x + 0.5) / CGA_WIDTH) * 100}%`,
                    top: `${((hoverPixel.y + 0.5) / CGA_HEIGHT) * 100}%`,
                  }}
                >
                  <div className="text-[10px] text-cyan-300 font-bold mb-1 border-b border-neutral-800 pb-0.5 flex justify-between gap-4">
                    <span>
                      X:{hoverPixel.x} Y:{hoverPixel.y}
                    </span>
                    <span className="text-white font-bold bg-cyan-950 px-1 rounded">
                      DIGIT: {hoverPixel.digit}
                    </span>
                  </div>
                  {/* 7x7 Local Digits Grid */}
                  <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold">
                    {[-3, -2, -1, 0, 1, 2, 3].map((dy) =>
                      [-3, -2, -1, 0, 1, 2, 3].map((dx) => {
                        const nx = hoverPixel.x + dx;
                        const ny = hoverPixel.y + dy;
                        const isCenter = dx === 0 && dy === 0;

                        if (
                          nx < 0 ||
                          nx >= CGA_WIDTH ||
                          ny < 0 ||
                          ny >= CGA_HEIGHT
                        ) {
                          return (
                            <span
                              key={`${dx}_${dy}`}
                              className="w-4 h-4 text-neutral-700 leading-4"
                            >
                              ·
                            </span>
                          );
                        }

                        const nIdx = ny * CGA_WIDTH + nx;
                        const nDigit = result.digits[nIdx];
                        const nCol = result.palette.colors[nDigit];

                        return (
                          <span
                            key={`${dx}_${dy}`}
                            className={`w-4 h-4 rounded-sm flex items-center justify-center leading-none ${
                              isCenter
                                ? 'ring-1 ring-white font-black scale-110 shadow-sm'
                                : 'opacity-80'
                            }`}
                            style={{
                              backgroundColor: nCol.hex,
                              color:
                                nCol.hex === '#ffffff' || nCol.hex.includes('ff')
                                  ? '#000000'
                                  : '#ffffff',
                            }}
                          >
                            {nDigit}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CRT Scanline overlay effect */}
          {crtEffect && <div className="absolute inset-0 crt-overlay pointer-events-none" />}
        </div>
      </div>

      {/* Viewport Bottom Inspection HUD & Coordinate Probe */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-neutral-900 border-t border-neutral-800 text-xs font-mono">
        {/* Left: Real-time Cursor Pixel Inspector */}
        <div className="flex items-center gap-3">
          {hoverPixel ? (
            <div className="flex items-center gap-2 text-neutral-300">
              <span className="text-neutral-500">POS:</span>
              <span className="text-cyan-400 font-bold">
                X:{hoverPixel.x} Y:{hoverPixel.y}
              </span>
              <span className="text-neutral-600">|</span>
              <span className="text-neutral-500">DIGIT:</span>
              <span className="px-1.5 py-0.5 rounded bg-neutral-950 border border-neutral-700 text-white font-bold font-mono">
                {hoverPixel.digit}
              </span>
              <span className="text-neutral-600">|</span>
              <span className="text-neutral-500">COLOR:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full border border-white/30 inline-block shadow-sm"
                  style={{ backgroundColor: hoverPixel.hex }}
                />
                <span className="text-neutral-200">{hoverPixel.colorName}</span>
                <span className="text-neutral-500 text-[10px]">
                  ({hoverPixel.hex})
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-neutral-500">
              <Info className="w-3.5 h-3.5 text-neutral-500" />
              <span>Hover canvas to inspect pixel coordinates & 2-bit digits (0..3)</span>
            </div>
          )}
        </div>

        {/* Right: Technical Stats Bar */}
        <div className="flex items-center gap-4 text-neutral-400">
          <div>
            DIMENSIONS:{' '}
            <span className="text-white font-semibold">320 × 200</span>
          </div>
          <div>
            TOTAL DIGITS:{' '}
            <span className="text-cyan-400 font-semibold">64,000</span>
          </div>
          <div>
            COLOR DEPTH:{' '}
            <span className="text-purple-400 font-semibold">
              2-Bit (4 Colors)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
