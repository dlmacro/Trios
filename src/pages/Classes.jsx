import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, ChevronRight, GraduationCap, Eye, Globe } from 'lucide-react';
import { db } from '../db/database';
import Modal from '../components/Modal';
import TeacherPicker from '../components/TeacherPicker';

const SECTIONS = ['Primary', 'Secondary', 'Ordinary', 'Advanced'];
const SECTION_GRADES = { Primary: [1,2,3,4,5], Secondary: [6,7,8,9], Ordinary: [10,11], Advanced: [12,13] };
function getParallels(grade, parallelCounts) {
  const count = parallelCounts[Number(grade)] ?? 1;
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

const SECTION_STYLE = {
  Primary: {
    gradient: 'from-blue-500 to-blue-600',
    light: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800/50',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    dot: 'bg-blue-500',
    tab: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50',
    activeTab: 'bg-blue-600 text-white border-blue-600',
    headerText: 'text-blue-800 dark:text-blue-200',
  },
  Secondary: {
    gradient: 'from-emerald-500 to-emerald-600',
    light: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    tab: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50',
    activeTab: 'bg-emerald-600 text-white border-emerald-600',
    headerText: 'text-emerald-800 dark:text-emerald-200',
  },
  Ordinary: {
    gradient: 'from-amber-500 to-amber-600',
    light: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800/50',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dot: 'bg-amber-500',
    tab: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50',
    activeTab: 'bg-amber-600 text-white border-amber-600',
    headerText: 'text-amber-800 dark:text-amber-200',
  },
  Advanced: {
    gradient: 'from-purple-500 to-purple-600',
    light: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800/50',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    dot: 'bg-purple-500',
    tab: 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/50',
    activeTab: 'bg-purple-600 text-white border-purple-600',
    headerText: 'text-purple-800 dark:text-purple-200',
  },
};

function getSection(grade) {
  const g = Number(grade);
  if (g <= 5) return 'Primary';
  if (g <= 9) return 'Secondary';
  if (g <= 11) return 'Ordinary';
  return 'Advanced';
}

const EMPTY_FORM = { grade: '1', parallel: 'A', section: 'Primary', academicYear: '2025', classTeacherId: '', capacity: 40, isEnglishMedium: false };

function CapacityRing({ used, total }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const color = pct >= 90 ? 'text-red-500' : pct >= 70 ? 'text-amber-500' : 'text-emerald-500';
  const radius = 20;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-slate-700" />
        <circle
          cx="28" cy="28" r={radius} fill="none"
          stroke="currentColor" strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none">{used}</span>
        <span className="text-xs text-slate-400 dark:text-slate-500 leading-none">/{total}</span>
      </div>
    </div>
  );
}

export default function Classes() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [parallelCounts, setParallelCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(() => sessionStorage.getItem('classes_tab') || 'Primary');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cls, sts, tchs, pcSetting] = await Promise.all([
        db.classes.toArray(),
        db.students.toArray(),
        db.teachers.toArray(),
        db.settings.where('key').equals('parallelCounts').first(),
      ]);
      setClasses(cls);
      setStudents(sts);
      setTeachers(tchs);
      if (pcSetting?.value) {
        try { setParallelCounts(JSON.parse(pcSetting.value)); } catch { /* keep default */ }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getStudentCount = (grade, parallel) =>
    students.filter(s => Number(s.grade) === Number(grade) && s.parallel === parallel).length;
  const getTeacher = (id) => teachers.find(t => t.id === Number(id)) || null;
  const unassignedCount = students.filter(s => !s.grade || !s.parallel).length;

  const openAdd = () => { setSelected(null); setForm(EMPTY_FORM); setError(''); setModalOpen(true); };
  const openEdit = (c) => {
    setSelected(c);
    setForm({ ...EMPTY_FORM, ...c, grade: String(c.grade) });
    setError('');
    setModalOpen(true);
  };
  const openDelete = (c) => { setSelected(c); setDeleteModal(true); };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(f => {
      const u = { ...f, [name]: value };
      if (name === 'grade') { u.section = getSection(value); u.parallel = 'A'; }
      return u;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...form,
        grade: Number(form.grade),
        capacity: Number(form.capacity),
        classTeacherId: form.classTeacherId ? Number(form.classTeacherId) : null,
      };
      if (selected) {
        await db.classes.update(selected.id, data);
      } else {
        await db.classes.add(data);
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    await db.classes.delete(selected.id);
    setDeleteModal(false);
    loadData();
  };

  const sectionClasses = classes
    .filter(c => c.section === activeSection)
    .sort((a, b) => a.grade - b.grade || a.parallel.localeCompare(b.parallel));

  const style = SECTION_STYLE[activeSection];

  // Summary stats
  const totalClasses = classes.length;
  const totalStudents = students.filter(s => s.grade && s.parallel).length;
  const totalCapacity = classes.reduce((sum, c) => sum + (c.capacity || 40), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Classes</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {totalClasses} classes · {totalStudents}/{totalCapacity} students enrolled
            {unassignedCount > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">· {unassignedCount} unassigned</span>
            )}
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 self-start">
          <Plus size={15} /> Add Class
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SECTIONS.map(s => {
          const sc = classes.filter(c => c.section === s);
          const ss = students.filter(st => st.section === s && st.grade && st.parallel);
          const cap = sc.reduce((sum, c) => sum + (c.capacity || 40), 0);
          const st2 = SECTION_STYLE[s];
          return (
            <button
              key={s}
              onClick={() => { sessionStorage.setItem('classes_tab', s); setActiveSection(s); }}
              className={`relative rounded-xl p-4 border text-left transition-all hover:shadow-md ${
                activeSection === s
                  ? `${st2.light} ${st2.border} shadow-sm`
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className={`w-2.5 h-2.5 rounded-full mt-1 ${st2.dot}`} />
                {activeSection === s && <ChevronRight size={14} className={st2.headerText} />}
              </div>
              <p className={`text-lg font-bold ${activeSection === s ? st2.headerText : 'text-slate-800 dark:text-slate-100'}`}>{sc.length}</p>
              <p className={`text-xs font-medium ${activeSection === s ? st2.headerText : 'text-slate-600 dark:text-slate-300'}`}>{s}</p>
              <p className={`text-xs mt-0.5 ${activeSection === s ? st2.headerText + ' opacity-70' : 'text-slate-400 dark:text-slate-500'}`}>
                {ss.length}/{cap} students
              </p>
            </button>
          );
        })}
      </div>

      {/* Section class grid */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Section header */}
        <div className={`px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${style.dot}`} />
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{activeSection} Section</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Grades {SECTION_GRADES[activeSection][0]}–{SECTION_GRADES[activeSection][SECTION_GRADES[activeSection].length - 1]}
              </p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${style.badge}`}>
            {sectionClasses.length} classes
          </span>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : sectionClasses.length === 0 ? (
            <div className="py-12 text-center">
              <GraduationCap size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 dark:text-slate-500 text-sm">No classes in this section</p>
              <button onClick={openAdd} className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">Add a class →</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sectionClasses.map(c => {
                const classTeacher = getTeacher(c.classTeacherId);
                const studentCount = getStudentCount(c.grade, c.parallel);
                const cap = c.capacity || 40;
                const pct = Math.round((studentCount / cap) * 100);
                return (
                  <div
                    key={c.id}
                    className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                  >
                    {/* Color top bar */}
                    <div className={`h-1.5 bg-gradient-to-r ${style.gradient}`} />

                    <div className="p-4">
                      {/* Class name + capacity ring */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-slate-800 dark:text-slate-100">G{c.grade}</span>
                            <span className="text-xl font-bold text-slate-400 dark:text-slate-500">{c.parallel}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <p className="text-xs text-slate-400 dark:text-slate-500">{c.academicYear}</p>
                            {c.isEnglishMedium && (
                              <span className="flex items-center gap-0.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full font-medium">
                                <Globe size={9} /> EM
                              </span>
                            )}
                          </div>
                        </div>
                        <CapacityRing used={studentCount} total={cap} />
                      </div>

                      {/* Teacher */}
                      <div className="mb-3">
                        {classTeacher ? (
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                              {classTeacher.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{classTeacher.name}</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500">Class Supervisor</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic">No supervisor</p>
                        )}
                      </div>

                      {/* Capacity bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mb-1">
                          <span>{studentCount} students</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${style.gradient} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => navigate(`/classes/${c.id}`)}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${style.badge} hover:opacity-80`}
                        >
                          <Eye size={11} /> View Class
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-200 dark:hover:border-amber-700 transition-colors"
                          title="Edit"
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => openDelete(c)}
                          className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-700 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? 'Edit Class' : 'Add New Class'}
        size="md"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Saving...' : selected ? 'Save Changes' : 'Add Class'}
            </button>
          </>
        }
      >
        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Grade</label>
              <select name="grade" value={form.grade} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
                {Array.from({ length: 13 }, (_, i) => i + 1).map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Parallel</label>
              <select name="parallel" value={form.parallel} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
                {getParallels(form.grade, parallelCounts).map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Section (auto)</label>
            <input value={form.section} readOnly className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Class Supervisor</label>
            <TeacherPicker
              teachers={teachers.filter(t => t.status === 'Active')}
              value={form.classTeacherId || ''}
              onChange={id => setForm(f => ({ ...f, classTeacherId: id }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Academic Year</label>
              <input name="academicYear" value={form.academicYear} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Capacity</label>
              <input type="number" name="capacity" value={form.capacity} onChange={handleFormChange} min={1} max={60} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, isEnglishMedium: !f.isEnglishMedium }))}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
              form.isEnglishMedium
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Globe size={15} />
            English Medium Class
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold ${form.isEnglishMedium ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
              {form.isEnglishMedium ? 'ON' : 'OFF'}
            </span>
          </button>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Class"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeleteModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-300">
          Delete <strong>Grade {selected?.grade}{selected?.parallel}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
