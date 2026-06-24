import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Save, CheckCircle, AlertCircle, ArrowLeft, BookOpen, Users } from 'lucide-react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';

function getGrade(marks) {
  const m = Number(marks);
  if (m >= 75) return 'A';
  if (m >= 65) return 'B';
  if (m >= 55) return 'C';
  if (m >= 35) return 'S';
  return 'W';
}

const gradeColor = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  C: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  S: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  W: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function MarksEntry() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const classId = params.get('classId') ? Number(params.get('classId')) : null;
  const isAdmin = user?.role === 'admin' || user?.role === 'principal';
  const backPath = isAdmin ? '/marks' : '/';

  const [cls, setCls]               = useState(null);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [students, setStudents]     = useState([]);
  const [exams, setExams]           = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [marks, setMarks]           = useState({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState('');
  const [authorized, setAuthorized] = useState(false);

  // Load class, verify access, load subjects available to this user for this class
  useEffect(() => {
    if (!classId) { setError('Invalid link — missing class.'); setLoading(false); return; }

    (async () => {
      try {
        const classRecord = await db.classes.get(classId);
        if (!classRecord) { setError('Class not found.'); setLoading(false); return; }
        setCls(classRecord);

        let isAuthorized = user?.role === 'admin' || user?.role === 'principal';
        let subjects = [];

        if (user?.role === 'teacher') {
          const teacherRecord = await db.teachers.where('name').equals(user.name).first();
          if (teacherRecord) {
            const assignments = await db.subjectTeachers
              .where('classId').equals(classId)
              .and(st => st.teacherId === teacherRecord.id)
              .toArray();
            if (assignments.length > 0) {
              isAuthorized = true;
              subjects = await Promise.all(
                assignments.map(st => db.subjects.get(st.subjectId))
              );
              subjects = subjects.filter(Boolean);
              subjects.sort((a, b) => a.name.localeCompare(b.name));
            }
          }
        } else if (isAuthorized) {
          // Admin/principal: all subjects matching this class's grade and section
          const all = await db.subjects
            .where('grade').equals(classRecord.grade)
            .toArray();
          subjects = all.filter(s => s.section === classRecord.section);
          subjects.sort((a, b) => a.name.localeCompare(b.name));
        }

        setAuthorized(isAuthorized);
        setAvailableSubjects(subjects);

        if (!isAuthorized) { setLoading(false); return; }

        // Load students in this class
        const studs = await db.students
          .where('grade').equals(classRecord.grade)
          .and(s => s.parallel === classRecord.parallel && s.status === 'Active')
          .toArray();
        studs.sort((a, b) => {
          if (a.gender !== b.gender) return a.gender === 'Male' ? -1 : 1;
          return (a.admissionNo || '').localeCompare(b.admissionNo || '', undefined, { numeric: true });
        });
        setStudents(studs);

        // Load exams for this class's section + whole school exams
        const allExams = await db.exams.toArray();
        const sectionExams = allExams.filter(e =>
          e.section === classRecord.section || e.section === 'Whole School'
        );
        sectionExams.sort((a, b) => {
          if (b.term !== a.term) return b.term - a.term; // latest term first
          return a.name.localeCompare(b.name);
        });
        setExams(sectionExams);
        // Auto-select the latest term exam
        if (sectionExams.length > 0) setSelectedExam(String(sectionExams[0].id));
      } catch {
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [classId, user]);

  // Load existing marks when exam or subject changes
  const loadMarks = useCallback(async () => {
    if (!selectedExam || !selectedSubjectId) { setMarks({}); return; }
    const existing = await db.marks
      .where('examId').equals(Number(selectedExam))
      .and(m => m.subjectId === Number(selectedSubjectId))
      .toArray();
    const map = {};
    existing.forEach(m => { map[m.studentId] = m.marks; });
    setMarks(map);
    setSaved(false);
  }, [selectedExam, selectedSubjectId]);

  useEffect(() => { loadMarks(); }, [loadMarks]);

  // Reset saved state when subject or exam changes
  useEffect(() => { setSaved(false); }, [selectedSubjectId, selectedExam]);

  const setMark = (studentId, value) => {
    setMarks(m => ({ ...m, [studentId]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedExam || !selectedSubjectId) return;
    setSaving(true);
    try {
      const examId = Number(selectedExam);
      const subjectId = Number(selectedSubjectId);
      const existing = await db.marks
        .where('examId').equals(examId)
        .and(m => m.subjectId === subjectId)
        .toArray();

      for (const student of students) {
        const val = marks[student.id];
        if (val === undefined || val === '') continue;
        const numMark = Number(val);
        const grade = getGrade(numMark);
        const found = existing.find(m => m.studentId === student.id);
        if (found) {
          await db.marks.update(found.id, { marks: numMark, grade });
        } else {
          await db.marks.add({ studentId: student.id, examId, subjectId, marks: numMark, grade });
        }
      }
      setSaved(true);
    } catch {
      setError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading mark entry…</p>
        </div>
      </div>
    );
  }

  // ── Error / unauthorized ───────────────────────────────────────────────────
  if (error || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
            {error || 'Access Denied'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {!authorized && !error
              ? 'You are not assigned to teach any subject in this class.'
              : error}
          </p>
          <button onClick={() => navigate(backPath)}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700">
            <ArrowLeft size={15} /> {isAdmin ? 'Back to Marks' : 'Back to Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  const selectedSubject = availableSubjects.find(s => s.id === Number(selectedSubjectId));
  const exam = exams.find(e => e.id === Number(selectedExam));
  const readyToEnter = selectedSubjectId && selectedExam;
  const enteredCount = readyToEnter
    ? students.filter(s => marks[s.id] !== undefined && marks[s.id] !== '').length
    : 0;

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Top bar — flush to top since Layout has no padding on this route */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(backPath)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Mark Entry</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Grade {cls.grade}{cls.parallel} · {cls.section}
            </p>
          </div>
        </div>
        {readyToEnter && (
          <button onClick={handleSave} disabled={saving || students.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              saved
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
            }`}>
            {saved ? <><CheckCircle size={15} /> Saved</> : <><Save size={15} /> {saving ? 'Saving…' : 'Save Marks'}</>}
          </button>
        )}
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Class info card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
            <Users size={22} className="text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">
              Grade {cls.grade}{cls.parallel}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {cls.section} · {cls.academicYear} · {students.length} students
            </p>
          </div>
        </div>

        {/* Subject selector */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
            <BookOpen size={14} className="inline mr-1.5 text-purple-500" />
            Select Subject
          </label>
          <select
            value={selectedSubjectId}
            onChange={e => { setSelectedSubjectId(e.target.value); setMarks({}); setSaved(false); }}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
            <option value="">— Choose a subject —</option>
            {availableSubjects.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
          {availableSubjects.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              No subjects available for this class.
            </p>
          )}
        </div>

        {/* Exam selector — only shown after subject is picked */}
        {selectedSubjectId && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              Select Exam
            </label>
            <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              <option value="">— Choose an exam —</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name} · Term {e.term}</option>)}
            </select>
            {exams.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                No exams found for Grade {cls.grade} {cls.section}.
              </p>
            )}
          </div>
        )}

        {/* Progress bar */}
        {readyToEnter && students.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                <span>Marks entered</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{enteredCount} / {students.length}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${(enteredCount / students.length) * 100}%` }} />
              </div>
            </div>
            {enteredCount === students.length && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">Complete!</span>
            )}
          </div>
        )}

        {/* Student mark entry */}
        {readyToEnter ? (
          students.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
              <p className="text-slate-400 dark:text-slate-500 text-sm">No active students found in this class.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
                {exam?.name} · {selectedSubject?.name} · {students.length} students
              </p>
              {students.map((s, i) => {
                const val = marks[s.id] ?? '';
                const g = val !== '' ? getGrade(val) : null;
                return (
                  <div key={s.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{s.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{s.admissionNo}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {g && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${gradeColor[g]}`}>{g}</span>
                      )}
                      <input
                        type="number" min={0} max={100} value={val}
                        onChange={e => setMark(s.id, e.target.value)}
                        placeholder="—"
                        className="w-20 text-center border border-slate-300 dark:border-slate-600 rounded-xl px-2 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                );
              })}

              {/* Bottom save */}
              <button onClick={handleSave} disabled={saving || enteredCount === 0}
                className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all mt-2 ${
                  saved
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                }`}>
                {saved ? '✓ Marks Saved Successfully' : saving ? 'Saving…' : `Save ${enteredCount} Mark${enteredCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          )
        ) : !selectedSubjectId ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
            <BookOpen size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Select a subject above to continue</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
            <BookOpen size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Select an exam above to start entering marks</p>
          </div>
        )}
      </div>
    </div>
  );
}
