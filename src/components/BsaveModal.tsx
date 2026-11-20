import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  HardDrive,
  Upload,
  Download,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Binary,
  ArrowRight,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { CgaPalette, ProcessingResult } from '../types';
import { downloadBlob, CGA_WIDTH, CGA_HEIGHT } from '../utils/cgaDither';
import {
  BsaveLayout,
  CGA_SEGMENT,
  DecodedBsaveResult,
  decodeQBasicBsave,
  digitsToImageData,
  encodeQBasicBsave,
  generateQBasicBsaveSnippet,
} from '../utils/qbasicBsave';

interface BsaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ProcessingResult | null;
  palette: CgaPalette;
  onLoadBsaveIntoCanvas: (digits: Uint8Array, filename: string) => void;
}

const LAYOUT_OPTIONS: {
  id: BsaveLayout;
  title: string;
  sizeLabel: string;
  desc: string;
}[] = [
  {
    id: 'cga_interleaved',
    title: 'CGA &HB800 Interleaved',
    sizeLabel: '16,384B + 7B hdr',
    desc: 'Even/odd scanline banks (8192B offset). For DEF SEG = &HB800 : BLOAD.',
  },
  {
    id: 'qbasic_get_put',
    title: 'QBasic GET/PUT Array',
    sizeLabel: '16,004B + 7B hdr',
    desc: 'Includes 4-byte (640, 200) array header. For BLOAD + PUT (0,0), img%.',
  },
  {
    id: 'linear',
    title: 'Linear Packed 2-Bit',
    sizeLabel: '16,000B + 7B hdr',
    desc: 'Sequential 80 bytes/row × 200 rows. Simple binary file streaming.',
  },
];

function formatHex16(val: number): string {
  return '0x' + (val & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function formatHexBytes(bytes: Uint8Array, count: number): string {
  return Array.from(bytes.subarray(0, count))
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

export const BsaveModal: React.FC<BsaveModalProps> = ({
  isOpen,
  onClose,
  result,
  palette,
  onLoadBsaveIntoCanvas,
}) => {
  const [activeTab, setActiveTab] = useState<'saver' | 'loader'>('saver');

  // Saver state
  const [saveLayout, setSaveLayout] = useState<BsaveLayout>('cga_interleaved');
  const [saveFilename, setSaveFilename] = useState<string>('CGAIMG.BSV');
  const [segmentHex, setSegmentHex] = useState<string>('B800');
  const [offsetHex, setOffsetHex] = useState<string>('0000');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Loader state
  const loaderInputRef = useRef<HTMLInputElement | null>(null);
  const loaderPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadedFilename, setLoadedFilename] = useState<string>('');
  const [loadedRawBytes, setLoadedRawBytes] = useState<Uint8Array | null>(null);
  const [loadLayoutOverride, setLoadLayoutOverride] = useState<BsaveLayout | undefined>(
    undefined
  );
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  const parsedSegment = useMemo(() => {
    const v = parseInt(segmentHex.replace(/^0x|^&H/i, ''), 16);
    return Number.isNaN(v) ? CGA_SEGMENT : v & 0xffff;
  }, [segmentHex]);

  const parsedOffset = useMemo(() => {
    const v = parseInt(offsetHex.replace(/^0x|^&H/i, ''), 16);
    return Number.isNaN(v) ? 0 : v & 0xffff;
  }, [offsetHex]);

  // Encoded BSAVE bytes for the current canvas result
  const encodedBsave = useMemo(() => {
    if (!result) return null;
    return encodeQBasicBsave(result.digits, saveLayout, parsedSegment, parsedOffset);
  }, [result, saveLayout, parsedSegment, parsedOffset]);

  const qbasicSnippet = useMemo(() => {
    return generateQBasicBsaveSnippet(saveFilename, saveLayout, palette);
  }, [saveFilename, saveLayout, palette]);

  // Decoded BSAVE result for the Loader tab
  const decodedBsave: DecodedBsaveResult | null = useMemo(() => {
    if (!loadedRawBytes) return null;
    return decodeQBasicBsave(loadedRawBytes, loadLayoutOverride);
  }, [loadedRawBytes, loadLayoutOverride]);

  // Render Loader preview onto canvas when decodedBsave or palette changes
  useEffect(() => {
    if (!isOpen || activeTab !== 'loader' || !decodedBsave || !loaderPreviewCanvasRef.current) {
      return;
    }
    const ctx = loaderPreviewCanvasRef.current.getContext('2d');
    if (!ctx) return;
    const imgData = digitsToImageData(decodedBsave.digits, palette);
    ctx.putImageData(imgData, 0, 0);
  }, [isOpen, activeTab, decodedBsave, palette]);

  if (!isOpen) return null;

  const handleDownloadBsave = () => {
    if (!encodedBsave) return;
    const cleanName =
      saveFilename.trim() || `cga_320x200_${palette.id}.bsv`;
    const blob = new Blob([new Uint8Array(encodedBsave)], {
      type: 'application/octet-stream',
    });
    downloadBlob(blob, cleanName);
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(qbasicSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleReadBsaveFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buf = e.target?.result;
      if (buf instanceof ArrayBuffer) {
        setLoadedFilename(file.name);
        setLoadLayoutOverride(undefined);
        setLoadedRawBytes(new Uint8Array(buf));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleLoaderFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleReadBsaveFile(file);
    }
    e.target.value = '';
  };

  const handleTestRoundTrip = () => {
    if (!result) return;
    const bytes = encodeQBasicBsave(result.digits, saveLayout, parsedSegment, parsedOffset);
    setLoadedFilename(saveFilename || 'ROUNDTRIP.BSV');
    setLoadLayoutOverride(undefined);
    setLoadedRawBytes(bytes);
  };

  const handleApplyLoadedToCanvas = () => {
    if (!decodedBsave) return;
    onLoadBsaveIntoCanvas(decodedBsave.digits, loadedFilename || 'loaded.bsv');
    onClose();
  };

  const activeLoadLayout =
    loadLayoutOverride ?? decodedBsave?.header.detectedLayout ?? 'cga_interleaved';

  return (
    <div
      id="bsave-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-950/70 border border-amber-700/60 text-amber-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                QBASIC BSAVE 2-BIT (320×200)
                <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded">
                  0xFD HEADER
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Save & load authentic QBasic BSAVE / BLOAD 2-bit CGA binary files
              </p>
            </div>
          </div>
          <button
            id="btn-close-bsave-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs: Saver vs Loader */}
        <div className="flex items-center gap-2 px-5 pt-3 bg-neutral-950/70 border-b border-neutral-800 text-xs">
          <button
            id="tab-bsave-saver"
            onClick={() => setActiveTab('saver')}
            className={`px-4 py-2 rounded-t-lg border-t border-x flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'saver'
                ? 'bg-neutral-900 text-amber-300 border-neutral-700 font-bold'
                : 'bg-transparent text-neutral-400 border-transparent hover:text-neutral-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>BSAVE Saver (Export .BSV)</span>
          </button>
          <button
            id="tab-bsave-loader"
            onClick={() => setActiveTab('loader')}
            className={`px-4 py-2 rounded-t-lg border-t border-x flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'loader'
                ? 'bg-neutral-900 text-cyan-300 border-neutral-700 font-bold'
                : 'bg-transparent text-neutral-400 border-transparent hover:text-neutral-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>BSAVE Loader (Import .BSV)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'saver' ? (
            <>
              {/* Memory Layout Selector */}
              <div className="space-y-2">
                <label className="text-[11px] text-neutral-400 uppercase block">
                  1. Select 320×200 2-Bit Memory Layout:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {LAYOUT_OPTIONS.map((opt) => {
                    const selected = saveLayout === opt.id;
                    return (
                      <button
                        key={opt.id}
                        id={`btn-bsave-layout-${opt.id}`}
                        onClick={() => setSaveLayout(opt.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          selected
                            ? 'bg-amber-950/30 border-amber-500 ring-1 ring-amber-500/40'
                            : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-bold text-white">
                            {opt.title}
                          </span>
                        </div>
                        <div className="text-[10px] text-amber-300 font-semibold mb-1">
                          {opt.sizeLabel}
                        </div>
                        <p className="text-[10px] text-neutral-400 leading-snug">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 7-Byte BSAVE Header Inspector & Config */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-neutral-300 font-bold flex items-center gap-1.5">
                    <Binary className="w-4 h-4 text-amber-400" />
                    7-BYTE QBASIC BSAVE HEADER
                  </span>
                  {encodedBsave && (
                    <span className="text-[11px] bg-black border border-neutral-800 px-2.5 py-1 rounded text-amber-300 tracking-wider">
                      {formatHexBytes(encodedBsave, 7)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-1">
                      Filename (.BSV)
                    </label>
                    <input
                      type="text"
                      value={saveFilename}
                      onChange={(e) => setSaveFilename(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-1">
                      Segment (Hex)
                    </label>
                    <input
                      type="text"
                      value={segmentHex}
                      onChange={(e) => setSegmentHex(e.target.value)}
                      maxLength={6}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-cyan-300 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-1">
                      Offset (Hex)
                    </label>
                    <input
                      type="text"
                      value={offsetHex}
                      onChange={(e) => setOffsetHex(e.target.value)}
                      maxLength={6}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-cyan-300 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-1">
                      Total File Size
                    </label>
                    <div className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1 text-neutral-200 text-xs">
                      {encodedBsave ? `${encodedBsave.length.toLocaleString()} bytes` : '—'}
                    </div>
                  </div>
                </div>

                {/* Byte breakdown */}
                {encodedBsave && (
                  <div className="grid grid-cols-4 gap-2 pt-1 text-[10px] text-neutral-400 border-t border-neutral-800/80">
                    <div>
                      Magic: <strong className="text-amber-300">0xFD</strong>
                    </div>
                    <div>
                      Seg: <strong className="text-white">{formatHex16(parsedSegment)}</strong>
                    </div>
                    <div>
                      Off: <strong className="text-white">{formatHex16(parsedOffset)}</strong>
                    </div>
                    <div>
                      Len:{' '}
                      <strong className="text-cyan-300">
                        {(encodedBsave.length - 7).toLocaleString()} B
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Companion QBasic BLOAD/BSAVE Code */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-neutral-300 font-bold flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    COMPANION QBASIC LOADER / SAVER CODE
                  </span>
                  <button
                    id="btn-copy-bsave-code"
                    onClick={handleCopySnippet}
                    className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Copy .BAS</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-black border border-neutral-800 rounded-lg p-3 text-[11px] text-neutral-300 overflow-x-auto max-h-48 leading-relaxed select-all">
                  {qbasicSnippet}
                </pre>
              </div>
            </>
          ) : (
            /* LOADER TAB */
            <>
              <input
                ref={loaderInputRef}
                id="bsave-loader-file-input"
                type="file"
                accept=".bsv,.cga,.bin,.dat,.scr,*"
                className="hidden"
                onChange={handleLoaderFileChange}
              />

              {/* File Dropzone / Picker */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleReadBsaveFile(file);
                }}
                onClick={() => loaderInputRef.current?.click()}
                className={`p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 ${
                  isDraggingFile
                    ? 'border-cyan-400 bg-cyan-950/30'
                    : 'border-neutral-700 hover:border-cyan-500/70 bg-neutral-950/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-cyan-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      {loadedFilename
                        ? `Loaded: ${loadedFilename}`
                        : 'Drop QBasic BSAVE (.BSV / .CGA / .BIN) or click to browse'}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      Reads 7-byte 0xFD header & unpacks 2-bit 320×200 digits (4 px/byte)
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => loaderInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-xs font-semibold cursor-pointer"
                  >
                    Browse File
                  </button>
                  {result && (
                    <button
                      type="button"
                      onClick={handleTestRoundTrip}
                      className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs flex items-center gap-1.5 cursor-pointer"
                      title="Encode current canvas as BSAVE and inspect/decode it"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Test Current Image</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Decoded Header & Preview */}
              {decodedBsave && loadedRawBytes && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Left: Decoded Preview */}
                  <div className="md:col-span-6 p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-cyan-300 font-bold">
                        DECODED 320×200 PREVIEW
                      </span>
                      <span className="text-neutral-500">
                        Palette: {palette.name}
                      </span>
                    </div>
                    <div className="bg-black border border-neutral-800 rounded-lg overflow-hidden flex items-center justify-center p-2">
                      <canvas
                        ref={loaderPreviewCanvasRef}
                        width={CGA_WIDTH}
                        height={CGA_HEIGHT}
                        className="w-full h-auto pixelated rounded"
                      />
                    </div>
                    <p className="text-[10px] text-neutral-500">
                      64,000 2-bit pixels (0..3) rendered with active palette.
                    </p>
                  </div>

                  {/* Right: Header Inspection & Layout Override */}
                  <div className="md:col-span-6 p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col gap-3 text-xs">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Binary className="w-4 h-4 text-cyan-400" />
                        HEADER INSPECTION
                      </span>
                      {decodedBsave.header.validMagic ? (
                        <span className="text-[10px] bg-emerald-950/70 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          VALID 0xFD BSAVE
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-950/70 text-amber-300 border border-amber-700 px-2 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          RAW / NO 0xFD
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded bg-neutral-900 border border-neutral-800">
                        <span className="text-neutral-500 block text-[10px]">
                          Segment : Offset
                        </span>
                        <span className="text-cyan-300 font-bold">
                          {decodedBsave.header.hasHeader
                            ? `${formatHex16(decodedBsave.header.segment)}:${formatHex16(
                                decodedBsave.header.offset
                              )}`
                            : 'N/A (No header)'}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-neutral-900 border border-neutral-800">
                        <span className="text-neutral-500 block text-[10px]">
                          Payload / File Size
                        </span>
                        <span className="text-white font-bold">
                          {decodedBsave.header.actualPayloadLength.toLocaleString()} /{' '}
                          {decodedBsave.header.totalFileSize.toLocaleString()} B
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] bg-black border border-neutral-800 px-2.5 py-1.5 rounded text-neutral-300">
                      First 12 bytes:{' '}
                      <span className="text-amber-300">
                        {formatHexBytes(loadedRawBytes, 12)}
                      </span>
                    </div>

                    {/* Decode Layout Selector */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-neutral-400 uppercase block">
                        Decode Scanline Layout (Auto: {decodedBsave.header.detectedLayout}):
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {LAYOUT_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setLoadLayoutOverride(opt.id)}
                            className={`px-2 py-1.5 rounded border text-[10px] transition-colors cursor-pointer ${
                              activeLoadLayout === opt.id
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-500 font-bold'
                                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                            }`}
                          >
                            {opt.id === 'cga_interleaved'
                              ? 'Interleaved'
                              : opt.id === 'qbasic_get_put'
                              ? 'GET/PUT'
                              : 'Linear'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Warnings */}
                    {decodedBsave.warnings.length > 0 && (
                      <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-800/60 text-amber-200 text-[10px] space-y-1">
                        {decodedBsave.warnings.map((w, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-neutral-950 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-[11px] text-neutral-500">
            {activeTab === 'saver'
              ? 'Exports 2-bit packed binary with 7-byte QBasic BSAVE header.'
              : 'Loaded BSAVE digits preserve exact 0..3 values across palette switches.'}
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 cursor-pointer"
            >
              Close
            </button>

            {activeTab === 'saver' ? (
              <button
                id="btn-download-bsave-binary"
                onClick={handleDownloadBsave}
                disabled={!encodedBsave}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-500 text-black font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Download {saveFilename || 'CGAIMG.BSV'}</span>
              </button>
            ) : (
              <button
                id="btn-load-bsave-into-viewport"
                onClick={handleApplyLoadedToCanvas}
                disabled={!decodedBsave}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-500 text-black font-bold flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Load into 2-Bit Viewport</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
