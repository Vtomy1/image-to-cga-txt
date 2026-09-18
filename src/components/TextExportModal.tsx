import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileCode,
  FileText,
  Search,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { ProcessingResult, TxtExportFormat } from '../types';
import { downloadFile, generateDigitsText, CGA_HEIGHT, CGA_WIDTH } from '../utils/cgaDither';

interface TextExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ProcessingResult | null;
}

export const TextExportModal: React.FC<TextExportModalProps> = ({
  isOpen,
  onClose,
  result,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<TxtExportFormat>('raw_grid');
  const [copied, setCopied] = useState<boolean>(false);
  const [highlightDigit, setHighlightDigit] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Generate the formatted text
  const exportData = useMemo(() => {
    if (!result) return null;
    return generateDigitsText(result.digits, selectedFormat, result.palette);
  }, [result, selectedFormat]);

  if (!isOpen || !result || !exportData) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(exportData.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    downloadFile(exportData.text, exportData.filename, exportData.mimeType);
  };

  const handleDownloadPng = (scale = 1) => {
    const canvas = document.createElement('canvas');
    canvas.width = CGA_WIDTH * scale;
    canvas.height = CGA_HEIGHT * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (scale === 1) {
      ctx.putImageData(result.imageData, 0, 0);
    } else {
      ctx.imageSmoothingEnabled = false;
      const tmp = document.createElement('canvas');
      tmp.width = CGA_WIDTH;
      tmp.height = CGA_HEIGHT;
      tmp.getContext('2d')!.putImageData(result.imageData, 0, 0);
      ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
    }

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `cga_320x200_${result.palette.id}_${scale}x.png`;
    a.click();
  };

  // Preview slice: first 25 rows to ensure smooth UI performance while retaining instant responsiveness
  const previewLines = exportData.text.split('\n').slice(0, 35);

  return (
    <div
      id="text-export-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-700/60 text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                TXT DIGITS EXPORTER
                <span className="text-xs bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.5 rounded">
                  320×200 • 64,000 Digits
                </span>
              </h2>
              <p className="text-xs text-neutral-400 font-mono">
                Download raw 2-bit digits matrix (0..3) or formatted developer arrays
              </p>
            </div>
          </div>
          <button
            id="btn-close-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Bar */}
        <div className="px-5 py-3 bg-neutral-950/70 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1">
            <span className="text-neutral-500 mr-1 flex-shrink-0">FORMAT:</span>
            {[
              { id: 'raw_grid', label: 'Raw Grid (320×200)' },
              { id: 'space_separated', label: 'Space Separated' },
              { id: 'comma_separated', label: 'CSV' },
              { id: 'c_array', label: 'C/C++ uint8_t Array' },
              { id: 'basic_data', label: 'BASIC DATA' },
              { id: 'packed_hex', label: 'Packed 2-Bit Hex' },
              { id: 'flat_stream', label: 'Flat 64K Stream' },
            ].map((fmt) => (
              <button
                key={fmt.id}
                id={`format-btn-${fmt.id}`}
                onClick={() => setSelectedFormat(fmt.id as TxtExportFormat)}
                className={`px-2.5 py-1 rounded border transition-all flex-shrink-0 ${
                  selectedFormat === fmt.id
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500 font-semibold shadow-sm'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>

          <div className="text-neutral-400 text-xs">
            SIZE:{' '}
            <span className="text-cyan-400 font-semibold">
              {(exportData.byteCount / 1024).toFixed(1)} KB
            </span>{' '}
            ({exportData.byteCount.toLocaleString()} bytes)
          </div>
        </div>

        {/* Text Preview Window */}
        <div className="flex-1 p-4 bg-neutral-950 overflow-hidden flex flex-col min-h-[260px]">
          {/* Controls above preview */}
          <div className="flex items-center justify-between pb-2 text-xs font-mono text-neutral-400">
            <div className="flex items-center gap-3">
              <span>Previewing lines (first 35 rows):</span>
              <div className="flex items-center gap-1">
                <span className="text-neutral-500 text-[11px]">Filter Digit:</span>
                {[0, 1, 2, 3].map((d) => (
                  <button
                    key={d}
                    onClick={() =>
                      setHighlightDigit(highlightDigit === d ? null : d)
                    }
                    className={`w-5 h-5 rounded text-[11px] font-bold border transition-colors ${
                      highlightDigit === d
                        ? 'bg-cyan-500 text-black border-white'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-500'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-neutral-500">
              Filename: <span className="text-neutral-300">{exportData.filename}</span>
            </div>
          </div>

          {/* Monospace Code / Text Container */}
          <div className="flex-1 bg-black rounded-lg border border-neutral-800 p-3 overflow-auto font-mono text-[11px] text-neutral-300 leading-relaxed select-text max-h-[340px]">
            {previewLines.map((line, idx) => (
              <div key={idx} className="flex hover:bg-neutral-900/60 py-0.5">
                <span className="w-10 text-neutral-600 select-none text-right pr-3 font-mono">
                  {idx + 1}
                </span>
                <span className="font-mono break-all whitespace-pre-wrap">
                  {highlightDigit !== null
                    ? line.split('').map((char, cIdx) => (
                        <span
                          key={cIdx}
                          className={
                            char === String(highlightDigit)
                              ? 'bg-cyan-400 text-black font-bold px-0.5 rounded'
                              : 'text-neutral-400'
                          }
                        >
                          {char}
                        </span>
                      ))
                    : line}
                </span>
              </div>
            ))}
            {previewLines.length < exportData.text.split('\n').length && (
              <div className="text-neutral-600 text-center py-2 italic font-mono text-[10px]">
                ... and {exportData.text.split('\n').length - previewLines.length} more
                rows (full matrix included in download) ...
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-neutral-950 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          {/* Left: PNG export option */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-neutral-500 hidden sm:inline">
              Also Export Image:
            </span>
            <button
              id="btn-download-png-1x"
              onClick={() => handleDownloadPng(1)}
              className="px-2.5 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-mono border border-neutral-800 flex items-center gap-1.5 transition-colors"
              title="Download 320x200 1x PNG"
            >
              <ImageIcon className="w-3.5 h-3.5 text-neutral-400" />
              <span>PNG (320×200)</span>
            </button>
            <button
              id="btn-download-png-4x"
              onClick={() => handleDownloadPng(4)}
              className="px-2.5 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-mono border border-neutral-800 flex items-center gap-1.5 transition-colors"
              title="Download 1280x800 4x Upscaled PNG"
            >
              <ImageIcon className="w-3.5 h-3.5 text-neutral-400" />
              <span>PNG (4× Scale)</span>
            </button>
          </div>

          {/* Right: Copy & Download TXT */}
          <div className="flex items-center gap-2.5">
            <button
              id="btn-copy-txt"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono flex items-center gap-1.5 border border-neutral-700 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-green-300 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-neutral-400" />
                  <span>Copy TXT</span>
                </>
              )}
            </button>

            <button
              id="btn-modal-download-txt"
              onClick={handleDownloadTxt}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-transform active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Download {exportData.filename}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
