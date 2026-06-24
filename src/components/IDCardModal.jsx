import { QRCode } from 'react-qr-code';
import { X, Printer, GraduationCap } from 'lucide-react';

/**
 * IDCardModal — landscape CR80 ID card (85.6 × 54 mm)
 * card: { id, personId, personType, name, idNumber, username, password, schoolName, createdAt }
 */
export default function IDCardModal({ card, onClose }) {
  if (!card) return null;

  const isTeacher  = card.personType === 'teacher';
  const roleLabel  = isTeacher ? 'TEACHER' : 'STUDENT';
  const roleColor  = isTeacher ? '#3B82F6' : '#8B5CF6';
  const idLabel    = isTeacher ? 'Employee ID' : 'Admission No.';
  const schoolName = card.schoolName || 'School Portal';
  const initials   = card.name
    ? card.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const qrValue = JSON.stringify({
    name: card.name,
    role: card.personType,
    id: card.idNumber,
    username: card.username,
  });

  const handlePrint = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>ID Card – ${card.name}</title>
  <style>
    @page { size: 85.6mm 54mm landscape; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 85.6mm; height: 54mm; font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }
    .card { width: 85.6mm; height: 54mm; display: flex; overflow: hidden; }

    /* LEFT PANEL */
    .left { width: 32mm; background: linear-gradient(160deg, #1e293b 0%, #0f172a 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4mm 3mm; position: relative; flex-shrink: 0; }
    .left::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 3mm; background: ${roleColor}; }
    .avatar { width: 20mm; height: 20mm; border-radius: 50%; background: ${roleColor}; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 8.5mm; font-weight: 700; border: 0.7mm solid rgba(255,255,255,0.25); box-shadow: 0 2mm 6mm rgba(0,0,0,0.35); margin-bottom: 1.5mm; }
    .fullname { color: #fff; font-size: 2.8mm; font-weight: 700; text-align: center; line-height: 1.25; word-break: break-word; margin-bottom: 1mm; }
    .idno { color: #94a3b8; font-size: 2mm; font-family: monospace; text-align: center; margin-bottom: 2mm; }
    .role-badge { background: ${roleColor}; color: #fff; font-size: 1.6mm; font-weight: 800; letter-spacing: 0.8mm; padding: 0.6mm 2mm; border-radius: 99mm; }

    /* RIGHT PANEL */
    .right { flex: 1; display: flex; flex-direction: column; padding: 3mm 3mm 3mm 5mm; }
    .school-row { display: flex; align-items: center; gap: 1.5mm; padding-bottom: 2mm; border-bottom: 0.3mm solid #e2e8f0; margin-bottom: 2mm; }
    .school-icon { width: 5mm; height: 5mm; border-radius: 1.5mm; background: ${roleColor}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .school-icon svg { width: 3mm; height: 3mm; fill: #fff; }
    .school-name { font-size: 2.4mm; font-weight: 700; color: #1e293b; line-height: 1.2; }
    .school-sub  { font-size: 1.6mm; color: #94a3b8; }

    .main-row { display: flex; gap: 2mm; flex: 1; align-items: center; }

    /* QR area */
    .qr-box { background: #f8fafc; border: 0.3mm solid #e2e8f0; border-radius: 1.5mm; padding: 1.5mm; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

    /* Creds */
    .creds { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 1.2mm; }
    .cred-label { font-size: 1.7mm; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3mm; }
    .cred-val   { font-size: 2.2mm; color: #1e293b; font-family: monospace; font-weight: 700; }
    .cred-row   { border-bottom: 0.2mm solid #f1f5f9; padding-bottom: 1mm; }
    .cred-row:last-child { border-bottom: none; padding-bottom: 0; }

    /* Footer */
    .card-footer { font-size: 1.5mm; color: #cbd5e1; text-align: center; padding-top: 1.5mm; border-top: 0.3mm solid #f1f5f9; }

    @media print { html, body { background: none; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="left">
      <div class="avatar">${initials}</div>
      <div class="fullname">${card.name}</div>
      <div class="idno">${card.idNumber}</div>
      <span class="role-badge">${roleLabel}</span>
    </div>
    <div class="right">
      <div class="school-row">
        <div class="school-icon">
          <svg viewBox="0 0 24 24"><path d="M22 10v12H2V10l10-8 10 8zm-7 12v-5h-6v5h6z"/></svg>
        </div>
        <div>
          <div class="school-name">${schoolName}</div>
          <div class="school-sub">Official Identification Card</div>
        </div>
      </div>
      <div class="main-row">
        <div class="qr-box" id="qr-wrap">
          <div style="width:22mm;height:22mm;background:#e2e8f0;border-radius:1mm"></div>
        </div>
        <div class="creds">
          <div class="cred-row">
            <div class="cred-label">Username</div>
            <div class="cred-val">${card.username}</div>
          </div>
          <div class="cred-row">
            <div class="cred-label">Password</div>
            <div class="cred-val">${card.password}</div>
          </div>
          <div class="cred-row">
            <div class="cred-label">${idLabel}</div>
            <div class="cred-val">${card.idNumber}</div>
          </div>
        </div>
      </div>
      <div class="card-footer">Scan QR to verify identity &nbsp;•&nbsp; Keep this card safe &nbsp;•&nbsp; ${schoolName}</div>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
  <script>
    var mmToPx = function(mm) { return mm * 3.7795275591; };
    QRCode.toCanvas(document.createElement('canvas'), ${JSON.stringify(qrValue)},
      { width: Math.round(mmToPx(22)), margin: 1, color: { dark: '#0f172a', light: '#f8fafc' } },
      function(err, canvas) {
        var wrap = document.getElementById('qr-wrap');
        wrap.innerHTML = '';
        if (!err) { canvas.style.width = '22mm'; canvas.style.height = '22mm'; wrap.appendChild(canvas); }
        setTimeout(function() { window.print(); }, 400);
      }
    );
  </script>
</body>
</html>`;
    const w = window.open('', '_blank', 'width=500,height=360');
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Modal shell — wide enough for landscape card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">ID Card Generated</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Account created — print or save as PDF</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Card preview — landscape, CR80 aspect ratio 85.6:54 ≈ 1.585 */}
        <div className="px-6 pt-5 pb-1 flex justify-center">
          <div
            className="select-none rounded-2xl overflow-hidden shadow-xl border border-slate-200"
            style={{ width: '100%', maxWidth: 500, aspectRatio: '85.6 / 54', display: 'flex' }}
          >
            {/* ── LEFT PANEL ── */}
            <div
              className="flex flex-col items-center justify-center gap-1.5 shrink-0 relative"
              style={{
                width: '37.4%',
                background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)',
                paddingInline: '1rem',
              }}
            >
              {/* Accent stripe */}
              <div className="absolute right-0 top-0 bottom-0 w-[5px]" style={{ background: roleColor }} />

              {/* Avatar */}
              <div
                className="rounded-full flex items-center justify-center text-white font-bold"
                style={{
                  width: '52%', aspectRatio: '1',
                  fontSize: 'clamp(14px, 5vw, 32px)',
                  background: roleColor,
                  border: '3px solid rgba(255,255,255,0.25)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                }}
              >
                {initials}
              </div>

              <p className="text-white font-bold text-center leading-tight" style={{ fontSize: 'clamp(8px, 1.6vw, 13px)' }}>
                {card.name}
              </p>
              <p className="text-slate-400 font-mono text-center" style={{ fontSize: 'clamp(6px, 1.1vw, 10px)' }}>
                {card.idNumber}
              </p>
              <span
                className="text-white font-black tracking-widest rounded-full"
                style={{
                  fontSize: 'clamp(5px, 0.9vw, 8px)',
                  letterSpacing: '0.1em',
                  padding: '2px 8px',
                  background: roleColor,
                }}
              >
                {roleLabel}
              </span>
            </div>

            {/* ── RIGHT PANEL ── */}
            <div className="flex-1 bg-white flex flex-col" style={{ padding: '4% 4% 3%' }}>
              {/* School header */}
              <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100" style={{ flexShrink: 0 }}>
                <div
                  className="rounded-lg flex items-center justify-center shrink-0"
                  style={{ width: '8%', aspectRatio: '1', background: roleColor }}
                >
                  <GraduationCap className="text-white" style={{ width: '60%', height: '60%' }} />
                </div>
                <div>
                  <p className="text-slate-800 font-bold leading-tight" style={{ fontSize: 'clamp(7px, 1.4vw, 11px)' }}>
                    {schoolName}
                  </p>
                  <p className="text-slate-400" style={{ fontSize: 'clamp(5px, 1vw, 8px)' }}>
                    Official Identification Card
                  </p>
                </div>
              </div>

              {/* QR + Credentials row */}
              <div className="flex gap-3 flex-1 items-center">
                {/* QR Code */}
                <div className="bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center p-1.5 shrink-0"
                  style={{ width: '35%', aspectRatio: '1' }}>
                  <QRCode
                    value={qrValue}
                    size={200}
                    bgColor="#f8fafc"
                    fgColor="#0f172a"
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>

                {/* Credentials */}
                <div className="flex-1 flex flex-col justify-center gap-1.5">
                  {[
                    { label: 'Username', value: card.username },
                    { label: 'Password', value: card.password },
                    { label: idLabel,   value: card.idNumber  },
                  ].map(({ label, value }) => (
                    <div key={label} className="border-b border-slate-50 pb-1 last:border-0 last:pb-0">
                      <p className="text-slate-400 uppercase font-semibold tracking-wider"
                        style={{ fontSize: 'clamp(5px, 0.95vw, 8px)' }}>
                        {label}
                      </p>
                      <p className="text-slate-800 font-mono font-bold leading-tight"
                        style={{ fontSize: 'clamp(6px, 1.3vw, 11px)' }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <p className="text-slate-300 text-center border-t border-slate-50 pt-1.5 mt-1.5"
                style={{ fontSize: 'clamp(4px, 0.85vw, 7px)' }}>
                Scan QR to verify identity &nbsp;•&nbsp; Keep this card safe
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 pt-4 pb-5 flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Printer size={15} /> Print / Save PDF
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
