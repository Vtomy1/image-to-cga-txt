import React, { useRef, useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import {
  Upload,
  FolderArchive,
  Trash2,
  X,
  CheckCircle2,
  Loader2,
  FileText,
  Layers,
  Sparkles,
  ImagePlus,
  Download,
  ArrowLeft,
  Sliders,
} from 'lucide-react';
import {
  BatchItem,
  CgaPalette,
  DitherAlgorithm,
  FitMode,
  ImageAdjustments,
  SampleImage,
  TxtExportFormat,
} from '../types';
import {
  downloadBlob,
  downloadFile,
  generateDigitsText,
  processImageElementToCga,
  renderImageDataToDataUrl,
} from '../utils/cgaDither';

interface BatchProcessorProps {
  items: BatchItem[];
  onAddFiles: (files: FileList | File[]) => void;
  onAddSamples: (samples: SampleImage[]) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onUpdateItems: React.Dispatch<React.SetStateAction<BatchItem[]>>;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  samples: SampleImage[];
  palette: CgaPalette;
  algorithm: DitherAlgorithm;
  fitMode: FitMode;
  adjustments: ImageAdjustments;
  onExitBatchMode: () => void;
}

const EXPORT_FORMAT_OPTIONS: { id: TxtExportFormat; label: string; short: string }[] = [
  { id: 'raw_grid', label: 'Raw Grid (320×200)', short: 'Raw Grid' },
  { id: 'space_separated', label: 'Space Separated', short: 'Spaced' },
  { id: 'comma_separated', label: 'CSV (Comma)', short: 'CSV' },
  { id: 'c_array', label: 'C/C++ uint8_t Array', short: 'C Array' },
  { id: 'basic_data', label: 'BASIC DATA', short: 'BASIC' },
  { id: 'packed_hex', label: 'Packed 2-Bit Hex', short: 'Hex' },
  { id: 'flat_stream', label: 'Flat 64K Stream', short: '64K Stream' },
];

export const BatchProcessor: React.FC<BatchProcessorProps> = ({
  items,
  onAddFiles,
  onAddSamples,
  onRemoveItem,
  onClearAll,
  onUpdateItems,
  selectedItemId,
  onSelectItem,
  samples,
  palette,
  algorithm,
  fitMode,
  adjustments,
  onExitBatchMode,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [exportFormat, setExportFormat] = useState<TxtExportFormat>('raw_grid');
  const [includeManifest, setIncludeManifest] = useState<boolean>(true);
  const [isDraggingHere, setIsDraggingHere] = useState<boolean>(false);
  const [isSyncingPreviews, setIsSyncingPreviews] = useState<boolean>(false);

  // ZIP export progress state
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [lastExportSummary, setLastExportSummary] = useState<string | null>(null);

  // Re-process queued items whenever current session settings or item list length changes
  useEffect(() => {
    if (items.length === 0) {
      setIsSyncingPreviews(false);
      return;
    }

    let cancelled = false;
    setIsSyncingPreviews(true);

    const timer = setTimeout(async () => {
      const updatedMap = new Map<string, { result: BatchItem['result']; previewDataUrl: string }>();

      for (let i = 0; i < items.length; i++) {
        if (cancelled) return;
        const item = items[i];
        try {
          const result = processImageElementToCga(
            item.imageElement,
            palette,
            algorithm,
            fitMode,
            adjustments
          );
          const previewDataUrl = renderImageDataToDataUrl(result.imageData);
          updatedMap.set(item.id, { result, previewDataUrl });
        } catch (err) {
          console.error(`Failed to preview batch item ${item.filename}:`, err);
        }

        // Yield to UI every 2 items so sliders remain responsive
        if (i % 2 === 1) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      if (cancelled) return;

      onUpdateItems((prev) =>
        prev.map((item) => {
          const updated = updatedMap.get(item.id);
          if (!updated) return item;
          return {
            ...item,
            result: updated.result,
            previewDataUrl: updated.previewDataUrl,
          };
        })
      );
      setIsSyncingPreviews(false);
    }, 80);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Trigger on settings changes or when items are added/removed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    items.length,
    palette,
    algorithm,
    fitMode,
    adjustments,
  ]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingHere(true);
  };

  const handleDropZoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingHere(false);
  };

  const handleDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingHere(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  // Helper to compute unique filenames across the batch
  const getUniqueBaseNames = useCallback((batchItems: BatchItem[]) => {
    const usedCounts = new Map<string, number>();
    return batchItems.map((item) => {
      const clean = item.baseName || 'image';
      const count = usedCounts.get(clean) ?? 0;
      usedCounts.set(clean, count + 1);
      return count === 0 ? clean : `${clean}_${count + 1}`;
    });
  }, []);

  // Process all queued images with current session settings and download single ZIP archive
  const handleProcessAndDownloadZip = async () => {
    if (items.length === 0 || isExportingZip) return;

    setIsExportingZip(true);
    setLastExportSummary(null);
    const total = items.length;
    setExportProgress({ current: 0, total, label: 'Initializing batch engine...' });

    try {
      const zip = new JSZip();
      const uniqueNames = getUniqueBaseNames(items);
      const manifestRows: string[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const uniqueBase = uniqueNames[i];

        setExportProgress({
          current: i + 1,
          total,
          label: `Quantizing ${item.filename}...`,
        });

        // Always compute fresh result using exact current session settings
        const res = processImageElementToCga(
          item.imageElement,
          palette,
          algorithm,
          fitMode,
          adjustments
        );

        const txtData = generateDigitsText(
          res.digits,
          exportFormat,
          palette,
          uniqueBase
        );

        zip.file(txtData.filename, txtData.text);

        manifestRows.push(
          `${i + 1}. ${item.filename} (${item.width}x${item.height}) -> ${txtData.filename} | ` +
            `0:${res.stats.percentages[0]}% 1:${res.stats.percentages[1]}% 2:${res.stats.percentages[2]}% 3:${res.stats.percentages[3]}%`
        );

        // Yield to UI so progress updates visually
        await new Promise((r) => setTimeout(r, 0));
      }

      if (includeManifest) {
        const manifestText = [
          `================================================================`,
          `CGA 2-BIT DIGITIZER — BATCH EXPORT MANIFEST`,
          `================================================================`,
          `Exported At : ${new Date().toISOString()}`,
          `Total Files : ${items.length}`,
          `Matrix Size : 320 x 200 (64,000 2-bit digits per file)`,
          `TXT Format  : ${exportFormat}`,
          ``,
          `--- APPLIED SESSION SETTINGS ---`,
          `Palette     : ${palette.name} (${palette.id})`,
          `  Digit 0   : ${palette.colors[0].name} (${palette.colors[0].hex})`,
          `  Digit 1   : ${palette.colors[1].name} (${palette.colors[1].hex})`,
          `  Digit 2   : ${palette.colors[2].name} (${palette.colors[2].hex})`,
          `  Digit 3   : ${palette.colors[3].name} (${palette.colors[3].hex})`,
          `Algorithm   : ${algorithm}`,
          `Strength    : ${Math.round((adjustments.ditherStrength ?? 1) * 100)}%`,
          `Serpentine  : ${adjustments.serpentine ? 'ENABLED' : 'DISABLED'}`,
          `Fit Mode    : ${fitMode}`,
          `Brightness  : ${adjustments.brightness}`,
          `Contrast    : ${adjustments.contrast}`,
          `Saturation  : ${adjustments.saturation}`,
          `Gamma       : ${adjustments.gamma.toFixed(2)}`,
          `Invert      : ${adjustments.invert ? 'ON' : 'OFF'}`,
          ``,
          `--- PROCESSED FILES ---`,
          ...manifestRows,
        ].join('\n');

        zip.file('_batch_settings.txt', manifestText);
      }

      setExportProgress({
        current: total,
        total,
        label: 'Compressing ZIP archive...',
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const zipFilename = `cga_2bit_batch_${palette.id}_${items.length}files.zip`;
      downloadBlob(zipBlob, zipFilename);

      setLastExportSummary(
        `Exported ${items.length} .txt file${items.length === 1 ? '' : 's'} into ${zipFilename} (${(
          zipBlob.size / 1024
        ).toFixed(1)} KB)`
      );
    } catch (err) {
      console.error('Batch ZIP export failed:', err);
      setLastExportSummary('Error generating ZIP archive. Please try again.');
    } finally {
      setIsExportingZip(false);
      setExportProgress(null);
    }
  };

  // Download a single item's .txt directly from the batch queue
  const handleDownloadSingleItemTxt = (item: BatchItem, uniqueBase: string) => {
    const res =
      item.result ??
      processImageElementToCga(
        item.imageElement,
        palette,
        algorithm,
        fitMode,
        adjustments
      );
    const txtData = generateDigitsText(res.digits, exportFormat, palette, uniqueBase);
    downloadFile(txtData.text, txtData.filename, txtData.mimeType);
  };

  const uniqueBaseNames = getUniqueBaseNames(items);
  const hasCustomAdjustments =
    adjustments.brightness !== 0 ||
    adjustments.contrast !== 0 ||
    adjustments.saturation !== 0 ||
    adjustments.gamma !== 1.0 ||
    adjustments.invert;

  return (
    <div
      id="batch-processor-panel"
      onDragOver={handleDropZoneDragOver}
      onDragLeave={handleDropZoneDragLeave}
      onDrop={handleDropZoneDrop}
      className={`flex flex-col bg-neutral-950 border rounded-xl overflow-hidden shadow-2xl relative transition-colors ${
        isDraggingHere ? 'border-cyan-400 ring-2 ring-cyan-500/40' : 'border-neutral-800'
      }`}
    >
      {/* Hidden Multi-file input */}
      <input
        ref={fileInputRef}
        id="batch-file-input"
        type="file"
        multiple
        accept="image/png, image/jpeg, image/webp, image/gif, image/bmp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-neutral-900/90 border-b border-neutral-800 text-xs font-mono">
        <div className="flex items-center gap-2">
          <button
            id="btn-exit-batch"
            onClick={onExitBatchMode}
            className="px-2 py-1 rounded bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 flex items-center gap-1 transition-colors cursor-pointer"
            title="Return to single-image interactive CRT viewport"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span>Single View</span>
          </button>

          <div className="flex items-center gap-1.5 pl-1">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-white tracking-tight">BATCH MODE</span>
            <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.5 rounded font-semibold">
              {items.length} {items.length === 1 ? 'IMAGE' : 'IMAGES'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {items.length > 0 && (
            <button
              id="btn-batch-clear"
              onClick={onClearAll}
              disabled={isExportingZip}
              className="px-2.5 py-1 rounded bg-neutral-950 hover:bg-red-950/60 text-neutral-400 hover:text-red-300 border border-neutral-800 hover:border-red-800/70 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
          <button
            id="btn-batch-add-files"
            onClick={() => fileInputRef.current?.click()}
            disabled={isExportingZip}
            className="px-3 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span>Add Images</span>
          </button>
        </div>
      </div>

      {/* Active Session Settings Summary Banner */}
      <div className="px-3.5 py-2.5 bg-neutral-900/50 border-b border-neutral-800/80 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-neutral-300">
          <span className="text-neutral-500 flex items-center gap-1 uppercase text-[10px]">
            <Sliders className="w-3 h-3 text-cyan-400" />
            Applied Settings:
          </span>

          {/* Palette Pill */}
          <span className="inline-flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded">
            <span className="flex items-center gap-0.5">
              {palette.colors.map((c) => (
                <span
                  key={c.index}
                  className="w-2.5 h-2.5 rounded-xs border border-white/20"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </span>
            <span className="text-white font-semibold">{palette.name}</span>
          </span>

          {/* Algorithm & Strength */}
          <span className="bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded text-cyan-300">
            {algorithm} ({Math.round((adjustments.ditherStrength ?? 1) * 100)}%)
          </span>

          {/* Fit mode */}
          <span className="bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded text-neutral-300">
            fit: <strong className="text-white">{fitMode}</strong>
          </span>

          {/* Adjustments indicator */}
          {hasCustomAdjustments && (
            <span className="bg-purple-950/60 border border-purple-800/70 px-2 py-0.5 rounded text-purple-300">
              Bri:{adjustments.brightness} Con:{adjustments.contrast} Sat:
              {adjustments.saturation} Gam:{adjustments.gamma.toFixed(1)}
              {adjustments.invert ? ' INV' : ''}
            </span>
          )}
        </div>

        {isSyncingPreviews && (
          <span className="text-[10px] text-cyan-400 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Updating previews...
          </span>
        )}
      </div>

      {/* Main Queue Area / Dropzone */}
      <div className="flex-1 min-h-[340px] max-h-[500px] overflow-y-auto p-3.5 space-y-3 bg-radial from-neutral-900/50 to-neutral-950 relative">
        {items.length === 0 ? (
          /* Empty Dropzone */
          <div
            onClick={() => fileInputRef.current?.click()}
            className="h-full min-h-[310px] border-2 border-dashed border-neutral-700 hover:border-cyan-500/80 rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all bg-neutral-950/60 hover:bg-neutral-900/40 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 group-hover:border-cyan-500/50 flex items-center justify-center mb-3 shadow-lg transition-colors">
              <Upload className="w-7 h-7 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="text-sm font-mono font-bold text-white mb-1">
              DROP MULTIPLE IMAGES HERE OR CLICK TO BROWSE
            </h3>
            <p className="text-xs font-mono text-neutral-400 max-w-md mb-4">
              Upload PNG, JPG, WebP, GIF, or BMP files. Each image is quantized to a{' '}
              <span className="text-cyan-400">320×200 2-bit CGA matrix</span> using your
              active palette, dithering, and color adjustments.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" />
                <span>Select Multiple Images</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSamples(samples);
                }}
                className="px-3.5 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 font-mono text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Load 3 Sample Scenes</span>
              </button>
            </div>
          </div>
        ) : (
          /* Queued Images Grid / List */
          <div className="space-y-2.5">
            {/* Quick top drop bar */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-neutral-800 hover:border-cyan-600/70 rounded-lg px-3 py-2 flex items-center justify-between text-xs font-mono text-neutral-400 hover:text-cyan-300 bg-neutral-950/60 cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>Drop more images here or click to append to batch queue</span>
              </span>
              <span className="text-[10px] text-neutral-500">
                Inspect any item to view its 4-color stats →
              </span>
            </div>

            {items.map((item, idx) => {
              const isSelected = selectedItemId === item.id;
              const uniqueBase = uniqueBaseNames[idx];
              const previewTxtName = generateDigitsText(
                new Uint8Array(0),
                exportFormat,
                palette,
                uniqueBase
              ).filename;

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(isSelected ? null : item.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center gap-3 font-mono ${
                    isSelected
                      ? 'bg-cyan-950/20 border-cyan-500 ring-1 ring-cyan-500/40 shadow-md'
                      : 'bg-neutral-900/70 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {/* Side-by-side Original & CGA 320x200 Thumbnails */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-16 h-10 rounded bg-black border border-neutral-800 overflow-hidden relative">
                      <img
                        src={item.sourceDataUrl}
                        alt={item.filename}
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute bottom-0 left-0 bg-black/75 text-[8px] text-neutral-300 px-1">
                        SRC
                      </span>
                    </div>
                    <span className="text-neutral-600 text-xs">→</span>
                    <div className="w-20 h-12 rounded bg-black border border-cyan-800/60 overflow-hidden relative shadow-sm">
                      {item.previewDataUrl ? (
                        <img
                          src={item.previewDataUrl}
                          alt={`${item.filename} CGA`}
                          className="w-full h-full object-contain pixelated"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600">
                          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 bg-cyan-950/90 text-[8px] text-cyan-300 px-1 font-bold">
                        CGA
                      </span>
                    </div>
                  </div>

                  {/* File info & color distribution bar */}
                  <div className="flex-1 min-w-0 w-full space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="text-xs font-bold text-white">
                          {item.filename}
                        </span>
                        <span className="ml-2 text-[10px] text-neutral-500">
                          {item.width}×{item.height}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-700 px-1.5 py-0.5 rounded flex-shrink-0">
                          INSPECTING
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 truncate">
                      <FileText className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                      <span className="truncate text-cyan-200/90">{previewTxtName}</span>
                    </div>

                    {/* Mini 4-Color Distribution Bar */}
                    {item.result && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-neutral-950 rounded-full overflow-hidden flex border border-neutral-800">
                          {item.result.palette.colors.map((col) => {
                            const pct = item.result!.stats.percentages[col.index];
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
                        <span className="text-[9px] text-neutral-500 flex-shrink-0">
                          {item.result.stats.percentages.map((p, i) => `${i}:${p}%`).join(' ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Per-item actions */}
                  <div
                    className="flex items-center gap-1 self-end sm:self-center flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleDownloadSingleItemTxt(item, uniqueBase)}
                      className="p-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-cyan-300 border border-neutral-800 transition-colors cursor-pointer"
                      title={`Download ${previewTxtName}`}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-1.5 rounded-lg bg-neutral-950 hover:bg-red-950/60 text-neutral-400 hover:text-red-300 border border-neutral-800 hover:border-red-800/70 transition-colors cursor-pointer"
                      title="Remove from batch"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Drag overlay inside batch panel */}
        {isDraggingHere && (
          <div className="absolute inset-0 bg-cyan-950/85 backdrop-blur-xs border-2 border-dashed border-cyan-400 rounded-xl flex flex-col items-center justify-center pointer-events-none z-20">
            <Upload className="w-10 h-10 text-cyan-300 mb-2 animate-bounce" />
            <p className="text-sm font-mono font-bold text-white">
              DROP IMAGES TO ADD TO BATCH QUEUE
            </p>
          </div>
        )}
      </div>

      {/* Bottom Batch Export Footer */}
      <div className="px-4 py-3.5 bg-neutral-900 border-t border-neutral-800 flex flex-col gap-3 font-mono text-xs">
        {/* Format Selection & Manifest Checkbox */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-neutral-400 text-[11px]">.TXT FORMAT:</span>
            <select
              id="batch-format-select"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as TxtExportFormat)}
              className="bg-neutral-950 border border-neutral-700 text-cyan-300 rounded-md px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {EXPORT_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-neutral-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeManifest}
              onChange={(e) => setIncludeManifest(e.target.checked)}
              className="accent-cyan-500 rounded cursor-pointer"
            />
            <span>Include _batch_settings.txt manifest</span>
          </label>
        </div>

        {/* Progress Bar (if exporting) */}
        {exportProgress && (
          <div className="space-y-1.5 bg-neutral-950 p-2.5 rounded-lg border border-cyan-900/60">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-cyan-300 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {exportProgress.label}
              </span>
              <span className="text-white font-bold">
                {exportProgress.current} / {exportProgress.total}
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-150"
                style={{
                  width: `${Math.round((exportProgress.current / exportProgress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Export confirmation banner */}
        {lastExportSummary && !isExportingZip && (
          <div className="flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 px-3 py-2 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{lastExportSummary}</span>
          </div>
        )}

        {/* Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-500">
            Applies active palette, dither mode & adjustments to all queued files.
          </div>

          <button
            id="btn-batch-download-zip"
            onClick={handleProcessAndDownloadZip}
            disabled={items.length === 0 || isExportingZip}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-500 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed ml-auto"
          >
            {isExportingZip ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Building .ZIP Archive...</span>
              </>
            ) : (
              <>
                <FolderArchive className="w-4 h-4 stroke-[2.2]" />
                <span>
                  Process & Download .ZIP ({items.length}{' '}
                  {items.length === 1 ? 'file' : 'files'})
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
