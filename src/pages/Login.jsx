import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, LogIn, ArrowLeft, ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../db/database';

/* Forgot-password steps:
   'username'  → enter username
   'questions' → answer 2 security questions
   'reset'     → enter new password
   'done'      → success
*/

function ForgotPassword({ onBack }) {
  const [step, setStep]           = useState('username');
  const [username, setUsername]   = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [answers, setAnswers]     = useState({ a1: '', a2: '' });
  const [newPass, setNewPass]     = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNew, setShowNew]     = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  /* Step 1 — find user and check they have security questions */
  const handleFindUser = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Please enter your username.'); return; }
    setLoading(true);
    try {
      const u = await db.users.where('username').equals(username.trim().toLowerCase()).first();
      if (!u) { setError('No account found with that username.'); return; }
      if (!u.securityQ1 || !u.securityQ2) {
        setError('No security questions set for this account. Please contact your admin to reset your password.');
        return;
      }
      setFoundUser(u);
      setStep('questions');
    } finally { setLoading(false); }
  };

  /* Step 2 — verify answers (case-insensitive, trimmed) */
  const handleVerifyAnswers = (e) => {
    e.preventDefault();
    setError('');
    const a1ok = answers.a1.trim().toLowerCase() === foundUser.securityA1;
    const a2ok = answers.a2.trim().toLowerCase() === foundUser.securityA2;
    if (!a1ok || !a2ok) {
      setError('One or more answers are incorrect. Please try again.');
      return;
    }
    setStep('reset');
  };

  /* Step 3 — set new password */
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!newPass) { setError('Please enter a new password.'); return; }
    if (newPass.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPass !== confirmPass) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await db.users.update(foundUser.id, { password: newPass });
      setStep('done');
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const inp = 'w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 placeholder:text-slate-400';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4 transition-colors">
          <ArrowLeft size={15} /> Back to sign in
        </button>

        {step === 'username' && (
          <>
            <div className="w-11 h-11 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-3">
              <KeyRound size={22} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Forgot password</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Enter your username to get started.</p>
          </>
        )}
        {step === 'questions' && (
          <>
            <div className="w-11 h-11 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-3">
              <ShieldCheck size={22} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Security check</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Answer your security questions to verify your identity.</p>
          </>
        )}
        {step === 'reset' && (
          <>
            <div className="w-11 h-11 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-3">
              <KeyRound size={22} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Set new password</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Choose a strong password for your account.</p>
          </>
        )}
        {step === 'done' && (
          <>
            <div className="w-11 h-11 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-3">
              <ShieldCheck size={22} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Password reset!</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Your password has been updated. You can now sign in.</p>
          </>
        )}
      </div>

      {/* Step indicator */}
      {step !== 'done' && (
        <div className="flex items-center gap-2">
          {['username', 'questions', 'reset'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s ? 'bg-blue-600 text-white' :
                ['username','questions','reset'].indexOf(step) > i ? 'bg-emerald-500 text-white' :
                'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>{i + 1}</div>
              {i < 2 && <div className={`h-0.5 w-8 rounded transition-colors ${['username','questions','reset'].indexOf(step) > i ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Step 1 — Username */}
      {step === 'username' && (
        <form onSubmit={handleFindUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              placeholder="Enter your username"
              className={inp}
              autoFocus
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-xl transition-colors text-sm">
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            {loading ? 'Searching…' : 'Continue'}
          </button>
        </form>
      )}

      {/* Step 2 — Security questions */}
      {step === 'questions' && foundUser && (
        <form onSubmit={handleVerifyAnswers} className="space-y-4">
          <div className="space-y-4">
            {[
              { q: foundUser.securityQ1, aKey: 'a1', label: 'Question 1' },
              { q: foundUser.securityQ2, aKey: 'a2', label: 'Question 2' },
            ].map(({ q, aKey, label }) => (
              <div key={aKey} className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{q}</p>
                <input
                  type="text"
                  value={answers[aKey]}
                  onChange={e => { setAnswers(a => ({ ...a, [aKey]: e.target.value })); setError(''); }}
                  placeholder="Your answer…"
                  className={inp}
                />
              </div>
            ))}
          </div>
          <button type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors text-sm">
            Verify Answers
          </button>
        </form>
      )}

      {/* Step 3 — New password */}
      {step === 'reset' && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPass}
                onChange={e => { setNewPass(e.target.value); setError(''); }}
                placeholder="At least 6 characters"
                className={`${inp} pr-10`}
              />
              <button type="button" onClick={() => setShowNew(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPass}
              onChange={e => { setConfirmPass(e.target.value); setError(''); }}
              placeholder="Re-enter new password"
              className={inp}
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium rounded-xl transition-colors text-sm">
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            {loading ? 'Saving…' : 'Reset Password'}
          </button>
        </form>
      )}

      {/* Done */}
      {step === 'done' && (
        <button onClick={onBack}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm">
          <LogIn size={16} /> Sign In Now
        </button>
      )}
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [view, setView]         = useState('login'); // 'login' | 'forgot'
  const [form, setForm]         = useState({ username: '', password: '', remember: false });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) { setError('Please enter username and password.'); return; }
    setLoading(true);
    try {
      await login(form.username.trim(), form.password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between bg-slate-900 w-2/5 p-12">
        <div className="flex h-1.5 rounded-full overflow-hidden w-32">
          <div className="flex-1 bg-orange-500" />
          <div className="flex-1 bg-green-600" />
          <div className="flex-1 bg-yellow-400" />
        </div>
        <div>
          <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center mb-6">
            <GraduationCap size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Sri Dharmasoka<br />National School
          </h1>
          <p className="text-slate-400 text-lg">
            Empowering students with knowledge, values, and excellence since 1945.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { label: 'Students', value: '1,200+' },
              { label: 'Teachers', value: '85+' },
              { label: 'Classes',  value: '39' },
              { label: 'Years',    value: '80+' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800 rounded-xl p-4">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-slate-400 text-sm mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-slate-600 text-sm">&copy; {new Date().getFullYear()} Sri Dharmasoka National School</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="lg:hidden flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-3">
            <GraduationCap size={30} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center">Sri Dharmasoka National School</h1>
        </div>

        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">

            {/* ── Forgot password view ── */}
            {view === 'forgot' ? (
              <ForgotPassword onBack={() => setView('login')} />
            ) : (
              /* ── Login view ── */
              <>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Welcome back</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Sign in to the school management portal</p>

                {error && (
                  <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-xl">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Username</label>
                    <input
                      type="text" name="username" value={form.username} onChange={handleChange}
                      placeholder="Enter your username"
                      className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      autoComplete="username"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
                      <button type="button" onClick={() => setView('forgot')}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange}
                        placeholder="Enter your password"
                        className="w-full px-3 py-2.5 pr-10 border border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        autoComplete="current-password"
                      />
                      <button type="button" onClick={() => setShowPass(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="remember" checked={form.remember} onChange={handleChange} className="rounded border-slate-300 dark:border-slate-600" />
                    <span className="text-sm text-slate-600 dark:text-slate-300">Remember me</span>
                  </label>

                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-xl transition-colors text-sm">
                    {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogIn size={16} />}
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center font-medium">Demo credentials</p>
                  {[
                    { label: 'Admin',     user: 'admin',     pass: 'admin123' },
                    { label: 'Principal', user: 'principal', pass: 'principal123' },
                  ].map(d => (
                    <button key={d.user} type="button"
                      onClick={() => setForm(f => ({ ...f, username: d.user, password: d.pass }))}
                      className="w-full text-left px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-300 transition-colors">
                      <span className="font-medium">{d.label}:</span> {d.user} / {d.pass}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
