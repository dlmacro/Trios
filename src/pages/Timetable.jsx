import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Printer } from 'lucide-react';
import { db } from '../db/database';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import StudentTimetable from './StudentTimetable';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const PARALLELS = ['A', 'B', 'C'];
const PERIOD_TIMES = { 1: '7:30-8:15', 2: '8:15-9:00', 3: '9:00-9:45', 4: '9:45-10:30', 5: '10:45-11:30', 6: '11:30-12:15', 7: '13:00-13:45', 8: '13:45-14:30' };
const SUBJECT_COLORS = ['bg-blue-100 text-blue-800', 'bg-emerald-100 text-emerald-800', 'bg-amber-100 text-amber-800', 'bg-purple-100 text-purple-800', 'bg-pink-100 text-pink-800', 'bg-orange-100 text-orange-800', 'bg-teal-100 text-teal-800', 'bg-indigo-100 text-indigo-800'];

const EMPTY_FORM = { classId: '', day: 'Monday', period: '1', subjectId: '', teacherId: '', room: '' };

export default function Timetable() {
  const { user } = useAuth();
  if (user?.role === 'student') return <StudentTimetable />;
  const [grade, setGrade] = useState('');
  const [parallel, setParallel] = useState('A');
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [subjectColorMap, setSubjectColorMap] = useState({});

  useEffect(() => {
    Promise.all([db.classes.toArray(), db.teachers.toArray()]).then(([cls, tchs]) => {
      setClasses(cls); setTeachers(tchs);
    }).catch(() => {});
  }, []);

  const loadTimetable = useCallback(async () => {
    if (!grade) return;
    setLoading(true);
    try {
      const cls = classes.find(c => Number(c.grade) === Number(grade) && c.parallel === parallel);
      setSelectedClass(cls || null);
      if (!cls) { setTimetable([]); setSubjects([]); setLoading(false); return; }
      const [tt, subs] = await Promise.all([
        db.timetable.where('classId').equals(cls.id).toArray(),
        db.subjects.where('grade').equals(Number(grade)).toArray(),
      ]);
      setTimetable(tt);
      setSubjects(subs);
      const colorMap = {};
      subs.forEach((s, i) => { colorMap[s.id] = SUBJECT_COLORS[i % SUBJECT_COLORS.length]; });
      setSubjectColorMap(colorMap);
    } finally { setLoading(false); }
  }, [grade, parallel, classes]);

  useEffect(() => { loadTimetable(); }, [loadTimetable]);

  const getCell = (day, period) => timetable.find(t => t.day === day && t.period === Number(period));
  const getSubjectName = (id) => subjects.find(s => s.id === id)?.name || '';
  const getTeacherName = (id) => teachers.find(t => t.id === id)?.name || '';

  const openAdd = (day, period) => {
    if (!selectedClass) return;
    setSelected(null);
    setForm({ ...EMPTY_FORM, classId: selectedClass.id, day, period: String(period) });
    setError(''); setModalOpen(true);
  };

  const openEdit = (entry) => {
    setSelected(entry);
    setForm({ classId: entry.classId, day: entry.day, period: String(entry.period), subjectId: String(entry.subjectId || ''), teacherId: String(entry.teacherId || ''), room: entry.room || '' });
    setError(''); setModalOpen(true);
  };

  const openDelete = (entry) => { setSelected(entry); setDeleteModal(true); };
  const handleFormChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.subjectId) { setError('Please select a subject.'); return; }
    setSaving(true);
    try {
      const data = { classId: Number(form.classId), day: form.day, period: Number(form.period), subjectId: Number(form.subjectId), teacherId: form.teacherId ? Number(form.teacherId) : null, room: form.room };
      if (selected) { await db.timetable.update(selected.id, data); } else { await db.timetable.add(data); }
      setModalOpen(false); loadTimetable();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => { if (!selected) return; await db.timetable.delete(selected.id); setDeleteModal(false); loadTimetable(); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Timetable</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">View and manage class timetables</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 self-start">
          <Printer size={15} /> <span className="hidden sm:inline">Print</span>
        </button>
      </div>

      {/* Grade/Parallel selectors — stack on mobile */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Grade</label>
          <select value={grade} onChange={e => setGrade(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 w-full sm:w-auto">
            <option value="">Select Grade</option>
            {Array.from({ length: 13 }, (_, i) => i + 1).map(g => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Parallel</label>
          <select value={parallel} onChange={e => setParallel(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 w-full sm:w-auto">
            {PARALLELS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {!grade ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400 dark:text-slate-500">Select a grade and parallel to view the timetable</div>
      ) : loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6"><div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" /></div>
      ) : !selectedClass ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-400 dark:text-slate-500">No class found for Grade {grade} - {parallel}</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Grade {grade} - {parallel} Weekly Timetable</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Click an empty cell to add a period</p>
          </div>
          {/* Timetable grid — horizontally scrollable on mobile */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-[90px]">Period</th>
                  {DAYS.map(day => <th key={day} className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-200 min-w-[110px]">{day}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(period => (
                  <tr key={period}>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center bg-slate-50 dark:bg-slate-800/50 min-w-[90px]">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">P{period}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{PERIOD_TIMES[period]}</p>
                    </td>
                    {DAYS.map(day => {
                      const cell = getCell(day, period);
                      return (
                        <td key={day} className="border border-slate-200 dark:border-slate-700 p-1.5 min-w-[110px]">
                          {cell ? (
                            <div className={`rounded-lg p-2 group relative cursor-pointer ${subjectColorMap[cell.subjectId] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                              <p className="text-xs font-semibold truncate">{getSubjectName(cell.subjectId)}</p>
                              <p className="text-xs opacity-70 truncate">{getTeacherName(cell.teacherId)}</p>
                              {cell.room && <p className="text-xs opacity-60">{cell.room}</p>}
                              <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                                <button onClick={() => openEdit(cell)} className="p-0.5 bg-white/80 dark:bg-slate-900/80 rounded hover:text-amber-600"><Edit size={10} /></button>
                                <button onClick={() => openDelete(cell)} className="p-0.5 bg-white/80 dark:bg-slate-900/80 rounded hover:text-red-600"><Trash2 size={10} /></button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => openAdd(day, period)} className="w-full h-14 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                              <Plus size={14} className="text-slate-300 dark:text-slate-600" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Edit Period' : 'Add Period'} size="sm"
        footer={<>
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
        </>}
      >
        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Day</label>
              <select name="day" value={form.day} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Period</label>
              <select name="period" value={form.period} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
                {PERIODS.map(p => <option key={p} value={p}>P{p} ({PERIOD_TIMES[p]})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Subject *</label>
            <select name="subjectId" value={form.subjectId} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              <option value="">-- Select Subject --</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Teacher</label>
            <select name="teacherId" value={form.teacherId} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              <option value="">-- Select Teacher --</option>
              {teachers.filter(t => t.status === 'Active').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Room</label>
            <input name="room" value={form.room} onChange={handleFormChange} placeholder="e.g. Room 201" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>
        </form>
      </Modal>

      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Remove Period" size="sm"
        footer={<>
          <button onClick={() => setDeleteModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
          <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Remove</button>
        </>}
      >
        <p className="text-slate-600 dark:text-slate-300">Remove this period from the timetable?</p>
      </Modal>
    </div>
  );
}
