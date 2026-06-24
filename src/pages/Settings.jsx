import { useState, useEffect, useCallback } from 'react';
import { Save, Plus, Eye, EyeOff, Trash2, User, Check, X, Clock, ChevronDown, ChevronUp, Wand2, CheckCircle, AlertTriangle } from 'lucide-react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

/* ─── constants ────────────────────────────────────────────────────── */
const SCHOOL_TYPES = ['Government', 'Private', 'International'];
const SECTION_CONFIG = [
  { section: 'Primary',   grades: '1 - 5',   subjects: 'Sinhala, English, Mathematics, Environmental Science, Religion, Art' },
  { section: 'Secondary', grades: '6 - 9',   subjects: 'Sinhala, English, Mathematics, Science, History, Geography, ICT, Religion, Art' },
  { section: 'Ordinary',  grades: '10 - 11', subjects: 'Sinhala, English, Mathematics, Science, History, Geography, ICT, Religion, Art' },
  { section: 'Advanced',  grades: '12 - 13', subjects: 'Stream-based: Science / Commerce / Arts' },
];
const GRADING = [
  { grade: 'A', range: '75 - 100', desc: 'Excellent' },
  { grade: 'B', range: '65 - 74',  desc: 'Very Good' },
  { grade: 'C', range: '55 - 64',  desc: 'Good' },
  { grade: 'S', range: '35 - 54',  desc: 'Satisfactory' },
  { grade: 'W', range: '0 - 34',   desc: 'Fail / Weak' },
];

export const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What is the name of the city where you were born?',
  'What was the name of your primary school?',
  'What is your mother\'s maiden name?',
  'What was your childhood nickname?',
  'What is the name of your favourite teacher?',
  'What street did you grow up on?',
  'What is your oldest sibling\'s middle name?',
  'What was the name of the hospital where you were born?',
  'What is the name of the town where your parents met?',
];

const TEACHER_FIELDS = [
  { key: 'name',           label: 'Full Name' },
  { key: 'email',          label: 'Email',          type: 'email' },
  { key: 'phone',          label: 'Phone' },
  { key: 'address',        label: 'Address' },
  { key: 'qualifications', label: 'Qualifications' },
];
const STUDENT_FIELDS = [
  { key: 'name',        label: 'Full Name' },
  { key: 'parentName',  label: 'Parent / Guardian Name' },
  { key: 'parentPhone', label: 'Parent Phone' },
  { key: 'parentEmail', label: 'Parent Email', type: 'email' },
  { key: 'address',     label: 'Address' },
];

const STATUS_STYLE = {
  pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

/* ─── small shared components ───────────────────────────────────────── */
function Field({ label, value, type = 'text', onChange, readOnly }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={onChange}
        readOnly={readOnly}
        className={`w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 ${readOnly ? 'bg-slate-50 dark:bg-slate-800/60 cursor-not-allowed' : ''}`}
      />
    </div>
  );
}

function getSectionForGrade(grade) {
  const g = Number(grade);
  if (g <= 5)  return 'Primary';
  if (g <= 9)  return 'Secondary';
  if (g <= 11) return 'Ordinary';
  return 'Advanced';
}

/* ═══════════════════════════════════════════════════════════════════════
   ADMIN / PRINCIPAL SETTINGS
═══════════════════════════════════════════════════════════════════════ */
function AdminSettings({ user }) {
  const [activeTab, setActiveTab] = useState('School Info');
  const [settings, setSettings]   = useState({});
  const [loading, setLoading]      = useState(true);
  const [saving, setSaving]        = useState(false);
  const [saved, setSaved]          = useState(false);

  // Parallel counts per grade (grades 1-13)
  const DEFAULT_PARALLEL_COUNTS = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [i + 1, 1]));
  const [parallelCounts, setParallelCounts] = useState(DEFAULT_PARALLEL_COUNTS);
  const [parallelSaving, setParallelSaving] = useState(false);
  const [parallelSaved, setParallelSaved]   = useState(false);

  // Auto-generate classes
  const [genModal,   setGenModal]   = useState(false);
  const [genPreview, setGenPreview] = useState([]);   // { grade, parallel, section, exists }
  const [genLoading, setGenLoading] = useState(false);
  const [genDone,    setGenDone]    = useState(null); // { created, skipped }

  // School logo / flag
  const [schoolLogo, setSchoolLogo]   = useState('');
  const [schoolFlag, setSchoolFlag]   = useState('');
  const [logoSaving, setLogoSaving]   = useState(false);
  const [flagSaving, setFlagSaving]   = useState(false);

  // User management
  const [users, setUsers]                   = useState([]);
  const [userTab, setUserTab]               = useState('Admins');
  const [userModal, setUserModal]           = useState(false);
  const [passModal, setPassModal]           = useState(false);
  const [deleteUserModal, setDeleteUserModal] = useState(false);
  const [selectedUser, setSelectedUser]     = useState(null);
  const [userForm, setUserForm]             = useState({ username: '', name: '', email: '', role: 'teacher', password: '' });
  const [passForm, setPassForm]             = useState({ newPassword: '', confirm: '' });
  const [showPass, setShowPass]             = useState(false);
  const [userError, setUserError]           = useState('');
  const [passError, setPassError]           = useState('');
  const [userSaving, setUserSaving]         = useState(false);

  // Pending change requests
  const [requests, setRequests]   = useState([]);
  const [expanded, setExpanded]   = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const TABS = ['School Info', 'Academic', 'System', 'Approvals'];

  const USER_TABS = [
    { label: 'Admins', roles: ['admin', 'principal'] },
    { label: 'Staff',  roles: ['teacher'] },
    { label: 'Pupils', roles: ['student'] },
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const allSettings = await db.settings.toArray();
      const map = {};
      allSettings.forEach(s => { map[s.key] = s.value; });
      setSettings(map);
      setSchoolLogo(map.schoolLogo || '');
      setSchoolFlag(map.schoolFlag || '');
      if (map.parallelCounts) {
        try { setParallelCounts({ ...DEFAULT_PARALLEL_COUNTS, ...JSON.parse(map.parallelCounts) }); } catch { /* keep default */ }
      }

      const allUsers = await db.users.toArray();
      setUsers(allUsers);

      const reqs = await db.profileChangeRequests.orderBy('requestedAt').reverse().toArray();
      setRequests(reqs);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const SKIP_KEYS = ['schoolLogo', 'schoolFlag'];
      for (const [key, value] of Object.entries(settings)) {
        if (SKIP_KEYS.includes(key)) continue;
        const existing = await db.settings.where('key').equals(key).first();
        if (existing) await db.settings.update(existing.id, { value });
        else await db.settings.add({ key, value });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  const handleSaveParallelCounts = async () => {
    setParallelSaving(true);
    try {
      const value = JSON.stringify(parallelCounts);
      const existing = await db.settings.where('key').equals('parallelCounts').first();
      if (existing) await db.settings.update(existing.id, { value });
      else await db.settings.add({ key: 'parallelCounts', value });
      setParallelSaved(true);
      setTimeout(() => setParallelSaved(false), 3000);
    } finally { setParallelSaving(false); }
  };

  // Build a preview of what would be generated vs what already exists
  const openGenModal = async () => {
    setGenDone(null);
    setGenLoading(true);
    setGenModal(true);
    try {
      const academicYear    = settings.academicYear || String(new Date().getFullYear());
      const existingClasses = await db.classes.toArray();
      const existingSet     = new Set(
        existingClasses.map(c => `${c.grade}-${c.parallel}-${c.academicYear}`)
      );
      const preview = [];
      for (let grade = 1; grade <= 13; grade++) {
        const count = parallelCounts[grade] ?? 1;
        for (let i = 0; i < count; i++) {
          const parallel = String.fromCharCode(65 + i);
          preview.push({
            grade,
            parallel,
            section: getSectionForGrade(grade),
            exists: existingSet.has(`${grade}-${parallel}-${academicYear}`),
          });
        }
      }
      setGenPreview(preview);
    } finally {
      setGenLoading(false);
    }
  };

  // Create the classes that don't already exist
  const confirmGenerate = async () => {
    setGenLoading(true);
    try {
      const academicYear = settings.academicYear || String(new Date().getFullYear());
      const toCreate     = genPreview.filter(p => !p.exists);
      for (const cls of toCreate) {
        await db.classes.add({
          grade:          cls.grade,
          parallel:       cls.parallel,
          section:        cls.section,
          academicYear,
          classTeacherId: null,
          capacity:       40,
          isEnglishMedium: false,
        });
      }
      setGenDone({ created: toCreate.length, skipped: genPreview.length - toCreate.length });
      // Mark existing rows as existing so UI updates
      setGenPreview(prev => prev.map(p => ({ ...p, exists: true })));
    } finally {
      setGenLoading(false);
    }
  };

  const openAddUser    = () => { setSelectedUser(null); setUserForm({ username: '', name: '', email: '', role: 'teacher', password: '' }); setUserError(''); setUserModal(true); };
  const openChangePass = (u) => { setSelectedUser(u); setPassForm({ newPassword: '', confirm: '' }); setPassError(''); setPassModal(true); };
  const openDeleteUser = (u) => { setSelectedUser(u); setDeleteUserModal(true); };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!userForm.username.trim() || !userForm.password.trim()) { setUserError('Username and password required.'); return; }
    const exists = await db.users.where('username').equals(userForm.username).first();
    if (exists) { setUserError('Username already taken.'); return; }
    setUserSaving(true);
    try { await db.users.add({ ...userForm }); setUserModal(false); loadData(); }
    catch (err) { setUserError(err.message); } finally { setUserSaving(false); }
  };

  const handleChangePass = async (e) => {
    e.preventDefault();
    if (!passForm.newPassword) { setPassError('Password is required.'); return; }
    if (passForm.newPassword !== passForm.confirm) { setPassError('Passwords do not match.'); return; }
    setUserSaving(true);
    try { await db.users.update(selectedUser.id, { password: passForm.newPassword }); setPassModal(false); }
    catch (err) { setPassError(err.message); } finally { setUserSaving(false); }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    await db.users.delete(selectedUser.id);
    setDeleteUserModal(false); loadData();
  };

  /* School logo / flag upload */
  const saveImageSetting = async (key, dataUrl) => {
    const existing = await db.settings.where('key').equals(key).first();
    if (existing) await db.settings.update(existing.id, { value: dataUrl });
    else await db.settings.add({ key, value: dataUrl });
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoSaving(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setSchoolLogo(dataUrl);
      await saveImageSetting('schoolLogo', dataUrl);
      setLogoSaving(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setSchoolLogo('');
    await saveImageSetting('schoolLogo', '');
  };

  const handleFlagChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFlagSaving(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setSchoolFlag(dataUrl);
      await saveImageSetting('schoolFlag', dataUrl);
      setFlagSaving(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFlag = async () => {
    setSchoolFlag('');
    await saveImageSetting('schoolFlag', '');
  };

  /* Approval workflow */
  const handleReview = async (req, action) => {
    setReviewing(true);
    try {
      const now = new Date().toISOString();
      await db.profileChangeRequests.update(req.id, {
        status: action,
        reviewedAt: now,
        reviewedBy: user.id,
        reviewNote,
      });

      if (action === 'approved') {
        const appliedChanges = {};
        Object.entries(req.changes).forEach(([k, v]) => { appliedChanges[k] = v.to; });

        if (req.userRole === 'teacher' && req.linkedId) {
          await db.teachers.update(req.linkedId, appliedChanges);
          // Keep user account name in sync
          if (appliedChanges.name || appliedChanges.email) {
            const linked = await db.users.where('teacherId').equals(req.linkedId).first();
            if (linked) {
              const userUpdate = {};
              if (appliedChanges.name)  userUpdate.name  = appliedChanges.name;
              if (appliedChanges.email) userUpdate.email = appliedChanges.email;
              await db.users.update(linked.id, userUpdate);
            }
          }
        } else if (req.userRole === 'student' && req.linkedId) {
          await db.students.update(req.linkedId, appliedChanges);
          if (appliedChanges.name) {
            const linked = await db.users.where('studentId').equals(req.linkedId).first();
            if (linked) await db.users.update(linked.id, { name: appliedChanges.name });
          }
        }
      }

      setExpanded(null);
      setReviewNote('');
      loadData();
    } finally { setReviewing(false); }
  };

  const roleColor = {
    admin:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    principal:'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    teacher:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    student:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const visibleUsers = users.filter(u => USER_TABS.find(t => t.label === userTab)?.roles.includes(u.role));

  if (loading) return <div className="p-8 text-center text-slate-400">Loading settings…</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configure school portal settings</p>
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1 w-max min-w-full">
          {TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              {t}
              {t === 'Approvals' && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── School Info ── */}
      {activeTab === 'School Info' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">School Information</h3>

          {/* Logo + Flag uploads — TOP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* School Logo */}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">School Logo</p>
              <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 flex flex-col items-center gap-3">
                {schoolLogo ? (
                  <>
                    <img src={schoolLogo} alt="School logo" className="h-24 object-contain rounded-lg" />
                    <div className="flex gap-2">
                      <label className="cursor-pointer px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                        Change
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                      </label>
                      <button onClick={handleRemoveLogo} className="px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1">
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                    {logoSaving && <p className="text-xs text-slate-400">Saving…</p>}
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                      <User size={28} className="text-slate-400" />
                    </div>
                    <label className="cursor-pointer px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
                      {logoSaving ? 'Uploading…' : 'Upload Logo'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                    </label>
                    <p className="text-xs text-slate-400">PNG, JPG, SVG — max 2 MB</p>
                  </>
                )}
              </div>
            </div>

            {/* School Flag */}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">School Flag</p>
              <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 flex flex-col items-center gap-3">
                {schoolFlag ? (
                  <>
                    <img src={schoolFlag} alt="School flag" className="h-24 object-contain rounded-lg" />
                    <div className="flex gap-2">
                      <label className="cursor-pointer px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                        Change
                        <input type="file" accept="image/*" className="hidden" onChange={handleFlagChange} />
                      </label>
                      <button onClick={handleRemoveFlag} className="px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1">
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                    {flagSaving && <p className="text-xs text-slate-400">Saving…</p>}
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                      <User size={28} className="text-slate-400" />
                    </div>
                    <label className="cursor-pointer px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
                      {flagSaving ? 'Uploading…' : 'Upload Flag'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleFlagChange} />
                    </label>
                    <p className="text-xs text-slate-400">PNG, JPG — recommended 3:2 ratio</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Text fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[{ label: 'School Name', key: 'schoolName' }, { label: 'Principal Name', key: 'principalName' }, { label: 'Phone', key: 'phone' }, { label: 'Email', key: 'email' }].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{f.label}</label>
                <input value={settings[f.key] || ''} onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">School Type</label>
              <select value={settings.schoolType || 'Government'} onChange={e => setSettings(s => ({ ...s, schoolType: e.target.value }))}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
                {SCHOOL_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Address</label>
              <input value={settings.address || ''} onChange={e => setSettings(s => ({ ...s, address: e.target.value }))}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
            </div>
          </div>

          <button onClick={handleSaveSettings} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
            <Save size={15} /> {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* ── Academic ── */}
      {activeTab === 'Academic' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Academic Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Current Academic Year</label>
                <input value={settings.academicYear || '2025'} onChange={e => setSettings(s => ({ ...s, academicYear: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Current Term</label>
                <select value={settings.currentTerm || '1'} onChange={e => setSettings(s => ({ ...s, currentTerm: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
                  <option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option>
                </select>
              </div>
            </div>
            <button onClick={handleSaveSettings} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
              <Save size={15} /> {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Parallel Classes per Grade</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Set how many parallel classes exist for each grade. The parallel dropdown in the Add Class form will show that many letters (A, B, C…).</p>
            {[
              { label: 'Primary',   grades: [1,2,3,4,5] },
              { label: 'Secondary', grades: [6,7,8,9] },
              { label: 'Ordinary',  grades: [10,11] },
              { label: 'Advanced',  grades: [12,13] },
            ].map(section => (
              <div key={section.label} className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">{section.label}</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {section.grades.map(grade => (
                    <div key={grade}>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Grade {grade}</label>
                      <input
                        type="number"
                        min={1}
                        max={26}
                        value={parallelCounts[grade] ?? 1}
                        onChange={e => setParallelCounts(prev => ({ ...prev, [grade]: Math.min(26, Math.max(1, Number(e.target.value))) }))}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-center dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                      />
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1">
                        {Array.from({ length: parallelCounts[grade] ?? 1 }, (_, i) => String.fromCharCode(65 + i)).join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={handleSaveParallelCounts} disabled={parallelSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                <Save size={15} /> {parallelSaving ? 'Saving…' : parallelSaved ? 'Saved!' : 'Save Parallel Settings'}
              </button>
              <button onClick={openGenModal}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                <Wand2 size={15} /> Generate Classes
              </button>
            </div>
          </div>

          {/* ── Generate Classes Modal ───────────────────────────────────── */}
          <Modal
            isOpen={genModal}
            onClose={() => setGenModal(false)}
            title="Auto-Generate Classes"
            size="lg"
            footer={
              genDone ? (
                <button onClick={() => setGenModal(false)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Done
                </button>
              ) : (
                <>
                  <button onClick={() => setGenModal(false)}
                    className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                    Cancel
                  </button>
                  <button onClick={confirmGenerate} disabled={genLoading || genPreview.every(p => p.exists)}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60">
                    <Wand2 size={14} />
                    {genLoading ? 'Generating…' : `Generate ${genPreview.filter(p => !p.exists).length} Classes`}
                  </button>
                </>
              )
            }
          >
            {genLoading && !genPreview.length ? (
              <div className="py-10 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Result banner */}
                {genDone && (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/10 p-4 flex items-center gap-3">
                    <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Classes generated successfully</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        {genDone.created} class{genDone.created !== 1 ? 'es' : ''} created
                        {genDone.skipped > 0 && ` · ${genDone.skipped} already existed (skipped)`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Info */}
                {!genDone && (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 p-4 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <p className="font-semibold">What this will do</p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      <li>Create one class per grade/parallel combination based on your parallel counts above</li>
                      <li>Academic year: <strong>{settings.academicYear || new Date().getFullYear()}</strong></li>
                      <li>No class teacher assigned — assign from the class detail page</li>
                      <li>Classes that already exist for this year are skipped automatically</li>
                    </ul>
                  </div>
                )}

                {/* Summary counts */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium">
                    {genPreview.filter(p => !p.exists).length} to create
                  </span>
                  {genPreview.filter(p => p.exists).length > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                      {genPreview.filter(p => p.exists).length} already exist
                    </span>
                  )}
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">
                    {genPreview.length} total
                  </span>
                </div>

                {/* Per-section class list */}
                {[
                  { label: 'Primary',   grades: [1,2,3,4,5],   dot: 'bg-blue-500',    text: 'text-blue-600 dark:text-blue-400' },
                  { label: 'Secondary', grades: [6,7,8,9],     dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Ordinary',  grades: [10,11],        dot: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400' },
                  { label: 'Advanced',  grades: [12,13],        dot: 'bg-purple-500',  text: 'text-purple-600 dark:text-purple-400' },
                ].map(sec => {
                  const rows = genPreview.filter(p => sec.grades.includes(p.grade));
                  if (!rows.length) return null;
                  return (
                    <div key={sec.label}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full ${sec.dot}`} />
                        <p className={`text-xs font-bold uppercase tracking-wide ${sec.text}`}>{sec.label}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {rows.map(p => (
                          <span key={`${p.grade}-${p.parallel}`}
                            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
                              p.exists
                                ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                                : 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
                            }`}>
                            {p.exists
                              ? <Check size={10} className="opacity-60" />
                              : <Wand2 size={10} />}
                            Grade {p.grade}{p.parallel}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {genPreview.every(p => p.exists) && !genDone && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={16} />
                    All classes for this academic year already exist — nothing to create.
                  </div>
                )}
              </div>
            )}
          </Modal>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Section Configuration</h3>
            <div className="space-y-3">
              {SECTION_CONFIG.map(s => (
                <div key={s.section} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-slate-800 dark:text-slate-100">{s.section}</h4>
                    <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full">Grades {s.grades}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{s.subjects}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Sri Lankan Grading System</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {['Grade', 'Marks Range', 'Description'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {GRADING.map(g => (
                    <tr key={g.grade}>
                      <td className="px-4 py-2 font-bold text-slate-800 dark:text-slate-100">{g.grade}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{g.range}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{g.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── System (User Management) ── */}
      {activeTab === 'System' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">User Management</h3>
              {userTab !== 'Pupils' && (
                <button onClick={openAddUser} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  <Plus size={14} /> Add User
                </button>
              )}
            </div>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mb-4">
              {USER_TABS.map(t => (
                <button key={t.label} onClick={() => setUserTab(t.label)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${userTab === t.label ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                  {t.label}
                  <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                    ({users.filter(u => USER_TABS.find(x => x.label === t.label)?.roles.includes(u.role)).length})
                  </span>
                </button>
              ))}
            </div>
            {userTab === 'Pupils' && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Pupil accounts are auto-created when students are added. Manage them via the Students page.</p>
            )}
            <div className="space-y-2">
              {visibleUsers.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No {userTab.toLowerCase()} found.</p>
              ) : visibleUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-400 text-xs font-bold shrink-0">
                      {u.name ? u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : u.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{u.name || u.username}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.username}{u.email ? ` · ${u.email}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize hidden sm:inline ${roleColor[u.role] || 'bg-slate-100 text-slate-600'}`}>{u.role}</span>
                    <button onClick={() => openChangePass(u)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-xs">Pass</button>
                    {u.id !== user?.id && (
                      <button onClick={() => openDeleteUser(u)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">System Information</h3>
            <div className="space-y-2 text-sm">
              {[['Application','Sri Dharmasoka School Portal'],['Version','1.0.0'],['Database','IndexedDB (Dexie 4)'],['Framework','React 18 + Vite'],['Styling','Tailwind CSS v4']].map(([k,v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">{k}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Approvals ── */}
      {activeTab === 'Approvals' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Profile Change Requests</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Review and apply changes requested by teachers and students.</p>
          </div>
          {requests.length === 0 ? (
            <div className="p-12 text-center">
              <Check size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-400 dark:text-slate-500">No change requests yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {requests.map(req => {
                const isOpen = expanded === req.id;
                return (
                  <div key={req.id} className="p-4">
                    <button className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setExpanded(isOpen ? null : req.id)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-bold shrink-0">
                          {req.userName?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{req.userName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {req.userRole} · {Object.keys(req.changes || {}).length} field(s) · {new Date(req.requestedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[req.status]}`}>{req.status}</span>
                        {isOpen ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="mt-4 space-y-3">
                        {/* Changes table */}
                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                              <tr>
                                {['Field', 'Current Value', 'Requested Value'].map(h => (
                                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                              {Object.entries(req.changes || {}).map(([field, { from, to }]) => (
                                <tr key={field}>
                                  <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 capitalize">{field}</td>
                                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{from || '—'}</td>
                                  <td className="px-4 py-2 text-emerald-700 dark:text-emerald-400 font-medium">{to || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {req.status === 'pending' ? (
                          <div className="space-y-2">
                            <textarea
                              value={reviewNote}
                              onChange={e => setReviewNote(e.target.value)}
                              placeholder="Optional note to the requester…"
                              rows={2}
                              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 resize-none"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => handleReview(req, 'approved')} disabled={reviewing}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg disabled:opacity-60">
                                <Check size={14} /> Approve & Apply
                              </button>
                              <button onClick={() => handleReview(req, 'rejected')} disabled={reviewing}
                                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg disabled:opacity-60">
                                <X size={14} /> Reject
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                            <p><span className="font-medium">Reviewed:</span> {req.reviewedAt ? new Date(req.reviewedAt).toLocaleString() : '—'}</p>
                            {req.reviewNote && <p><span className="font-medium">Note:</span> {req.reviewNote}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      <Modal isOpen={userModal} onClose={() => setUserModal(false)} title="Add New User" size="sm"
        footer={<><button onClick={() => setUserModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button><button onClick={handleAddUser} disabled={userSaving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">{userSaving ? 'Adding…' : 'Add User'}</button></>}>
        {userError && <p className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{userError}</p>}
        <form onSubmit={handleAddUser} className="space-y-4">
          {[{ label: 'Username *', key: 'username' }, { label: 'Full Name', key: 'name' }, { label: 'Email', key: 'email' }].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{f.label}</label>
              <input name={f.key} value={userForm[f.key]} onChange={e => setUserForm(u => ({ ...u, [f.key]: e.target.value }))}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Role</label>
            <select value={userForm.role} onChange={e => setUserForm(u => ({ ...u, role: e.target.value }))}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              <option value="admin">Admin</option><option value="principal">Principal</option><option value="teacher">Teacher</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Password *</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={userForm.password} onChange={e => setUserForm(u => ({ ...u, password: e.target.value }))}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 pr-9 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
              <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal isOpen={passModal} onClose={() => setPassModal(false)} title="Change Password" size="sm"
        footer={<><button onClick={() => setPassModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button><button onClick={handleChangePass} disabled={userSaving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">{userSaving ? 'Saving…' : 'Change Password'}</button></>}>
        {passError && <p className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{passError}</p>}
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Changing password for <strong>{selectedUser?.name || selectedUser?.username}</strong></p>
        <form onSubmit={handleChangePass} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">New Password</label>
            <input type="password" value={passForm.newPassword} onChange={e => setPassForm(f => ({ ...f, newPassword: e.target.value }))}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Confirm Password</label>
            <input type="password" value={passForm.confirm} onChange={e => setPassForm(f => ({ ...f, confirm: e.target.value }))}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>
        </form>
      </Modal>

      <Modal isOpen={deleteUserModal} onClose={() => setDeleteUserModal(false)} title="Delete User" size="sm"
        footer={<><button onClick={() => setDeleteUserModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button><button onClick={handleDeleteUser} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button></>}>
        <p className="text-slate-600 dark:text-slate-300">Delete user <strong>{selectedUser?.name || selectedUser?.username}</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TEACHER / STUDENT PROFILE SETTINGS
═══════════════════════════════════════════════════════════════════════ */
function ProfileSettings({ user }) {
  const isTeacher = user.role === 'teacher';
  const fields    = isTeacher ? TEACHER_FIELDS : STUDENT_FIELDS;
  const linkedId  = isTeacher ? user.teacherId : user.studentId;

  const [profile, setProfile]     = useState(null);
  const [form, setForm]           = useState({});
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('My Profile');

  // My requests history
  const [myRequests, setMyRequests] = useState([]);

  // Password change
  const [passForm, setPassForm]       = useState({ current: '', newPass: '', confirm: '' });
  const [showPassFields, setShowPassFields] = useState({ current: false, newPass: false, confirm: false });
  const [passError, setPassError]     = useState('');
  const [passSaving, setPassSaving]   = useState(false);
  const [passSaved, setPassSaved]     = useState(false);

  // Profile photo
  const [photoUrl, setPhotoUrl]       = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);

  // Security questions
  const [sqForm, setSqForm]     = useState({ q1: '', a1: '', q2: '', a2: '' });
  const [sqSaving, setSqSaving] = useState(false);
  const [sqSaved, setSqSaved]   = useState(false);
  const [sqError, setSqError]   = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted]   = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      // Always load user record first — needed for password + security questions
      const userRecord = await db.users.get(user.id);
      if (userRecord) {
        setPassForm(p => ({ ...p, current: userRecord.password || '' }));
        setPhotoUrl(userRecord.photoUrl || '');
        setSqForm({
          q1: userRecord.securityQ1 || '',
          a1: userRecord.securityA1 || '',
          q2: userRecord.securityQ2 || '',
          a2: userRecord.securityA2 || '',
        });
      }

      if (!linkedId) return;

      const record = isTeacher
        ? await db.teachers.get(linkedId)
        : await db.students.get(linkedId);
      setProfile(record || {});
      const initial = {};
      fields.forEach(f => { initial[f.key] = record?.[f.key] || ''; });
      setForm(initial);

      const reqs = await db.profileChangeRequests
        .where('userId').equals(user.id).reverse().sortBy('requestedAt');
      setMyRequests(reqs);
    } finally { setLoading(false); }
  }, [linkedId, isTeacher, user.id, fields]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSubmitChanges = async () => {
    if (!profile) return;
    // Build diff
    const changes = {};
    fields.forEach(f => {
      const from = profile[f.key] || '';
      const to   = form[f.key]    || '';
      if (from !== to) changes[f.key] = { from, to };
    });
    if (Object.keys(changes).length === 0) { setSubmitError('No changes detected.'); return; }

    setSubmitting(true);
    setSubmitError('');
    try {
      await db.profileChangeRequests.add({
        userId:      user.id,
        userRole:    user.role,
        linkedId,
        userName:    user.name || user.username,
        changes,
        status:      'pending',
        requestedAt: new Date().toISOString(),
        reviewedAt:  null,
        reviewedBy:  null,
        reviewNote:  '',
      });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
      loadProfile();
    } catch (err) {
      setSubmitError(err.message);
    } finally { setSubmitting(false); }
  };

  const handleChangePass = async (e) => {
    e.preventDefault();
    setPassError('');
    if (!passForm.newPass)  { setPassError('Enter a new password.'); return; }
    if (passForm.newPass !== passForm.confirm) { setPassError('Passwords do not match.'); return; }
    setPassSaving(true);
    try {
      await db.users.update(user.id, { password: passForm.newPass });
      setPassForm(p => ({ ...p, current: passForm.newPass, newPass: '', confirm: '' }));
      setPassSaved(true);
      setTimeout(() => setPassSaved(false), 3000);
    } catch (err) { setPassError(err.message); }
    finally { setPassSaving(false); }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoSaving(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setPhotoUrl(dataUrl);
      await db.users.update(user.id, { photoUrl: dataUrl });
      setPhotoSaving(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    setPhotoUrl('');
    await db.users.update(user.id, { photoUrl: '' });
  };

  const handleSaveSecurityQuestions = async (e) => {
    e.preventDefault();
    setSqError('');
    if (!sqForm.q1 || !sqForm.a1.trim()) { setSqError('Please select Question 1 and provide an answer.'); return; }
    if (!sqForm.q2 || !sqForm.a2.trim()) { setSqError('Please select Question 2 and provide an answer.'); return; }
    if (sqForm.q1 === sqForm.q2) { setSqError('Please choose two different questions.'); return; }
    setSqSaving(true);
    try {
      await db.users.update(user.id, {
        securityQ1: sqForm.q1,
        securityA1: sqForm.a1.trim().toLowerCase(),
        securityQ2: sqForm.q2,
        securityA2: sqForm.a2.trim().toLowerCase(),
      });
      setSqSaved(true);
      setTimeout(() => setSqSaved(false), 3000);
    } catch (err) { setSqError(err.message); }
    finally { setSqSaving(false); }
  };

  const hasPendingRequest = myRequests.some(r => r.status === 'pending');

  if (loading) return <div className="p-8 text-center text-slate-400">Loading profile…</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">My Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">View your profile and request changes</p>
      </div>

      <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1 w-max">
        {['My Profile', 'Change Password', 'My Requests'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            {t}
            {t === 'My Requests' && myRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                {myRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── My Profile ── */}
      {activeTab === 'My Profile' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5">
          {/* Profile header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-5 border-b border-slate-100 dark:border-slate-800">
            {/* Avatar / photo */}
            <div className="relative group shrink-0">
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 shadow-sm" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-2xl font-bold border-2 border-slate-200 dark:border-slate-700">
                  {(profile?.name || user.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )}
              {/* Hover overlay */}
              <label className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {photoSaving
                  ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <User size={18} className="text-white" />}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={photoSaving} />
              </label>
            </div>

            {/* Name, username, meta */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 dark:text-slate-100 text-lg leading-tight">{profile?.name || user.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                @{user.username}
                {isTeacher && profile?.employeeId && ` · ${profile.employeeId}`}
                {!isTeacher && profile?.admissionNo && ` · ${profile.admissionNo}`}
                {!isTeacher && profile?.grade && ` · Grade ${profile.grade}${profile.parallel || ''}`}
              </p>
              <span className="inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 capitalize">
                {user.role}
              </span>
            </div>

            {/* Photo actions */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg cursor-pointer transition-colors">
                <User size={12} /> {photoUrl ? 'Change Photo' : 'Upload Photo'}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={photoSaving} />
              </label>
              {photoUrl && (
                <button type="button" onClick={handleRemovePhoto}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <X size={12} /> Remove
                </button>
              )}
            </div>
          </div>

          {hasPendingRequest && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-lg px-4 py-3 text-sm">
              <Clock size={15} />
              You have a pending change request awaiting approval. You cannot submit another until it is reviewed.
            </div>
          )}

          {submitted && (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-lg px-4 py-3 text-sm">
              <Check size={15} /> Change request submitted! An admin will review it shortly.
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
              {hasPendingRequest ? 'Your current information' : 'Edit your information'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map(f => (
                <Field
                  key={f.key}
                  label={f.label}
                  type={f.type}
                  value={form[f.key]}
                  readOnly={hasPendingRequest}
                  onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))}
                />
              ))}
            </div>
          </div>

          {!hasPendingRequest && (
            <>
              {submitError && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{submitError}</p>
              )}
              <div className="flex items-center gap-3">
                <button onClick={handleSubmitChanges} disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                  <Save size={15} /> {submitting ? 'Submitting…' : 'Submit for Approval'}
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400">Changes require admin or principal approval before being applied.</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Change Password ── */}
      {activeTab === 'Change Password' && (
        <div className="space-y-5 max-w-lg">
          {/* Password change */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Change Password</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Applied immediately — no approval needed.</p>
            {passError && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{passError}</p>}
            {passSaved && <p className="text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg flex items-center gap-2"><Check size={14} /> Password updated successfully.</p>}
            <form onSubmit={handleChangePass} className="space-y-4">
              {/* Current Password — read-only with toggle */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showPassFields.current ? 'text' : 'password'}
                    value={passForm.current}
                    readOnly
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 pr-9 text-sm bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 cursor-not-allowed select-all"
                  />
                  <button type="button"
                    onClick={() => setShowPassFields(s => ({ ...s, current: !s.current }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    {showPassFields.current ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {/* New Password + Confirm — editable with toggle */}
              {[
                { label: 'New Password',         key: 'newPass' },
                { label: 'Confirm New Password', key: 'confirm' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{f.label}</label>
                  <div className="relative">
                    <input
                      type={showPassFields[f.key] ? 'text' : 'password'}
                      value={passForm[f.key]}
                      onChange={e => setPassForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 pr-9 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                    />
                    <button type="button"
                      onClick={() => setShowPassFields(s => ({ ...s, [f.key]: !s[f.key] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      {showPassFields[f.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              ))}
              <button type="submit" disabled={passSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                <Save size={15} /> {passSaving ? 'Saving…' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Security questions */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Security Questions</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Used to verify your identity if you forget your password. Answers are case-insensitive.
              </p>
            </div>
            {sqError && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{sqError}</p>}
            {sqSaved && <p className="text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg flex items-center gap-2"><Check size={14} /> Security questions saved.</p>}
            <form onSubmit={handleSaveSecurityQuestions} className="space-y-4">
              {[
                { qKey: 'q1', aKey: 'a1', label: 'Security Question 1' },
                { qKey: 'q2', aKey: 'a2', label: 'Security Question 2' },
              ].map(({ qKey, aKey, label }) => (
                <div key={qKey} className="space-y-2 p-4 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Question</label>
                    <select
                      value={sqForm[qKey]}
                      onChange={e => setSqForm(f => ({ ...f, [qKey]: e.target.value }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                    >
                      <option value="">— Select a question —</option>
                      {SECURITY_QUESTIONS.map(q => (
                        <option key={q} value={q} disabled={q === sqForm[qKey === 'q1' ? 'q2' : 'q1']}>
                          {q}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Answer</label>
                    <input
                      type="text"
                      value={sqForm[aKey]}
                      onChange={e => setSqForm(f => ({ ...f, [aKey]: e.target.value }))}
                      placeholder="Your answer…"
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              ))}
              <button type="submit" disabled={sqSaving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-60">
                <Save size={15} /> {sqSaving ? 'Saving…' : 'Save Security Questions'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── My Requests ── */}
      {activeTab === 'My Requests' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">My Change Requests</h3>
          </div>
          {myRequests.length === 0 ? (
            <div className="p-12 text-center">
              <Clock size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-400 dark:text-slate-500">No requests submitted yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {myRequests.map(req => (
                <div key={req.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {new Date(req.requestedAt).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[req.status]}`}>{req.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(req.changes || {}).map(([field, { to }]) => (
                      <span key={field} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                        <span className="font-medium capitalize">{field}:</span> {to}
                      </span>
                    ))}
                  </div>
                  {req.reviewNote && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">Admin note: {req.reviewNote}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ROOT EXPORT — routes by role
═══════════════════════════════════════════════════════════════════════ */
export default function Settings() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'principal') return <AdminSettings user={user} />;
  return <ProfileSettings user={user} />;
}
