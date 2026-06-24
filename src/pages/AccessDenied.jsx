import { useNavigate } from 'react-router-dom';
import { ShieldOff, ArrowLeft, Home } from 'lucide-react';

export default function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">

        {/* Error code */}
        <div className="relative select-none">
          <p className="text-[9rem] font-black leading-none text-slate-800 dark:text-slate-800 tracking-tight">
            403
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <ShieldOff size={36} className="text-red-400" />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            You don't have permission to view this page.<br />
            This area is restricted to authorised users only.
          </p>
        </div>

        {/* Error detail chip */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-xs font-mono text-red-400 tracking-wide">
            HTTP 403 — FORBIDDEN
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <ArrowLeft size={15} /> Go Back
          </button>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Home size={15} /> Back to Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}
