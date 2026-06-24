import { useState, useEffect, useCallback } from 'react';
import {
  Save, BarChart3, User, QrCode, Copy, Check, Link, Search,
  PenLine, Trophy, BookOpen, TrendingUp, FileText, GraduationCap,
  Medal, ChevronDown,
} from 'lucide-react';
import { QRCode } from 'react-qr-code';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import ClassQRModal from '../components/ClassQRModal';
import { useAuth } from '../context/AuthContext';

// ── Grading helpers ───────────────────────────────────────────────────────────

function getGrade(marks) {
  const m = Number(marks);
  if (m >= 75) return 'A';
  if (m >= 65) return 'B';
  if (m >= 55) return 'C';
  if (m >= 35) return 'S';
  return 'W';
}

const GRADE_STYLE = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  C: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  S: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  W: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const GRADE_INPUT_BG = {
  A: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  B: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
  C: 'border-amber-400 bg-amber-50 dark:bg-amber-900/20',
  S: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20',
  W: 'border-red-400 bg-red-50 dark:bg-red-900/20',
};

function GradeBadge({ grade }) {
  if (!grade) return null;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${GRADE_STYLE[grade] || ''}`}>
      {grade}
    </span>
  );
}

// Abbreviate subject name to max N chars for column header fallback
function subAbbr(sub) {
  if (sub.code) return sub.code.replace(/\d+$/, ''); // strip grade suffix digits
  return sub.name.slice(0, 5).toUpperCase();
}

const SECTION_COLOR = {
  Primary:   'text-blue-600 dark:text-blue-400',
  Secondary: 'text-emerald-600 dark:text-emerald-400',
  Ordinary:  'text-amber-600 dark:text-amber-400',
  Advanced:  'text-purple-600 dark:text-purple-400',
};

const RANK_STYLE = [
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700',   // 1st
  'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 ring-1 ring-slate-300 dark:ring-slate-600',       // 2nd
  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 ring-1 ring-orange-300 dark:ring-orange-700', // 3rd
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function Marks() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const isAdmin   = user?.role === 'admin' || user?.role === 'principal';

  // ── All state (hooks must come before any conditional return) ──────────────
  const [accessChecked, setAccessChecked]     = useState(false);
  const [supervisorClassId, setSupervisorClassId] = useState(null); // null = admin (no restriction)
  const [tab, setTab]                         = useState('entry');

  // Master data
  const [exams, setExams]             = useState([]);
  const [classes, setClasses]         = useState([]);
  const [allStudents, setAllStudents] = useState([]);

  // Selection
  const [selectedExam, setSelectedExam]       = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');

  // Entry tab data
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [marks, setMarks]       = useState({});
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  // Student report tab
  const [reportStudentId, setReportStudentId] = useState('');
  const [studentReport, setStudentReport]     = useState(null);
  const [reportLoading, setReportLoading]     = useState(false);
  const [rankedStudents, setRankedStudents]   = useState([]); // [{student, rank, total, avg, lastExamName}]
  const [rankLoading, setRankLoading]         = useState(false);

  // QR tab
  const [qrAssignments, setQrAssignments] = useState([]);
  const [qrLoading, setQrLoading]         = useState(false);
  const [copiedId, setCopiedId]           = useState(null);
  const [qrModalCls, setQrModalCls]       = useState(null);
  const [qrSearch, setQrSearch]           = useState('');

  // ── Access guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.role === 'student') { navigate('/403', { replace: true }); return; }
    if (isAdmin) { setAccessChecked(true); return; }
    if (user?.role === 'teacher') {
      (async () => {
        try {
          const allUsers      = await db.table('users').toArray();
          const userRecord    = allUsers.find(u => u.id === user.id);
          const teacherId     = userRecord?.teacherId ?? user?.teacherId;
          let teacherRecord   = teacherId ? await db.teachers.get(teacherId) : null;
          if (!teacherRecord) {
            const name = userRecord?.name || user?.name;
            if (name) teacherRecord = await db.teachers.where('name').equals(name).first();
          }
          if (!teacherRecord) { navigate('/403', { replace: true }); return; }
          const cls = await db.classes.where('classTeacherId').equals(teacherRecord.id).first();
          if (!cls) { navigate('/403', { replace: true }); return; }
          setSupervisorClassId(cls.id);
          setSelectedClassId(String(cls.id));
          setAccessChecked(true);
        } catch { navigate('/403', { replace: true }); }
      })();
      return;
    }
    navigate('/403', { replace: true });
  }, [user]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      db.exams.toArray(),
      db.classes.toArray(),
      db.students.toArray(),
    ]).then(([e, c, s]) => {
      setExams(e.sort((a, b) => a.name.localeCompare(b.name)));
      setClasses(c.sort((a, b) => a.grade - b.grade || a.parallel.localeCompare(b.parallel)));
      setAllStudents(s.sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, []);

  // QR tab load
  useEffect(() => {
    if (tab !== 'qr') return;
    setQrLoading(true);
    const start = Date.now();
    db.classes.toArray()
      .then(all => {
        setQrAssignments(
          all.sort((a, b) => a.grade - b.grade || a.parallel.localeCompare(b.parallel))
        );
        const wait = Math.max(0, 600 - (Date.now() - start));
        setTimeout(() => setQrLoading(false), wait);
      })
      .catch(() => { setQrAssignments([]); setQrLoading(false); });
  }, [tab]);

  // ── Rank students for report tab by most recent exam total ────────────────
  useEffect(() => {
    if (tab !== 'report') return;
    if (rankedStudents.length > 0) return; // already computed
    setRankLoading(true);
    (async () => {
      try {
        // Determine which students to rank
        let pool = allStudents;
        if (supervisorClassId) {
          const sc = classes.find(c => c.id === supervisorClassId);
          if (sc) pool = allStudents.filter(s => Number(s.grade) === sc.grade && s.parallel === sc.parallel);
        }
        if (pool.length === 0) { setRankLoading(false); return; }

        const allMarks = await db.marks.toArray();
        const allExams = await db.exams.toArray();

        // Find the most recent exam that has marks for at least one student in the pool
        const poolIds = new Set(pool.map(s => s.id));
        const poolMarks = allMarks.filter(m => poolIds.has(m.studentId));
        const examTotals = new Map(); // examId → {total per student}
        poolMarks.forEach(m => {
          if (!examTotals.has(m.examId)) examTotals.set(m.examId, new Map());
          const et = examTotals.get(m.examId);
          et.set(m.studentId, (et.get(m.studentId) || 0) + m.marks);
        });

        // Pick the exam with the latest startDate that has marks
        const lastExam = [...examTotals.keys()]
          .map(id => allExams.find(e => e.id === id))
          .filter(Boolean)
          .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
          [0] || null;

        if (!lastExam) {
          // No exams yet — sort alphabetically
          setRankedStudents(pool.map((s, i) => ({ student: s, rank: i + 1, total: null, avg: null, lastExamName: null })));
          setRankLoading(false); return;
        }

        const lastExamStudentTotals = examTotals.get(lastExam.id) || new Map();
        const subjectCount = new Set(poolMarks.filter(m => m.examId === lastExam.id).map(m => m.subjectId)).size || 1;

        const ranked = pool.map(s => {
          const total = lastExamStudentTotals.get(s.id) ?? null;
          const avg   = total !== null ? (total / subjectCount).toFixed(1) : null;
          return { student: s, total, avg, lastExamName: lastExam.name };
        });

        // Sort: students with marks descending total, then no-marks alphabetically at bottom
        ranked.sort((a, b) => {
          if (a.total !== null && b.total !== null) return b.total - a.total;
          if (a.total !== null) return -1;
          if (b.total !== null) return 1;
          return a.student.name.localeCompare(b.student.name);
        });

        // Assign ranks (tied scores share a rank)
        let rank = 1;
        ranked.forEach((r, i) => {
          if (i > 0 && r.total !== null && ranked[i - 1].total !== null && r.total === ranked[i - 1].total) {
            r.rank = ranked[i - 1].rank;
          } else {
            r.rank = r.total !== null ? rank : null;
          }
          if (r.total !== null) rank++;
        });

        setRankedStudents(ranked);
      } catch (err) { console.error(err); }
      finally { setRankLoading(false); }
    })();
  }, [tab, allStudents, classes, supervisorClassId]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const selectedClass    = classes.find(c => c.id === Number(selectedClassId)) || null;
  const selectedExamObj  = exams.find(e => e.id === Number(selectedExam)) || null;

  // ── Load marks data when exam + class selected ─────────────────────────────
  const loadData = useCallback(async () => {
    if (!selectedExam || !selectedClassId) {
      setStudents([]); setSubjects([]); setMarks({}); return;
    }
    const cls = classes.find(c => c.id === Number(selectedClassId));
    if (!cls) return;

    setLoading(true);
    try {
      const [allStuds, allSubs, existingMarks] = await Promise.all([
        db.students.toArray(),
        db.subjects.toArray(),
        db.marks.where('examId').equals(Number(selectedExam)).toArray(),
      ]);

      // ── Students: exact grade + parallel, active only ──────────────────────
      const enrolled = allStuds
        .filter(s => Number(s.grade) === cls.grade && s.parallel === cls.parallel && s.status === 'Active')
        .sort((a, b) => {
          // 1. Males first, Females after
          if (a.gender !== b.gender) return a.gender === 'Male' ? -1 : 1;
          // 2. Ascending admission number within each gender
          return (a.admissionNo || '').localeCompare(b.admissionNo || '', undefined, { numeric: true });
        });
      setStudents(enrolled);

      // ── Subjects: only for this specific grade ─────────────────────────────
      const gradeSubs = allSubs
        .filter(s => Number(s.grade) === cls.grade)
        .sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name));
      setSubjects(gradeSubs);

      // ── Build marks map ────────────────────────────────────────────────────
      const marksMap = {};
      existingMarks.forEach(m => {
        if (!marksMap[m.studentId]) marksMap[m.studentId] = {};
        marksMap[m.studentId][m.subjectId] = m.marks;
      });
      setMarks(marksMap);
      setSaved(false);
    } finally {
      setLoading(false);
    }
  }, [selectedExam, selectedClassId, classes]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Mark entry helpers ─────────────────────────────────────────────────────
  const setMark = (studentId, subjectId, value) => {
    setMarks(m => ({ ...m, [studentId]: { ...(m[studentId] || {}), [subjectId]: value } }));
    setSaved(false);
  };

  const getStudentTotal = (studentId) => {
    const vals = Object.values(marks[studentId] || {}).filter(v => v !== '' && v !== undefined).map(Number);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
  };

  const getStudentAvg = (studentId) => {
    const vals = Object.values(marks[studentId] || {}).filter(v => v !== '' && v !== undefined).map(Number);
    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  };

  // ── Save marks ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedExam || students.length === 0) return;
    setSaving(true);
    try {
      const examId   = Number(selectedExam);
      const existing = await db.marks.where('examId').equals(examId).toArray();

      for (const student of students) {
        for (const subject of subjects) {
          const markVal = marks[student.id]?.[subject.id];
          if (markVal === undefined || markVal === '') continue;
          const numMark = Number(markVal);
          const grade   = getGrade(numMark);
          const found   = existing.find(m => m.studentId === student.id && m.subjectId === subject.id);
          if (found) {
            await db.marks.update(found.id, { marks: numMark, grade });
          } else {
            await db.marks.add({ studentId: student.id, examId, subjectId: subject.id, marks: numMark, grade });
          }
        }
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  // ── Student report ─────────────────────────────────────────────────────────
  const loadStudentReport = async () => {
    if (!reportStudentId) return;
    setReportLoading(true);
    try {
      const studentId   = Number(reportStudentId);
      const studentMarks = await db.marks.where('studentId').equals(studentId).toArray();
      const [allSubs, allExams] = await Promise.all([db.subjects.toArray(), db.exams.toArray()]);

      // Group by exam
      const byExam = {};
      studentMarks.forEach(m => {
        if (!byExam[m.examId]) byExam[m.examId] = [];
        byExam[m.examId].push(m);
      });

      const grouped = Object.entries(byExam).map(([examId, mList]) => {
        const exam = allExams.find(e => e.id === Number(examId));
        const rows = mList.map(m => ({
          ...m,
          subjectName: allSubs.find(s => s.id === m.subjectId)?.name || '—',
          subjectCode: allSubs.find(s => s.id === m.subjectId)?.code || '',
        })).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
        const total = rows.reduce((s, r) => s + r.marks, 0);
        const avg   = rows.length ? (total / rows.length).toFixed(1) : null;
        return { examId: Number(examId), examName: exam?.name || '—', term: exam?.term, rows, total, avg };
      }).sort((a, b) => a.examName.localeCompare(b.examName));

      setStudentReport(grouped);
    } finally {
      setReportLoading(false);
    }
  };

  const reportStudentObj = allStudents.find(s => s.id === Number(reportStudentId));

  // ── QR helpers ─────────────────────────────────────────────────────────────
  const handleCopyLink = (url, id) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!accessChecked) return null;

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Results & Marks</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Enter marks and view results by class</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
        {[
          { key: 'entry',   label: 'Mark Entry',    icon: PenLine   },
          { key: 'results', label: 'Class Results',  icon: BarChart3 },
          { key: 'report',  label: 'Student Report', icon: User      },
          ...(isAdmin ? [{ key: 'qr', label: 'QR Entry Links', icon: QrCode }] : []),
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}>
            <t.icon size={14} className="shrink-0" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Exam + Class selector (entry & results tabs) ── */}
      {(tab === 'entry' || tab === 'results') && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-end">

            {/* Exam picker */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Exam</label>
              <select
                value={selectedExam}
                onChange={e => { setSelectedExam(e.target.value); setSaved(false); }}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
              >
                <option value="">— Select Exam —</option>
                {exams.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            {/* Class picker — admins choose freely; supervisors are locked to their class */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Class</label>
              {supervisorClassId ? (
                (() => {
                  const sc = classes.find(c => c.id === supervisorClassId);
                  return (
                    <div className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                      {sc ? `Grade ${sc.grade}${sc.parallel} — ${sc.section}` : 'My Class'}
                      <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 font-medium">My Class</span>
                    </div>
                  );
                })()
              ) : (
                <select
                  value={selectedClassId}
                  onChange={e => { setSelectedClassId(e.target.value); setSaved(false); }}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                >
                  <option value="">— Select Class —</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>Grade {c.grade}{c.parallel} — {c.section}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Info chips */}
            {selectedClass && selectedExamObj && (
              <div className="flex flex-wrap items-center gap-2 pb-0.5">
                <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 ${SECTION_COLOR[selectedClass.section] || ''}`}>
                  {selectedClass.section}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                  Term {selectedExamObj.term}
                </span>
                {!loading && subjects.length > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                    {subjects.length} subjects · {students.length} students
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────── MARK ENTRY TAB ─────────────────────────────── */}
      {tab === 'entry' && (
        <>
          {!selectedExam || !selectedClassId ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
              <BookOpen size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Select an exam and a class to start entering marks</p>
            </div>
          ) : loading ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
              <GraduationCap size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No active students enrolled in Grade {selectedClass?.grade}{selectedClass?.parallel}</p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
              <BookOpen size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No subjects found for Grade {selectedClass?.grade}. Enable subjects in the Subjects page first.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              {/* Table toolbar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      selectedClass.section === 'Primary'   ? 'bg-blue-500' :
                      selectedClass.section === 'Secondary' ? 'bg-emerald-500' :
                      selectedClass.section === 'Ordinary'  ? 'bg-amber-500' : 'bg-purple-500'
                    }`} />
                    <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                      Grade {selectedClass.grade}{selectedClass.parallel}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 text-xs">·</span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs">{selectedExamObj?.name}</span>
                  </div>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    saved
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60'
                  }`}
                >
                  <Save size={14} />
                  {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Marks'}
                </button>
              </div>

              {/* Scrollable marks table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                      {/* Sticky student column */}
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/60 min-w-[180px] border-r border-slate-200 dark:border-slate-700">
                        Student
                      </th>
                      {subjects.map(sub => (
                        <th
                          key={sub.id}
                          title={sub.name}
                          className="px-2 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide min-w-[72px] max-w-[90px]"
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold text-slate-600 dark:text-slate-300">{subAbbr(sub)}</span>
                            <span className="text-slate-400 dark:text-slate-500 normal-case tracking-normal font-normal truncate max-w-[80px] text-center leading-tight" style={{ fontSize: '10px' }}>
                              {sub.name.length > 10 ? sub.name.slice(0, 9) + '…' : sub.name}
                            </span>
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide min-w-[60px]">Total</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide min-w-[55px]">Avg</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide min-w-[50px]">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {students.map((s, rowIdx) => {
                      const total = getStudentTotal(s.id);
                      const avg   = getStudentAvg(s.id);
                      const overallGrade = avg !== null ? getGrade(Number(avg)) : null;
                      return (
                        <tr key={s.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${rowIdx % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-slate-800/10'}`}>
                          {/* Sticky student name */}
                          <td className="px-4 py-2.5 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">
                            <p className="font-medium text-slate-800 dark:text-slate-100 text-sm leading-tight">{s.name}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{s.admissionNo}</p>
                          </td>
                          {subjects.map(sub => {
                            const val = marks[s.id]?.[sub.id] ?? '';
                            const g   = val !== '' && val !== undefined ? getGrade(val) : null;
                            return (
                              <td key={sub.id} className="px-1.5 py-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={val}
                                  onChange={e => setMark(s.id, sub.id, e.target.value)}
                                  className={`w-14 text-center border rounded-lg px-1.5 py-1.5 text-sm font-medium dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors ${
                                    g ? GRADE_INPUT_BG[g] : 'border-slate-300 dark:border-slate-600 dark:bg-slate-800'
                                  }`}
                                />
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center font-bold text-slate-700 dark:text-slate-200 text-sm">
                            {total !== null ? total : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300 text-sm">
                            {avg !== null ? avg : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <GradeBadge grade={overallGrade} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Subject legend */}
              {subjects.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Subject Reference</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {subjects.map(sub => (
                      <span key={sub.id} className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-slate-600 dark:text-slate-300">{subAbbr(sub)}</span>
                        {' — '}{sub.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ────────────────────────────── CLASS RESULTS TAB ─────────────────────────── */}
      {tab === 'results' && (
        <>
          {!selectedExam || !selectedClassId ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
              <BarChart3 size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Select an exam and a class to view results</p>
            </div>
          ) : loading ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
              <GraduationCap size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No active students in this class</p>
            </div>
          ) : (() => {
            const ranked = [...students]
              .map(s => ({
                ...s,
                total: getStudentTotal(s.id),
                avg:   getStudentAvg(s.id),
              }))
              .sort((a, b) => (b.total ?? -1) - (a.total ?? -1));

            const markedCount = ranked.filter(s => s.total !== null).length;

            return (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Students',  value: students.length,    icon: GraduationCap, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'Marked',    value: markedCount,         icon: PenLine,       color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
                    { label: 'Subjects',  value: subjects.length,     icon: BookOpen,      color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
                    { label: 'Class Avg', value: ranked.filter(s => s.avg !== null).length
                        ? (ranked.filter(s => s.avg !== null).reduce((sum, s) => sum + Number(s.avg), 0) / ranked.filter(s => s.avg !== null).length).toFixed(1)
                        : '—',
                      icon: TrendingUp, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
                        <Icon size={16} />
                      </div>
                      <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Ranked results table */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <Trophy size={16} className="text-amber-500" />
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                      {selectedExamObj?.name} — Grade {selectedClass?.grade}{selectedClass?.parallel} Rankings
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-16">Rank</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Student</th>
                          {subjects.map(sub => (
                            <th key={sub.id} title={sub.name} className="px-2 py-3 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase min-w-[52px]">
                              {subAbbr(sub)}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Avg</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {ranked.map((s, i) => {
                          const overallGrade = s.avg !== null ? getGrade(Number(s.avg)) : null;
                          const isTop3       = i < 3 && s.total !== null;
                          return (
                            <tr key={s.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${isTop3 ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''}`}>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold ${
                                  isTop3 ? RANK_STYLE[i] : 'text-slate-400 dark:text-slate-500'
                                }`}>
                                  {s.total !== null ? i + 1 : '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-800 dark:text-slate-100">{s.name}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{s.admissionNo}</p>
                              </td>
                              {subjects.map(sub => {
                                const val = marks[s.id]?.[sub.id];
                                const g   = val !== undefined ? getGrade(val) : null;
                                return (
                                  <td key={sub.id} className="px-2 py-3 text-center">
                                    {val !== undefined ? (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{val}</span>
                                        <GradeBadge grade={g} />
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-200">{s.total ?? '—'}</td>
                              <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{s.avg ?? '—'}</td>
                              <td className="px-4 py-3 text-center"><GradeBadge grade={overallGrade} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ────────────────────────────── STUDENT REPORT TAB ───────────────────────────── */}
      {tab === 'report' && (
        <div className="space-y-5">

          {/* Ranked student picker */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
                <Trophy size={15} className="text-amber-500" /> Select Student
              </h3>
              {rankedStudents[0]?.lastExamName && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Ranked by: <span className="font-medium text-slate-600 dark:text-slate-300">{rankedStudents[0].lastExamName}</span>
                </span>
              )}
            </div>

            {rankLoading ? (
              <div className="p-4 space-y-2">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : rankedStudents.length === 0 ? (
              <div className="p-10 text-center">
                <GraduationCap size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-400 dark:text-slate-500">No students found.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-72 overflow-y-auto">
                {rankedStudents.map(({ student, rank, total, avg, lastExamName }) => {
                  const isSelected = String(student.id) === String(reportStudentId);
                  const rankColors = [
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700',
                    'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 ring-1 ring-slate-300 dark:ring-slate-600',
                    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 ring-1 ring-orange-300 dark:ring-orange-700',
                  ];
                  const rankBadge = rank && rank <= 3 ? rankColors[rank - 1] : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
                  const overallGrade = avg !== null ? getGrade(Number(avg)) : null;

                  return (
                    <button
                      key={student.id}
                      onClick={() => { setReportStudentId(String(student.id)); setStudentReport(null); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-2 border-transparent'
                      }`}
                    >
                      {/* Rank badge */}
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${rankBadge}`}>
                        {rank ?? '—'}
                      </span>

                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {student.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-100'}`}>
                          {student.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {student.admissionNo && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{student.admissionNo}</span>
                          )}
                          <span className="text-xs text-slate-400 dark:text-slate-500">{student.gender}</span>
                        </div>
                      </div>

                      {/* Score + grade */}
                      <div className="flex items-center gap-2 shrink-0">
                        {total !== null ? (
                          <>
                            <div className="text-right">
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{avg}</p>
                              <p className="text-[10px] text-slate-400">avg</p>
                            </div>
                            <GradeBadge grade={overallGrade} />
                          </>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">No marks</span>
                        )}
                        {isSelected && <ChevronDown size={14} className="text-blue-500 rotate-[-90deg]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* View Report button */}
            {reportStudentId && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                <button
                  onClick={loadStudentReport}
                  disabled={reportLoading}
                  className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <FileText size={14} />
                  {reportLoading ? 'Loading report…' : `View Report for ${rankedStudents.find(r => String(r.student.id) === String(reportStudentId))?.student.name?.split(' ')[0] || 'Student'}`}
                </button>
              </div>
            )}
          </div>

          {/* Report output */}
          {studentReport !== null && (
            studentReport.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
                <FileText size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 dark:text-slate-500 text-sm">No marks recorded for {reportStudentObj?.name} yet.</p>
              </div>
            ) : (
              <div className="space-y-4">

                {/* Student identity banner */}
                {(() => {
                  const ranked = rankedStudents.find(r => String(r.student.id) === String(reportStudentId));
                  const overallAvg = studentReport.length
                    ? (studentReport.reduce((s, eg) => s + Number(eg.avg || 0), 0) / studentReport.length).toFixed(1)
                    : null;
                  const overallGrade = overallAvg ? getGrade(Number(overallAvg)) : null;
                  return (
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black rounded-xl p-5 text-white">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white font-black text-lg shrink-0">
                            {reportStudentObj?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-lg font-bold">{reportStudentObj?.name}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {reportStudentObj?.admissionNo && (
                                <span className="text-xs text-white/60 font-mono">{reportStudentObj.admissionNo}</span>
                              )}
                              <span className="text-xs bg-white/15 border border-white/20 px-2 py-0.5 rounded-full">
                                Grade {reportStudentObj?.grade}{reportStudentObj?.parallel}
                              </span>
                              {reportStudentObj?.section && (
                                <span className="text-xs bg-white/10 border border-white/15 px-2 py-0.5 rounded-full">{reportStudentObj.section}</span>
                              )}
                              {reportStudentObj?.gender && (
                                <span className="text-xs text-white/50">{reportStudentObj.gender}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                          {ranked?.rank && (
                            <div className="bg-amber-500/20 border border-amber-400/30 rounded-xl px-4 py-2.5 text-center min-w-[64px]">
                              <p className="text-amber-300 text-xs">Class Rank</p>
                              <p className="font-black text-xl text-amber-200">#{ranked.rank}</p>
                            </div>
                          )}
                          {overallAvg && (
                            <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-center min-w-[64px]">
                              <p className="text-white/60 text-xs">Overall Avg</p>
                              <p className="font-black text-xl">{overallAvg}</p>
                            </div>
                          )}
                          <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-center min-w-[64px]">
                            <p className="text-white/60 text-xs">Exams</p>
                            <p className="font-black text-xl">{studentReport.length}</p>
                          </div>
                          <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-center min-w-[64px]">
                            <p className="text-white/60 text-xs">Records</p>
                            <p className="font-black text-xl">{studentReport.reduce((s, e) => s + e.rows.length, 0)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Per-exam cards */}
                {studentReport.map(examGroup => {
                  const overallGrade = examGroup.avg !== null ? getGrade(Number(examGroup.avg)) : null;
                  const GRADE_BAR = { A:'bg-emerald-500', B:'bg-blue-500', C:'bg-violet-500', S:'bg-amber-500', W:'bg-red-500' };
                  return (
                    <div key={examGroup.examId} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                      {/* Exam header */}
                      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/30">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                            T{examGroup.term || '—'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{examGroup.examName}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{examGroup.rows.length} subject{examGroup.rows.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold text-slate-800 dark:text-slate-100">{examGroup.total}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Total</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-800 dark:text-slate-100">{examGroup.avg}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Average</p>
                          </div>
                          <GradeBadge grade={overallGrade} />
                        </div>
                      </div>

                      {/* Subject rows */}
                      <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {examGroup.rows.map((r, idx) => {
                          const g = r.grade || getGrade(r.marks);
                          const pct = Math.round((r.marks / 100) * 100);
                          return (
                            <div key={r.id} className="flex items-center gap-4 px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              <span className="w-5 text-xs text-slate-400 text-right shrink-0">{idx + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {r.subjectCode && (
                                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500 shrink-0">{r.subjectCode.replace(/\d+$/, '')}</span>
                                  )}
                                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.subjectName}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className={`h-full ${GRADE_BAR[g] || 'bg-slate-400'} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[10px] text-slate-400 w-7 text-right">{pct}%</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 w-8 text-right">{r.marks}</span>
                                <GradeBadge grade={g} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Exam footer summary */}
                      <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Summary</span>
                        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                          {['A','B','C','S','W'].map(g => {
                            const cnt = examGroup.rows.filter(r => (r.grade || getGrade(r.marks)) === g).length;
                            if (!cnt) return null;
                            return (
                              <span key={g} className="flex items-center gap-1">
                                <GradeBadge grade={g} /> <span className="font-semibold">{cnt}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* ────────────────────────────── QR LINKS TAB (admin only) ──────────────────── */}
      {tab === 'qr' && isAdmin && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2 text-sm">
                  <QrCode size={16} className="text-blue-600" /> QR Entry Links
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Share these QR codes or links with teachers to let them enter marks directly.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 w-full sm:w-56">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search class…"
                  value={qrSearch}
                  onChange={e => setQrSearch(e.target.value)}
                  className="bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none w-full placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {qrLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 h-64 animate-pulse" />
              ))}
            </div>
          ) : qrAssignments.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
              <QrCode size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 dark:text-slate-500">No classes found. Add classes first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {qrAssignments
                .filter(cls => {
                  const q = qrSearch.toLowerCase();
                  return !q ||
                    `grade ${cls.grade}${cls.parallel}`.includes(q) ||
                    cls.section?.toLowerCase().includes(q) ||
                    String(cls.grade).includes(q) ||
                    cls.parallel?.toLowerCase().includes(q);
                })
                .map(cls => {
                  const url     = `${window.location.origin}/marks/entry?classId=${cls.id}`;
                  const cardId  = String(cls.id);
                  const isCopied = copiedId === cardId;
                  return (
                    <div key={cardId} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col gap-4">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${SECTION_COLOR[cls.section] || 'text-slate-500'}`}>
                          {cls.section} · {cls.academicYear}
                        </p>
                        <p className="text-2xl font-black text-slate-800 dark:text-slate-100">Grade {cls.grade}{cls.parallel}</p>
                      </div>
                      <div className="flex justify-center">
                        <button
                          onClick={() => setQrModalCls(cls)}
                          className="p-3 bg-white rounded-xl border border-slate-200 dark:border-slate-600 hover:shadow-md transition-shadow"
                          title="Click to enlarge"
                        >
                          <QRCode value={url} size={130} bgColor="#ffffff" fgColor="#0f172a" />
                        </button>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleCopyLink(url, cardId)}
                          className={`flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            isCopied
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {isCopied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Link</>}
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <Link size={12} /> Open Entry Page
                        </a>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* QR Modal */}
      {qrModalCls && (
        <ClassQRModal
          isOpen={!!qrModalCls}
          onClose={() => setQrModalCls(null)}
          classId={qrModalCls.id}
          classLabel={`Grade ${qrModalCls.grade}${qrModalCls.parallel}`}
          section={qrModalCls.section}
        />
      )}

      {/* Grading reference */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
          <BarChart3 size={13} /> Sri Lankan Grading System
        </h4>
        <div className="flex flex-wrap gap-2">
          {[
            { g: 'A', range: '75 – 100', desc: 'Distinction' },
            { g: 'B', range: '65 – 74',  desc: 'Merit'       },
            { g: 'C', range: '55 – 64',  desc: 'Credit'      },
            { g: 'S', range: '35 – 54',  desc: 'Pass'        },
            { g: 'W', range: '0 – 34',   desc: 'Fail'        },
          ].map(({ g, range, desc }) => (
            <div key={g} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${GRADE_STYLE[g]}`}>
              <span className="font-black text-base">{g}</span>
              <div>
                <p className="text-xs font-semibold leading-tight">{desc}</p>
                <p className="text-xs opacity-75 leading-tight">{range}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
