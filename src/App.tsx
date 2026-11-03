import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { ViewportCanvas } from './components/ViewportCanvas';
import { ControlsPanel } from './components/ControlsPanel';
import { ColorDistributionWidget } from './components/ColorDistributionWidget';
import { TextExportModal } from './components/TextExportModal';
import { CGA_PALETTES } from './constants/palettes';
import { getSampleImages } from './constants/samples';
import {
  CgaPalette,
  DitherAlgorithm,
  FitMode,
  ImageAdjustments,
  ProcessingResult,
  SampleImage,
} from './types';
import {
  preprocessImage,
  processCgaDither,
  downloadFile,
  generateDigitsText,
} from './utils/cgaDither';
import { Upload, Sparkles, Terminal, FileDown } from 'lucide-react';

const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  gamma: 1.0,
  invert: false,
  ditherStrength: 1.0,
  serpentine: true,
};

export default function App() {
  const samples = useMemo(() => getSampleImages(), []);
  const [selectedSampleId, setSelectedSampleId] = useState<string>(samples[0].id);

  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [palette, setPalette] = useState<CgaPalette>(CGA_PALETTES[0]);
  const [algorithm, setAlgorithm] = useState<DitherAlgorithm>('floyd-steinberg');
  const [fitMode, setFitMode] = useState<FitMode>('fit');
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS);

  const [crtEffect, setCrtEffect] = useState<boolean>(true);
  const [showPixelGrid, setShowPixelGrid] = useState<boolean>(false);
  const [aspectRatio43, setAspectRatio43] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Load initial sample image
  useEffect(() => {
    const initialSample = samples[0];
    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
    };
    img.src = initialSample.dataUrl;
  }, [samples]);

  // Handle switching sample images
  const handleSelectSample = (sample: SampleImage) => {
    setSelectedSampleId(sample.id);
    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
    };
    img.src = sample.dataUrl;
  };

  // Process image when parameters change
  useEffect(() => {
    if (!sourceImage) return;

    try {
      const rgbBuffer = preprocessImage(
        sourceImage,
        sourceImage.naturalWidth || sourceImage.width,
        sourceImage.naturalHeight || sourceImage.height,
        fitMode,
        adjustments
      );

      const res = processCgaDither(rgbBuffer, palette, algorithm, adjustments);
      setResult(res);
    } catch (err) {
      console.error('Error processing CGA dither:', err);
    }
  }, [sourceImage, palette, algorithm, fitMode, adjustments]);

  // Adjustments update handler
  const handleUpdateAdjustments = (partial: Partial<ImageAdjustments>) => {
    setAdjustments((prev) => ({ ...prev, ...partial }));
  };

  const handleResetAdjustments = () => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
  };

  // Quick download raw 320x200 digits grid TXT
  const handleQuickDownloadTxt = () => {
    if (!result) return;
    const exportData = generateDigitsText(result.digits, 'raw_grid', result.palette);
    downloadFile(exportData.text, exportData.filename, exportData.mimeType);
  };

  // Handle user uploaded image
  const handleImageLoaded = (img: HTMLImageElement) => {
    setSelectedSampleId('');
    setSourceImage(img);
  };

  // Global Drag and Drop support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => handleImageLoaded(img);
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Clipboard Paste support (Ctrl+V anywhere)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const img = new Image();
              img.onload = () => handleImageLoaded(img);
              img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col relative selection:bg-cyan-500 selection:text-black font-sans"
    >
      {/* Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-cyan-950/85 backdrop-blur-md border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center pointer-events-none animate-pulse">
          <Upload className="w-16 h-16 text-cyan-400 mb-3" />
          <h3 className="text-xl font-mono font-bold text-white">
            DROP IMAGE TO QUANTIZE & DITHER
          </h3>
          <p className="text-xs font-mono text-cyan-300 mt-1">
            Converts to 320×200 2-Bit CGA digits (0..3)
          </p>
        </div>
      )}

      {/* Top Header */}
      <Header
        onImageSelected={handleImageLoaded}
        samples={samples}
        selectedSampleId={selectedSampleId}
        onSelectSample={handleSelectSample}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onResetAdjustments={handleResetAdjustments}
        quickDownloadTxt={handleQuickDownloadTxt}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col gap-5">
        {/* Top Feature Summary Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900/60 border border-neutral-800/80 px-4 py-2.5 rounded-xl text-xs font-mono">
          <div className="flex items-center gap-2 text-neutral-400">
            <Terminal className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>
              MODE 4/5 DITHER ENGINE:{' '}
              <strong className="text-white">320×200</strong> resolution •{' '}
              <strong className="text-cyan-400">2-Bit (4 Colors)</strong> •{' '}
              <strong className="text-purple-400">64,000 Total Digits</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 text-neutral-400">
            <span className="hidden sm:inline">
              Tip: Paste image from clipboard with <kbd className="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-200">Ctrl+V</kbd>
            </span>
            <button
              id="btn-main-quick-download"
              onClick={handleQuickDownloadTxt}
              className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-cyan-400 border border-neutral-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Quick Save .TXT</span>
            </button>
          </div>
        </div>

        {/* Viewport Canvas and Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left / Top: Interactive 320x200 CRT Viewport (7 cols on desktop) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <ViewportCanvas
              result={result}
              sourceImage={sourceImage}
              crtEffect={crtEffect}
              onToggleCrt={() => setCrtEffect(!crtEffect)}
              showPixelGrid={showPixelGrid}
              onTogglePixelGrid={() => setShowPixelGrid(!showPixelGrid)}
              aspectRatio43={aspectRatio43}
              onToggleAspectRatio={() => setAspectRatio43(!aspectRatio43)}
            />
          </div>

          {/* Right / Bottom: Controls Panel (5 cols on desktop) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <ControlsPanel
              currentPalette={palette}
              onSelectPalette={setPalette}
              algorithm={algorithm}
              onSelectAlgorithm={setAlgorithm}
              fitMode={fitMode}
              onSelectFitMode={setFitMode}
              adjustments={adjustments}
              onChangeAdjustments={handleUpdateAdjustments}
              onResetAdjustments={handleResetAdjustments}
              result={result}
            />

            {/* Live 4-Color CGA Distribution & Dithering Optimization Widget */}
            <ColorDistributionWidget result={result} />
          </div>
        </div>
      </main>

      {/* Text Export & Download Modal */}
      <TextExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        result={result}
      />
    </div>
  );
}
