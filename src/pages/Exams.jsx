import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Calendar, Filter } from 'lucide-react';
import { db } from '../db/database';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import StudentExams from './StudentExams';

const ALL_SECTIONS = ['Whole School', 'Primary', 'Secondary', 'Ordinary', 'Advanced'];
const EXAM_TYPES = ['Term Test', 'Assessment', 'Practice', 'Mock Exam'];
const TERMS = ['1', '2', '3'];

const EMPTY_FORM = {
  name: '', type: 'Term Test', section: 'Whole School',
  academicYear: '2025', term: '1', startDate: '', endDate: '',
  description: '', status: 'Upcoming',
};

const sectionBadge = {
  'Whole School': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  Primary:        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Secondary:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Ordinary:       'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Advanced:       'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const statusColor = {
  Upcoming:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Ongoing:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const typeColor = {
  'Term Test':  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Assessment': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Practice':   'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  'Mock Exam':  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
};

function AdminExams() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'principal';

  const [exams, setExams]           = useState([]);
  const [filtered, setFiltered]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterSection, setFilterSection] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selected, setSelected]     = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const loadExams = useCallback(async () => {
    setLoading(true);
    try { const all = await db.exams.toArray(); setExams(all); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadExams(); }, [loadExams]);

  useEffect(() => {
    let res = [...exams];
    if (filterSection) res = res.filter(e => e.section === filterSection);
    if (filterTerm)    res = res.filter(e => e.term === filterTerm);
    res.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    setFiltered(res);
  }, [exams, filterSection, filterTerm]);

  const openAdd  = () => { setSelected(null); setForm(EMPTY_FORM); setError(''); setModalOpen(true); };
  const openEdit = (e) => { setSelected(e); setForm({ ...EMPTY_FORM, ...e }); setError(''); setModalOpen(true); };
  const openDelete = (e) => { setSelected(e); setDeleteModal(true); };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Exam name is required.'); return; }
    setSaving(true);
    try {
      // Keep grade undefined / remove it — exams are now section-level
      const { grade: _grade, ...rest } = form;
      const data = { ...rest };
      if (selected) { await db.exams.update(selected.id, data); }
      else          { await db.exams.add(data); }
      setModalOpen(false);
      loadExams();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    await db.exams.delete(selected.id);
    setDeleteModal(false);
    loadExams();
  };

  // Group by month
  const grouped = {};
  filtered.forEach(e => {
    const month = e.startDate ? e.startDate.slice(0, 7) : 'Unknown';
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(e);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Examinations</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage exam schedules by section</p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 self-start">
            <Plus size={15} /> <span className="hidden sm:inline">Add Exam</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-2 items-center">
        <Filter size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
        <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 w-full sm:w-auto">
          <option value="">All Sections</option>
          {ALL_SECTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterTerm} onChange={e => setFilterTerm(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 w-full sm:w-auto">
          <option value="">All Terms</option>
          {TERMS.map(t => <option key={t} value={t}>Term {t}</option>)}
        </select>
        {(filterSection || filterTerm) && (
          <button onClick={() => { setFilterSection(''); setFilterTerm(''); }}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Exam list grouped by month */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-400 dark:text-slate-500">
          No exams found
        </div>
      ) : (
        Object.entries(grouped).map(([month, monthExams]) => (
          <div key={month} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <Calendar size={15} className="text-blue-600" />
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">
                {month !== 'Unknown'
                  ? new Date(month + '-01').toLocaleDateString('en', { year: 'numeric', month: 'long' })
                  : 'No Date Set'}
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">({monthExams.length} exam{monthExams.length !== 1 ? 's' : ''})</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {monthExams.map(exam => (
                <div key={exam.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-600 text-white rounded-xl px-3 py-2 text-center min-w-[56px] shrink-0">
                      <p className="text-xs font-bold">{exam.startDate ? new Date(exam.startDate).toLocaleDateString('en', { day: '2-digit' }) : '--'}</p>
                      <p className="text-xs opacity-80">{exam.startDate ? new Date(exam.startDate).toLocaleDateString('en', { month: 'short' }) : ''}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-800 dark:text-slate-100">{exam.name}</h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sectionBadge[exam.section] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                          {exam.section || 'Unknown'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor[exam.type] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                          {exam.type}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Term {exam.term}</span>
                        {exam.endDate && exam.endDate !== exam.startDate && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            to {new Date(exam.endDate).toLocaleDateString('en', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                      {exam.description && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{exam.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-0 sm:ml-auto shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[exam.status] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {exam.status}
                    </span>
                    {isAdmin && (
                      <>
                        <button onClick={() => openEdit(exam)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"><Edit size={15} /></button>
                        <button onClick={() => openDelete(exam)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={15} /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Add / Edit Modal — admin only */}
      {isAdmin && <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Edit Exam' : 'Add Exam'} size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Saving...' : selected ? 'Save Changes' : 'Add Exam'}
            </button>
          </>
        }
      >
        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Exam Name *</label>
            <input name="name" value={form.name} onChange={handleFormChange}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Section</label>
            <select name="section" value={form.section} onChange={handleFormChange}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              {ALL_SECTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Type</label>
            <select name="type" value={form.type} onChange={handleFormChange}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Term</label>
            <select name="term" value={form.term} onChange={handleFormChange}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              {TERMS.map(t => <option key={t} value={t}>Term {t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Academic Year</label>
            <input name="academicYear" value={form.academicYear} onChange={handleFormChange}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Start Date</label>
            <input type="date" name="startDate" value={form.startDate} onChange={handleFormChange}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">End Date</label>
            <input type="date" name="endDate" value={form.endDate} onChange={handleFormChange}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Status</label>
            <select name="status" value={form.status} onChange={handleFormChange}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              <option>Upcoming</option><option>Ongoing</option><option>Completed</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Description</label>
            <textarea name="description" value={form.description} onChange={handleFormChange} rows={2}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 resize-none" />
          </div>
        </form>
      </Modal>}

      {/* Delete Modal — admin only */}
      {isAdmin && <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Exam" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-300">Delete exam <strong>{selected?.name}</strong>? This cannot be undone.</p>
      </Modal>}
    </div>
  );
}

export default function Exams() {
  const { user } = useAuth();
  return user?.role === 'student' ? <StudentExams /> : <AdminExams />;
}
