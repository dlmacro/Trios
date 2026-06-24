import { useRef, useState } from 'react';
import { QRCode } from 'react-qr-code';
import { X, Download, Share2, Copy, Check } from 'lucide-react';

const SECTION_ACCENT = {
  Primary:   { from: '#2563eb', to: '#1d4ed8' },
  Secondary: { from: '#059669', to: '#047857' },
  Ordinary:  { from: '#d97706', to: '#b45309' },
  Advanced:  { from: '#7c3aed', to: '#6d28d9' },
};

export default function ClassQRModal({ isOpen, onClose, classId, classLabel, section }) {
  const [copied, setCopied] = useState(false);
  const qrWrapRef = useRef(null);

  if (!isOpen) return null;

  const url = `${window.location.origin}/marks/entry?classId=${classId}`;
  const accent = SECTION_ACCENT[section] || { from: '#4f46e5', to: '#4338ca' };
  const gradientStyle = { background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const svg = qrWrapRef.current?.querySelector('svg');
    if (!svg) return;

    const SIZE = 300;
    const PAD  = 32;
    const FOOTER = 56;
    const W = SIZE + PAD * 2;
    const H = SIZE + PAD * 2 + FOOTER;

    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, PAD, PAD, SIZE, SIZE);
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 18px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(classLabel, W / 2, SIZE + PAD + 24);
      ctx.fillStyle = '#64748b';
      ctx.font = '13px system-ui,sans-serif';
      ctx.fillText('Scan to enter marks', W / 2, SIZE + PAD + 44);
      const a = document.createElement('a');
      a.download = `QR-${classLabel.replace(/\s+/g, '-')}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `Marks Entry — ${classLabel}`, url }); return; } catch { /* fall through */ }
    }
    handleCopy();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl">
        {/* Gradient header */}
        <div style={gradientStyle} className="px-6 pt-6 pb-12 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest mb-1">
                Marks Entry · {section}
              </p>
              <h2 className="text-2xl font-black leading-tight">{classLabel}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 transition-colors mt-0.5"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* White body */}
        <div className="bg-white dark:bg-slate-900 px-6 pb-6">
          {/* QR box — overlaps the gradient */}
          <div
            ref={qrWrapRef}
            className="-mt-8 bg-white rounded-2xl p-5 shadow-xl flex items-center justify-center"
          >
            <QRCode
              value={url}
              size={220}
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
          </div>

          {/* URL strip */}
          <div className="mt-4 flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
            <p className="flex-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{url}</p>
            <button
              onClick={handleCopy}
              className="shrink-0 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Copy link"
            >
              {copied
                ? <Check size={13} className="text-emerald-500" />
                : <Copy size={13} className="text-slate-400" />}
            </button>
          </div>
          {copied && <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 ml-1">Copied!</p>}

          {/* Buttons */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-colors"
            >
              <Download size={14} /> Save PNG
            </button>
            <button
              onClick={handleShare}
              style={gradientStyle}
              className="flex items-center justify-center gap-2 px-3 py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Share2 size={14} /> Share
            </button>
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
            Scan with any camera to open marks entry for this class
          </p>
        </div>
      </div>
    </div>
  );
}
