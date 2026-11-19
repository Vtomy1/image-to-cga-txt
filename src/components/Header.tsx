import React, { useRef } from 'react';
import {
  Download,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  Cpu,
  FileText,
  Layers,
} from 'lucide-react';
import { SampleImage } from '../types';

interface HeaderProps {
  onImageSelected: (img: HTMLImageElement) => void;
  samples: SampleImage[];
  selectedSampleId: string;
  onSelectSample: (sample: SampleImage) => void;
  onOpenExportModal: () => void;
  onResetAdjustments: () => void;
  quickDownloadTxt: () => void;
  isBatchMode: boolean;
  batchCount: number;
  onToggleBatchMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onImageSelected,
  samples,
  selectedSampleId,
  onSelectSample,
  onOpenExportModal,
  onResetAdjustments,
  quickDownloadTxt,
  isBatchMode,
  batchCount,
  onToggleBatchMode,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        onImageSelected(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset file input value so uploading the same file triggers again if needed
    e.target.value = '';
  };

  return (
    <header
      id="app-header"
      className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md sticky top-0 z-30 px-4 py-3"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Branding & Spec Badge */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-neutral-950 border border-cyan-500/40 flex items-center justify-center shadow-sm shadow-cyan-500/10">
              <Cpu className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  CGA 2-BIT <span className="text-cyan-400">DIGITIZER</span>
                </h1>
                <span className="text-[10px] font-mono uppercase bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-1.5 py-0.5 rounded font-semibold">
                  320×200
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono">
                2-Bit Quantizer • 4-Color CGA Palette • 64,000 Digits
              </p>
            </div>
          </div>

          <button
            id="btn-header-reset"
            onClick={onResetAdjustments}
            title="Reset adjustments to default"
            className="md:hidden p-2 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800 text-xs"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Sample Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full no-scrollbar">
          <span className="text-xs text-neutral-500 font-mono mr-1 hidden sm:inline flex-shrink-0">
            Presets:
          </span>
          {samples.map((sample) => {
            const isSelected = selectedSampleId === sample.id;
            return (
              <button
                key={sample.id}
                id={`btn-sample-${sample.id}`}
                onClick={() => onSelectSample(sample)}
                className={`text-xs px-2.5 py-1 rounded-md font-mono transition-all flex-shrink-0 flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-500/20'
                    : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 opacity-70" />
                <span>{sample.title}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Actions (Upload, Quick Download TXT, View TXT) */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp, image/gif, image/bmp"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            id="btn-header-upload"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono flex items-center gap-1.5 border border-neutral-700 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-neutral-400" />
            <span>Upload Image</span>
          </button>

          <button
            id="btn-header-batch-mode"
            onClick={onToggleBatchMode}
            className={`px-3 py-1.5 rounded-md text-xs font-mono flex items-center gap-1.5 border transition-all cursor-pointer ${
              isBatchMode
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500 ring-1 ring-cyan-500/40 font-semibold shadow-sm shadow-cyan-500/20'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
            }`}
            title="Switch to multi-image Batch Processing & ZIP export"
          >
            <Layers className={`w-3.5 h-3.5 ${isBatchMode ? 'text-cyan-400' : 'text-purple-400'}`} />
            <span>Batch Mode</span>
            {batchCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-cyan-500 text-black text-[10px] font-bold">
                {batchCount}
              </span>
            )}
          </button>

          <button
            id="btn-header-preview-txt"
            onClick={onOpenExportModal}
            className="px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono flex items-center gap-1.5 border border-neutral-700 transition-colors cursor-pointer"
            title="Open text inspector and download formats"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>TXT Options</span>
          </button>

          <button
            id="btn-header-download-txt"
            onClick={quickDownloadTxt}
            className="px-3.5 py-1.5 rounded-md bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-semibold text-xs font-mono flex items-center gap-1.5 shadow-sm shadow-cyan-500/25 transition-all active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Download .TXT</span>
          </button>
        </div>
      </div>
    </header>
  );
};
