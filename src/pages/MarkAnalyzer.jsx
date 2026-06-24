import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2, TrendingUp, TrendingDown, Award, BookOpen,
  User, GraduationCap, ChevronDown, ChevronUp,
  Star, AlertCircle, Search, Minus, Users, Trophy, School,
} from 'lucide-react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';

// ── Grade helpers ─────────────────────────────────────────────────────────────
function getGrade(m) {
  const n = Number(m);
  if (n >= 75) return 'A';
  if (n >= 65) return 'B';
  if (n >= 55) return 'C';
  if (n >= 35) return 'S';
  return 'W';
}

const GRADE_COLOR = {
  A: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', bar: 'bg-emerald-500' },
  B: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',             bar: 'bg-blue-500' },
  C: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',         bar: 'bg-amber-500' },
  S: { badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',     bar: 'bg-orange-500' },
  W: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',                 bar: 'bg-red-500' },
};

const SECTION_META = {
  Primary:   { color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/20',     bar: 'bg-blue-500',   border: 'border-blue-200 dark:border-blue-800',     ring: 'ring-blue-400' },
  Secondary: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', bar: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800', ring: 'ring-emerald-400' },
  Ordinary:  { color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20',   bar: 'bg-amber-500',  border: 'border-amber-200 dark:border-amber-800',   ring: 'ring-amber-400' },
  Advanced:  { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', bar: 'bg-purple-500', border: 'border-purple-200 dark:border-purple-800', ring: 'ring-purple-400' },
};

function GradeBadge({ grade }) {
  if (!grade) return null;
  const g = GRADE_COLOR[grade] || GRADE_COLOR.W;
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${g.badge}`}>{grade}</span>;
}

function Sk({ className }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`} />;
}

// ── Compute student-level analysis ────────────────────────────────────────────
async function computeStudentAnalysis(studentRec) {
  const [allMarks, allSubjects, allExams, allStudents] = await Promise.all([
    db.marks.toArray(), db.subjects.toArray(), db.exams.toArray(), db.students.toArray(),
  ]);

  const myMarks = allMarks.filter(m => m.studentId === studentRec.id);
  if (myMarks.length === 0) return null;

  const subMap  = new Map(allSubjects.map(s => [s.id, s]));
  const examMap = new Map(allExams.map(e => [e.id, e]));

  const peers   = allStudents.filter(s => Number(s.grade) === Number(studentRec.grade) && s.parallel === studentRec.parallel);
  const peerIds = new Set(peers.map(p => p.id));

  const byExam = new Map();
  myMarks.forEach(m => {
    if (!byExam.has(m.examId)) byExam.set(m.examId, []);
    byExam.get(m.examId).push(m);
  });

  const examSections = [];
  for (const [examId, mList] of byExam.entries()) {
    const exam = examMap.get(examId);
    if (!exam) continue;
    const classMks    = allMarks.filter(m => m.examId === examId && peerIds.has(m.studentId));
    const peerTotals  = new Map();
    classMks.forEach(m => peerTotals.set(m.studentId, (peerTotals.get(m.studentId) || 0) + m.marks));
    const myTotal = mList.reduce((s, m) => s + m.marks, 0);
    const sorted  = [...peerTotals.values()].sort((a, b) => b - a);
    const rank    = sorted.findIndex(t => t <= myTotal) + 1;

    const rows = mList.map(m => {
      const subj = subMap.get(m.subjectId);
      const subjectClassMks = classMks.filter(cm => cm.subjectId === m.subjectId).map(cm => cm.marks);
      const classAvg = subjectClassMks.length
        ? (subjectClassMks.reduce((a, b) => a + b, 0) / subjectClassMks.length).toFixed(1) : null;
      const diff = classAvg !== null ? (m.marks - Number(classAvg)).toFixed(1) : null;
      return {
        subjectId: m.subjectId, subjectName: subj?.name || '—', subjectCode: subj?.code || '',
        marks: m.marks, grade: getGrade(m.marks), classAvg, diff: diff !== null ? Number(diff) : null,
      };
    }).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

    const total = rows.reduce((s, r) => s + r.marks, 0);
    const avg   = rows.length ? (total / rows.length).toFixed(1) : null;
    examSections.push({ examId, examName: exam.name, term: exam.term, rows, total, avg, rank: rank || null, peerCount: peerTotals.size });
  }
  examSections.sort((a, b) => a.examName.localeCompare(b.examName));

  const subjectTrendMap = new Map();
  myMarks.forEach(m => {
    const subj = subMap.get(m.subjectId);
    if (!subj) return;
    if (!subjectTrendMap.has(m.subjectId))
      subjectTrendMap.set(m.subjectId, { name: subj.name, code: subj.code, scores: [] });
    const exam = examMap.get(m.examId);
    subjectTrendMap.get(m.subjectId).scores.push({ examName: exam?.name || '?', marks: m.marks, grade: getGrade(m.marks) });
  });
  const subjectTrends = [...subjectTrendMap.values()].map(st => ({
    ...st, avg: (st.scores.reduce((s, sc) => s + sc.marks, 0) / st.scores.length).toFixed(1),
    best: Math.max(...st.scores.map(s => s.marks)), worst: Math.min(...st.scores.map(s => s.marks)),
  })).sort((a, b) => Number(b.avg) - Number(a.avg));

  const allGrades = myMarks.map(m => getGrade(m.marks));
  const gradeDist = { A: 0, B: 0, C: 0, S: 0, W: 0 };
  allGrades.forEach(g => { if (gradeDist[g] !== undefined) gradeDist[g]++; });
  const overallAvg = myMarks.length ? (myMarks.reduce((s, m) => s + m.marks, 0) / myMarks.length).toFixed(1) : null;

  return {
    examSections, subjectTrends, gradeDist, overallAvg,
    totalEntries: myMarks.length, bestSubject: subjectTrends[0] || null,
    worstSubject: subjectTrends[subjectTrends.length - 1] || null,
  };
}

// ── Compute class-wide analysis (supervisor view) ─────────────────────────────
async function computeClassAnalysis(classRec) {
  const [allMarks, allSubjects, allExams, allStudents] = await Promise.all([
    db.marks.toArray(), db.subjects.toArray(), db.exams.toArray(), db.students.toArray(),
  ]);

  const classStudents = allStudents.filter(
    s => Number(s.grade) === classRec.grade && s.parallel === classRec.parallel
  );
  const studentIds  = new Set(classStudents.map(s => s.id));
  const gradeSubjects = allSubjects.filter(s => Number(s.grade) === classRec.grade);
  const subMap      = new Map(allSubjects.map(s => [s.id, s]));
  const classMarks  = allMarks.filter(m => studentIds.has(m.studentId));
  if (classMarks.length === 0) return null;

  // Overall grade distribution + avg
  const allValues = classMarks.map(m => m.marks);
  const overallAvg = (allValues.reduce((a, b) => a + b, 0) / allValues.length).toFixed(1);
  const gradeDist  = { A: 0, B: 0, C: 0, S: 0, W: 0 };
  allValues.forEach(m => { const g = getGrade(m); gradeDist[g]++; });

  // Per-subject stats
  const subjectStats = gradeSubjects.map(sub => {
    const mks = classMarks.filter(m => m.subjectId === sub.id).map(m => m.marks);
    if (!mks.length) return null;
    const avg = (mks.reduce((a, b) => a + b, 0) / mks.length).toFixed(1);
    const dist = { A: 0, B: 0, C: 0, S: 0, W: 0 };
    mks.forEach(m => { const g = getGrade(m); dist[g]++; });
    return { subjectId: sub.id, name: sub.name, code: sub.code, avg, dist, count: mks.length, best: Math.max(...mks), worst: Math.min(...mks) };
  }).filter(Boolean).sort((a, b) => Number(b.avg) - Number(a.avg));

  // Per-exam breakdown
  const examIds = [...new Set(classMarks.map(m => m.examId))];
  const examSections = examIds.map(examId => {
    const exam = allExams.find(e => e.id === examId);
    if (!exam) return null;
    const examMarks = classMarks.filter(m => m.examId === examId);
    const studentTotals = new Map();
    examMarks.forEach(m => studentTotals.set(m.studentId, (studentTotals.get(m.studentId) || 0) + m.marks));
    const totals   = [...studentTotals.values()];
    const classAvg = totals.length ? (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1) : null;

    // Per-subject avg for this exam
    const subjIds = [...new Set(examMarks.map(m => m.subjectId))];
    const subjectAvgs = subjIds.map(subId => {
      const sub = subMap.get(subId);
      const mks = examMarks.filter(m => m.subjectId === subId).map(m => m.marks);
      const avg = (mks.reduce((a, b) => a + b, 0) / mks.length).toFixed(1);
      const dist = { A: 0, B: 0, C: 0, S: 0, W: 0 };
      mks.forEach(m => { const g = getGrade(m); dist[g]++; });
      return { subjectId: subId, name: sub?.name || '—', code: sub?.code || '', avg, dist, count: mks.length };
    }).sort((a, b) => a.name.localeCompare(b.name));

    // Student rankings for this exam
    const ranked = [...studentTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([sid, total], i) => {
        const stu = classStudents.find(s => s.id === sid);
        return { studentId: sid, name: stu?.name || '—', total, rank: i + 1 };
      });

    return { examId, examName: exam.name, term: exam.term, classAvg, studentCount: studentTotals.size, subjectAvgs, ranked };
  }).filter(Boolean).sort((a, b) => a.examName.localeCompare(b.examName));

  // Top / bottom students across all exams (by overall avg)
  const studentAvgs = classStudents.map(s => {
    const mks = classMarks.filter(m => m.studentId === s.id).map(m => m.marks);
    const avg = mks.length ? (mks.reduce((a, b) => a + b, 0) / mks.length).toFixed(1) : null;
    return { student: s, avg, count: mks.length };
  }).filter(r => r.avg !== null).sort((a, b) => Number(b.avg) - Number(a.avg));

  return {
    classStudents, overallAvg, gradeDist, subjectStats,
    examSections, studentAvgs, totalEntries: classMarks.length,
    bestSubject: subjectStats[0] || null, worstSubject: subjectStats[subjectStats.length - 1] || null,
  };
}

// ── Compute subject-teacher analysis for their subjects in a chosen class ──────
async function computeSubjectTeacherAnalysis(teacherRecord, classRec, filterSubjectIds) {
  const [allMarks, allSubjects, allExams, allStudents] = await Promise.all([
    db.marks.toArray(), db.subjects.toArray(), db.exams.toArray(), db.students.toArray(),
  ]);

  const classStudents = allStudents.filter(
    s => Number(s.grade) === classRec.grade && s.parallel === classRec.parallel
  );
  const studentIds = new Set(classStudents.map(s => s.id));
  const subMap     = new Map(allSubjects.map(s => [s.id, s]));
  const mySubjectIds = new Set(filterSubjectIds);

  const relevantMarks = allMarks.filter(m => studentIds.has(m.studentId) && mySubjectIds.has(m.subjectId));
  if (relevantMarks.length === 0) return null;

  const allValues = relevantMarks.map(m => m.marks);
  const overallAvg = (allValues.reduce((a, b) => a + b, 0) / allValues.length).toFixed(1);
  const gradeDist  = { A: 0, B: 0, C: 0, S: 0, W: 0 };
  allValues.forEach(m => { const g = getGrade(m); gradeDist[g]++; });

  // Per-subject stats (only teacher's subjects)
  const subjectStats = [...mySubjectIds].map(subId => {
    const sub = subMap.get(subId);
    if (!sub) return null;
    const mks = relevantMarks.filter(m => m.subjectId === subId).map(m => m.marks);
    if (!mks.length) return null;
    const avg = (mks.reduce((a, b) => a + b, 0) / mks.length).toFixed(1);
    const dist = { A: 0, B: 0, C: 0, S: 0, W: 0 };
    mks.forEach(m => { const g = getGrade(m); dist[g]++; });

    // Per-student marks for this subject
    const studentRows = classStudents.map(s => {
      const mk = relevantMarks.find(m => m.studentId === s.id && m.subjectId === subId);
      return { student: s, marks: mk?.marks ?? null, grade: mk ? getGrade(mk.marks) : null };
    }).filter(r => r.marks !== null).sort((a, b) => b.marks - a.marks);

    return { subjectId: subId, name: sub.name, code: sub.code, avg, dist, count: mks.length, best: Math.max(...mks), worst: Math.min(...mks), studentRows };
  }).filter(Boolean).sort((a, b) => Number(b.avg) - Number(a.avg));

  // Per-exam breakdown
  const examIds = [...new Set(relevantMarks.map(m => m.examId))];
  const allExamsMap = new Map(allExams.map(e => [e.id, e]));
  const examBreakdown = examIds.map(examId => {
    const exam = allExamsMap.get(examId);
    if (!exam) return null;
    const examMarks  = relevantMarks.filter(m => m.examId === examId);
    const uniqueStudents = new Set(examMarks.map(m => m.studentId)).size;
    const allMks = examMarks.map(m => m.marks);
    const classAvg = allMks.length ? (allMks.reduce((a, b) => a + b, 0) / allMks.length).toFixed(1) : null;
    const subjIds    = [...new Set(examMarks.map(m => m.subjectId))];
    const subjectAvgs = subjIds.map(subId => {
      const sub = subMap.get(subId);
      const mks = examMarks.filter(m => m.subjectId === subId).map(m => m.marks);
      const avg = (mks.reduce((a, b) => a + b, 0) / mks.length).toFixed(1);
      return { subjectId: subId, name: sub?.name || '—', avg, count: mks.length };
    }).sort((a, b) => a.name.localeCompare(b.name));
    return { examId, examName: exam.name, term: exam.term, classAvg, studentCount: uniqueStudents, subjectAvgs };
  }).filter(Boolean).sort((a, b) => a.examName.localeCompare(b.examName));

  return { overallAvg, gradeDist, subjectStats, examBreakdown, totalEntries: relevantMarks.length, classStudents };
}

// ── Load subject-teacher assignments for a class (admin view) ─────────────────
async function loadClassTeachers(classRec) {
  const [subjectTeacherRows, timetableRows, allSubjects, allTeachers] = await Promise.all([
    db.subjectTeachers.toArray(),
    db.timetable.toArray(),
    db.subjects.toArray(),
    db.teachers.toArray(),
  ]);
  const subMap = new Map(allSubjects.map(s => [s.id, s]));
  const teacherSubjectMap = new Map(); // teacherId → Set<subjectId>

  subjectTeacherRows.filter(st => st.classId === classRec.id).forEach(st => {
    if (!teacherSubjectMap.has(st.teacherId)) teacherSubjectMap.set(st.teacherId, new Set());
    teacherSubjectMap.get(st.teacherId).add(st.subjectId);
  });
  timetableRows.filter(tt => tt.classId === classRec.id && tt.teacherId).forEach(tt => {
    if (!teacherSubjectMap.has(tt.teacherId)) teacherSubjectMap.set(tt.teacherId, new Set());
    if (tt.subjectId) teacherSubjectMap.get(tt.teacherId).add(tt.subjectId);
  });
  allSubjects.filter(s => Number(s.grade) === classRec.grade && s.teacherId).forEach(sub => {
    if (!teacherSubjectMap.has(sub.teacherId)) teacherSubjectMap.set(sub.teacherId, new Set());
    teacherSubjectMap.get(sub.teacherId).add(sub.id);
  });

  return [...teacherSubjectMap.entries()]
    .map(([tid, subIds]) => {
      const teacher = allTeachers.find(t => t.id === tid);
      if (!teacher) return null;
      const subjects = [...subIds].map(sid => subMap.get(sid)).filter(Boolean);
      return { teacher, subjects, subjectIds: [...subIds] };
    })
    .filter(Boolean)
    .sort((a, b) => a.teacher.name.localeCompare(b.teacher.name));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, iconBg }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0 ml-3`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function GradeDistribution({ dist, total }) {
  const grades = ['A', 'B', 'C', 'S', 'W'];
  const labels = { A: 'Excellent (75+)', B: 'Good (65–74)', C: 'Average (55–64)', S: 'Pass (35–54)', W: 'Fail (<35)' };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-4 flex items-center gap-2">
        <BarChart2 size={15} className="text-indigo-500" /> Grade Distribution
      </h3>
      <div className="space-y-3">
        {grades.map(g => {
          const count = dist[g] || 0;
          const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
          const c     = GRADE_COLOR[g];
          return (
            <div key={g}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-2">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${c.badge}`}>{g}</span>
                  <span className="text-slate-500 dark:text-slate-400">{labels[g]}</span>
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-semibold">{count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full ${c.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubjectBarChart({ subjects, label = 'Subject Average Performance' }) {
  const max = 100;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-4 flex items-center gap-2">
        <TrendingUp size={15} className="text-emerald-500" /> {label}
      </h3>
      <div className="space-y-3">
        {subjects.map(st => {
          const avg = Number(st.avg);
          const g   = getGrade(avg);
          const c   = GRADE_COLOR[g];
          const pct = Math.round((avg / max) * 100);
          return (
            <div key={st.subjectId ?? st.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-700 dark:text-slate-200 font-medium truncate max-w-[60%]">{st.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <GradeBadge grade={g} />
                  <span className="font-bold text-slate-700 dark:text-slate-200">{st.avg}</span>
                </div>
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full ${c.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExamSection({ section, showClassComparison }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
            T{section.term}
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{section.examName}</p>
            <div className="flex items-center gap-3 mt-0.5">
              {section.avg !== null && (
                <span className="text-xs text-slate-500 dark:text-slate-400">Avg: <span className="font-semibold text-slate-700 dark:text-slate-200">{section.avg}</span></span>
              )}
              <span className="text-xs text-slate-500 dark:text-slate-400">Total: <span className="font-semibold text-slate-700 dark:text-slate-200">{section.total}</span></span>
              {section.rank && (
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Rank #{section.rank} / {section.peerCount}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {section.avg !== null && <GradeBadge grade={getGrade(Number(section.avg))} />}
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Subject</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Marks</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Grade</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Performance</th>
                {showClassComparison && (
                  <>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Class Avg</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Diff</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {section.rows.map(row => {
                const pct = Math.round((row.marks / 100) * 100);
                const c   = GRADE_COLOR[row.grade] || GRADE_COLOR.W;
                return (
                  <tr key={row.subjectId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{row.subjectName}</p>
                      {row.subjectCode && <p className="text-xs text-slate-400 font-mono">{row.subjectCode}</p>}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-100">{row.marks}</td>
                    <td className="px-4 py-3 text-center"><GradeBadge grade={row.grade} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full ${c.bar} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 w-7 text-right">{pct}%</span>
                      </div>
                    </td>
                    {showClassComparison && (
                      <>
                        <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300 text-sm">{row.classAvg ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {row.diff !== null ? (
                            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                              row.diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : row.diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'
                            }`}>
                              {row.diff > 0 ? <TrendingUp size={12} /> : row.diff < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                              {row.diff > 0 ? '+' : ''}{row.diff}
                            </span>
                          ) : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50/80 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700">
              <tr>
                <td className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Total / Average</td>
                <td className="px-4 py-2.5 text-center font-bold text-slate-800 dark:text-slate-100">{section.total}</td>
                <td className="px-4 py-2.5 text-center">{section.avg !== null && <GradeBadge grade={getGrade(Number(section.avg))} />}</td>
                <td className="px-4 py-2.5"><span className="text-xs text-slate-500 font-medium">Avg: {section.avg ?? '—'}</span></td>
                {showClassComparison && <><td /><td /></>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Class exam card (supervisor/subject-teacher) ──────────────────────────────
function ClassExamCard({ section }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
            T{section.term}
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{section.examName}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-slate-500 dark:text-slate-400">Class Avg: <span className="font-semibold text-slate-700 dark:text-slate-200">{section.classAvg ?? '—'}</span></span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{section.studentCount} student{section.studentCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {section.classAvg && <GradeBadge grade={getGrade(Number(section.classAvg))} />}
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Class Avg</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Students</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade Mix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {section.subjectAvgs.map(row => {
                const g = getGrade(Number(row.avg));
                const c = GRADE_COLOR[g];
                const pct = Math.round((Number(row.avg) / 100) * 100);
                return (
                  <tr key={row.subjectId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{row.name}</p>
                      {row.code && <p className="text-xs text-slate-400 font-mono">{row.code}</p>}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-100">{row.avg}</td>
                    <td className="px-4 py-3 text-center"><GradeBadge grade={g} /></td>
                    <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400 text-sm">{row.count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full ${c.bar} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 w-7 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Subject detail card for subject-teacher view ───────────────────────────────
function SubjectDetailCard({ subject }) {
  const [open, setOpen] = useState(false);
  const g = getGrade(Number(subject.avg));
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 ${GRADE_COLOR[g].bar} text-white rounded-lg flex items-center justify-center text-xs font-bold shrink-0`}>
            {g}
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{subject.name}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-slate-500">Avg: <span className="font-semibold text-slate-700 dark:text-slate-200">{subject.avg}</span></span>
              <span className="text-xs text-slate-500">Best: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{subject.best}</span></span>
              <span className="text-xs text-slate-500">Lowest: <span className="font-semibold text-red-500 dark:text-red-400">{subject.worst}</span></span>
              <span className="text-xs text-slate-500">{subject.count} students</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GradeBadge grade={g} />
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">Rank</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Marks</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {subject.studentRows.map((row, i) => {
                const sg = getGrade(row.marks);
                const sc = GRADE_COLOR[sg];
                const pct = Math.round((row.marks / 100) * 100);
                return (
                  <tr key={row.student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-center text-xs font-bold text-slate-500 dark:text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{row.student.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{row.student.admissionNo}</p>
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-slate-800 dark:text-slate-100">{row.marks}</td>
                    <td className="px-4 py-2.5 text-center"><GradeBadge grade={sg} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full ${sc.bar} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 w-7 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MarkAnalyzer() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin   = user?.role === 'admin' || user?.role === 'principal';
  const isStudent = user?.role === 'student';

  // 'student' | 'admin' | 'supervisor' | 'subject-teacher'
  const [mode, setMode]                         = useState(null);
  const [accessChecked, setAccessChecked]       = useState(false);

  // Supervisor / subject-teacher info
  const [supervisorClass, setSupervisorClass]   = useState(null);
  const [teacherRecord, setTeacherRecord]       = useState(null);
  const [teachingClasses, setTeachingClasses]   = useState([]); // classes teacher is assigned subjects in
  const [teacherSubjectsMap, setTeacherSubjectsMap] = useState(new Map()); // classId → [subjectId]
  const [selectedClassId, setSelectedClassId]   = useState('');

  // Supervisor dual-tab
  const [supervisorTab, setSupervisorTab]               = useState('class'); // 'class' | 'subjects'
  const [supervisorSubjectClassId, setSupervisorSubjectClassId] = useState('');
  const [subjectAnalysis, setSubjectAnalysis]           = useState(null);
  const [subjectLoading, setSubjectLoading]             = useState(false);

  // Student mode state
  const [studentRec, setStudentRec]               = useState(null);
  const [studentClassRec, setStudentClassRec]     = useState(null);

  // Admin mode state
  const [adminAllClasses, setAdminAllClasses]           = useState([]);
  const [adminSelectedClass, setAdminSelectedClass]     = useState(null);
  const [adminTab, setAdminTab]                         = useState('class'); // 'class' | 'teacher' | 'student'
  const [adminClassAnalysis, setAdminClassAnalysis]     = useState(null);
  const [adminClassLoading, setAdminClassLoading]       = useState(false);
  const [adminTeachersList, setAdminTeachersList]       = useState([]);
  const [adminSelectedTeacher, setAdminSelectedTeacher] = useState(null);
  const [adminTeacherAnalysis, setAdminTeacherAnalysis] = useState(null);
  const [adminTeacherLoading, setAdminTeacherLoading]   = useState(false);
  const [adminClassStudents, setAdminClassStudents]     = useState([]);
  const [adminStudentSearch, setAdminStudentSearch]     = useState('');
  const [adminSelectedStudentId, setAdminSelectedStudentId] = useState('');

  // Analysis state (student mode + admin student tab)
  const [analysis, setAnalysis]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);

  // ── Access guard + init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // ── Student ──────────────────────────────────────────────────────────
        if (isStudent) {
          setMode('student');
          setAccessChecked(true);
          const allUsers   = await db.table('users').toArray();
          const userRecord = allUsers.find(u => u.id === user.id);
          const studentId  = userRecord?.studentId ?? user?.studentId;
          let stu = studentId ? await db.students.get(studentId) : null;
          if (!stu) {
            const name = userRecord?.name || user?.name;
            if (name) stu = await db.students.where('name').equals(name).first();
          }
          if (stu) {
            const allClasses = await db.classes.toArray();
            const cls = allClasses.find(c => c.grade === Number(stu.grade) && c.parallel === stu.parallel) || null;
            setStudentRec(stu);
            setStudentClassRec(cls);
          }
          setLoadingInit(false);
          return;
        }

        // ── Admin / Principal ─────────────────────────────────────────────────
        if (isAdmin) {
          setMode('admin');
          setAccessChecked(true);
          const allCls = await db.classes.toArray();
          setAdminAllClasses(allCls.sort((a, b) => a.grade - b.grade || a.parallel.localeCompare(b.parallel)));
          setLoadingInit(false);
          return;
        }

        // ── Teacher ───────────────────────────────────────────────────────────
        if (user.role === 'teacher') {
          const allUsers    = await db.table('users').toArray();
          const userRecord  = allUsers.find(u => u.id === user.id);
          const teacherId   = userRecord?.teacherId ?? user?.teacherId;
          let tRecord = teacherId ? await db.teachers.get(teacherId) : null;
          if (!tRecord) {
            const name = userRecord?.name || user?.name;
            if (name) tRecord = await db.teachers.where('name').equals(name).first();
          }
          if (!tRecord) { navigate('/403', { replace: true }); return; }

          setTeacherRecord(tRecord);

          // Check for supervising class
          const supClass = await db.classes.where('classTeacherId').equals(tRecord.id).first();

          // Fetch subject-teaching data (needed for both supervisor + subject-teacher modes)
          const [subjectTeacherRows, timetableRows, allSubjectsArr, allClassesArr] = await Promise.all([
            db.subjectTeachers.where('teacherId').equals(tRecord.id).toArray(),
            db.timetable.where('teacherId').equals(tRecord.id).toArray(),
            db.subjects.toArray(),
            db.classes.toArray(),
          ]);

          // Also check subjects.teacherId
          const subjectsByTeacher = allSubjectsArr.filter(s => s.teacherId === tRecord.id);

          // Build classId → subjectIds map
          const classSubjectMap = new Map(); // classId → Set of subjectIds

          // From subjectTeachers (has classId directly)
          subjectTeacherRows.forEach(st => {
            if (!st.classId) return;
            if (!classSubjectMap.has(st.classId)) classSubjectMap.set(st.classId, new Set());
            classSubjectMap.get(st.classId).add(st.subjectId);
          });

          // From timetable
          timetableRows.forEach(tt => {
            if (!tt.classId) return;
            if (!classSubjectMap.has(tt.classId)) classSubjectMap.set(tt.classId, new Set());
            if (tt.subjectId) classSubjectMap.get(tt.classId).add(tt.subjectId);
          });

          // From subjects.teacherId — match grade to classes
          subjectsByTeacher.forEach(sub => {
            const matchingClasses = allClassesArr.filter(c => c.grade === Number(sub.grade));
            matchingClasses.forEach(cls => {
              if (!classSubjectMap.has(cls.id)) classSubjectMap.set(cls.id, new Set());
              classSubjectMap.get(cls.id).add(sub.id);
            });
          });

          // Load class records + serialize subject map (shared for both branches)
          const classIds  = [...classSubjectMap.keys()];
          const classes   = allClassesArr.filter(c => classIds.includes(c.id))
            .sort((a, b) => a.grade - b.grade || a.parallel.localeCompare(b.parallel));
          const serialMap = new Map([...classSubjectMap.entries()].map(([k, v]) => [k, [...v]]));

          if (supClass) {
            // Supervisor: set class overview + store teaching classes for "My Subjects" tab
            setSupervisorClass(supClass);
            setTeachingClasses(classes);
            setTeacherSubjectsMap(serialMap);
            setMode('supervisor');
            setAccessChecked(true);
            setLoadingInit(false);
            return;
          }

          if (classSubjectMap.size === 0) { navigate('/403', { replace: true }); return; }

          setTeachingClasses(classes);
          setTeacherSubjectsMap(serialMap);
          setMode('subject-teacher');
          setAccessChecked(true);
          setLoadingInit(false);
          return;
        }

        navigate('/403', { replace: true });
      } catch { navigate('/403', { replace: true }); }
    })();
  }, [user]);

  // ── Auto-load: student mode ───────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'student' || !studentRec) return;
    (async () => {
      setLoading(true);
      try { setAnalysis(await computeStudentAnalysis(studentRec)); }
      finally { setLoading(false); }
    })();
  }, [mode, studentRec]);

  // ── Auto-load: supervisor mode ────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'supervisor' || !supervisorClass) return;
    (async () => {
      setLoading(true);
      try { setAnalysis(await computeClassAnalysis(supervisorClass)); }
      finally { setLoading(false); }
    })();
  }, [mode, supervisorClass]);

  // ── Admin: select class ────────────────────────────────────────────────────────
  const handleAdminSelectClass = useCallback(async (cls) => {
    setAdminSelectedClass(cls);
    setAdminTab('class');
    setAdminClassAnalysis(null);
    setAdminTeachersList([]);
    setAdminSelectedTeacher(null);
    setAdminTeacherAnalysis(null);
    setAdminClassStudents([]);
    setAdminSelectedStudentId('');
    setAdminStudentSearch('');
    setStudentRec(null);
    setAnalysis(null);
    if (!cls) return;
    setAdminClassLoading(true);
    try {
      const [classAnalysis, teachers, allStudents] = await Promise.all([
        computeClassAnalysis(cls),
        loadClassTeachers(cls),
        db.students.toArray(),
      ]);
      setAdminClassAnalysis(classAnalysis);
      setAdminTeachersList(teachers);
      const classStudents = allStudents
        .filter(s => Number(s.grade) === cls.grade && s.parallel === cls.parallel)
        .sort((a, b) => a.name.localeCompare(b.name));
      setAdminClassStudents(classStudents);
    } finally { setAdminClassLoading(false); }
  }, []);

  // ── Admin: select subject teacher ──────────────────────────────────────────────
  const handleAdminSelectTeacher = useCallback(async (entry) => {
    setAdminSelectedTeacher(entry);
    setAdminTeacherAnalysis(null);
    if (!entry || !adminSelectedClass) return;
    setAdminTeacherLoading(true);
    try {
      setAdminTeacherAnalysis(await computeSubjectTeacherAnalysis(entry.teacher, adminSelectedClass, entry.subjectIds));
    } finally { setAdminTeacherLoading(false); }
  }, [adminSelectedClass]);

  // ── Admin: select student ──────────────────────────────────────────────────────
  const handleAdminSelectStudent = useCallback(async (sid) => {
    setAdminSelectedStudentId(sid);
    setAnalysis(null);
    setStudentRec(null);
    if (!sid) return;
    setLoading(true);
    try {
      const stu = await db.students.get(Number(sid));
      if (!stu) return;
      setStudentRec(stu);
      setStudentClassRec(adminSelectedClass);
      setAnalysis(await computeStudentAnalysis(stu));
    } finally { setLoading(false); }
  }, [adminSelectedClass]);

  // ── Subject-teacher: pick class ───────────────────────────────────────────────
  const handlePickClass = useCallback(async (classIdStr) => {
    setSelectedClassId(classIdStr);
    setAnalysis(null);
    if (!classIdStr) return;
    const classId  = Number(classIdStr);
    const classRec = teachingClasses.find(c => c.id === classId);
    if (!classRec) return;
    const subjectIds = teacherSubjectsMap.get(classId) || [];
    if (subjectIds.length === 0) return;
    setLoading(true);
    try { setAnalysis(await computeSubjectTeacherAnalysis(teacherRecord, classRec, subjectIds)); }
    finally { setLoading(false); }
  }, [teachingClasses, teacherSubjectsMap, teacherRecord]);

  // ── Supervisor: pick class for "My Subjects" tab ──────────────────────────────
  const handleSupervisorSubjectClass = useCallback(async (classIdStr) => {
    setSupervisorSubjectClassId(classIdStr);
    setSubjectAnalysis(null);
    if (!classIdStr) return;
    const classId  = Number(classIdStr);
    const classRec = teachingClasses.find(c => c.id === classId);
    if (!classRec) return;
    const subjectIds = teacherSubjectsMap.get(classId) || [];
    if (subjectIds.length === 0) return;
    setSubjectLoading(true);
    try { setSubjectAnalysis(await computeSubjectTeacherAnalysis(teacherRecord, classRec, subjectIds)); }
    finally { setSubjectLoading(false); }
  }, [teachingClasses, teacherSubjectsMap, teacherRecord]);

  if (!accessChecked) return null;

  const selectedTeachingClass = teachingClasses.find(c => c.id === Number(selectedClassId)) || null;

  // Admin derived
  const filteredAdminStudents = adminClassStudents.filter(s =>
    !adminStudentSearch ||
    s.name.toLowerCase().includes(adminStudentSearch.toLowerCase()) ||
    (s.admissionNo || '').toLowerCase().includes(adminStudentSearch.toLowerCase())
  );
  const adminSectionGroups = adminAllClasses.reduce((acc, cls) => {
    const sec = cls.section || 'Other';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(cls);
    return acc;
  }, {});

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BarChart2 size={22} className="text-indigo-500" /> Mark Analyzer
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {mode === 'student'         && 'Your comprehensive academic performance report'}
            {mode === 'admin' && !adminSelectedClass && 'Select a class to begin detailed analysis'}
            {mode === 'admin' && adminSelectedClass && adminTab === 'class'   && `Grade ${adminSelectedClass.grade}${adminSelectedClass.parallel} · Class Overview`}
            {mode === 'admin' && adminSelectedClass && adminTab === 'teacher' && `Grade ${adminSelectedClass.grade}${adminSelectedClass.parallel} · Subject / Teacher Analysis`}
            {mode === 'admin' && adminSelectedClass && adminTab === 'student' && `Grade ${adminSelectedClass.grade}${adminSelectedClass.parallel} · Student Analysis`}
            {mode === 'supervisor'      && supervisorTab === 'class' && `Class ${supervisorClass?.grade}${supervisorClass?.parallel} — Overall Performance`}
            {mode === 'supervisor'      && supervisorTab === 'subjects' && 'Your subject marks analysis by teaching class'}
            {mode === 'subject-teacher' && 'Select a class to view your subject marks analysis'}
          </p>
        </div>
        {/* Supervisor class badge */}
        {mode === 'supervisor' && supervisorClass && (
          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-2">
            <Users size={15} className="text-indigo-500" />
            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              Grade {supervisorClass.grade}{supervisorClass.parallel} · {supervisorClass.section}
            </span>
          </div>
        )}
      </div>

      {/* ── Supervisor: tab bar ───────────────────────────────────────────────── */}
      {mode === 'supervisor' && (
        <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
          {[
            { key: 'class',    label: 'Class Overview', icon: Users },
            { key: 'subjects', label: 'My Subjects',    icon: BookOpen },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setSupervisorTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                supervisorTab === t.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <t.icon size={15} className="shrink-0" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Admin: Class selector grid ────────────────────────────────────────── */}
      {mode === 'admin' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <School size={15} className="text-slate-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Select Class</span>
            {adminSelectedClass && (
              <button onClick={() => handleAdminSelectClass(null)}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                Clear selection
              </button>
            )}
          </div>
          <div className="p-4 space-y-4">
            {Object.entries(adminSectionGroups).map(([section, classes]) => {
              const sm = SECTION_META[section] || SECTION_META.Primary;
              return (
                <div key={section}>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${sm.color}`}>{section}</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                    {classes.map(cls => {
                      const isSelected = adminSelectedClass?.id === cls.id;
                      return (
                        <button key={cls.id}
                          onClick={() => handleAdminSelectClass(isSelected ? null : cls)}
                          className={`flex flex-col items-center justify-center rounded-xl py-3 px-2 border-2 transition-all ${
                            isSelected
                              ? `${sm.bg} ${sm.border} ring-2 ${sm.ring}`
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <span className={`text-lg font-black leading-none ${isSelected ? sm.color : 'text-slate-700 dark:text-slate-200'}`}>
                            {cls.grade}{cls.parallel}
                          </span>
                          <span className={`text-[10px] font-medium mt-0.5 ${isSelected ? sm.color : 'text-slate-400 dark:text-slate-500'}`}>
                            {section.slice(0, 3).toUpperCase()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {adminAllClasses.length === 0 && !loadingInit && (
              <p className="text-sm text-slate-400 text-center py-4 flex items-center justify-center gap-2">
                <AlertCircle size={14} /> No classes found.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Admin: selected class info strip + tab bar ────────────────────────── */}
      {mode === 'admin' && adminSelectedClass && (
        <>
          {(() => {
            const sm = SECTION_META[adminSelectedClass.section] || SECTION_META.Primary;
            return (
              <div className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border ${sm.bg} ${sm.border}`}>
                <span className={`text-sm font-bold ${sm.color}`}>
                  Grade {adminSelectedClass.grade}{adminSelectedClass.parallel}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${sm.bg} ${sm.color} ${sm.border}`}>
                  {adminSelectedClass.section}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {adminClassStudents.length} student{adminClassStudents.length !== 1 ? 's' : ''}
                </span>
                {adminTeachersList.length > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    · {adminTeachersList.length} teacher{adminTeachersList.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            );
          })()}
          <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
            {[
              { key: 'class',   label: 'Class Overview',    icon: Users        },
              { key: 'teacher', label: 'Subject / Teacher', icon: BookOpen     },
              { key: 'student', label: 'Student',           icon: GraduationCap },
            ].map(t => (
              <button key={t.key} onClick={() => setAdminTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  adminTab === t.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}>
                <t.icon size={15} className="shrink-0" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Subject-teacher: Class picker ────────────────────────────────────── */}
      {mode === 'subject-teacher' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
            <BookOpen size={15} className="text-blue-500" /> Select Teaching Class
          </h3>
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <select
              value={selectedClassId} onChange={e => handlePickClass(e.target.value)}
              className="flex-1 sm:max-w-xs border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
            >
              <option value="">— Select Class —</option>
              {teachingClasses.map(c => (
                <option key={c.id} value={c.id}>Grade {c.grade}{c.parallel} — {c.section}</option>
              ))}
            </select>
            {selectedTeachingClass && teacherSubjectsMap.has(Number(selectedClassId)) && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">Your subjects:</span>
                {/* We'll show subject count, expanded in analysis */}
                <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 px-2 py-0.5 rounded-full font-medium">
                  {(teacherSubjectsMap.get(Number(selectedClassId)) || []).length} subject{(teacherSubjectsMap.get(Number(selectedClassId)) || []).length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
          {teachingClasses.length === 0 && !loadingInit && (
            <p className="text-sm text-slate-400 mt-3 flex items-center gap-2">
              <AlertCircle size={14} /> No teaching assignments found.
            </p>
          )}
        </div>
      )}

      {/* Loading init */}
      {loadingInit && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Sk key={i} className="h-20" />)}
        </div>
      )}

      {/* ── Student identity banner (student mode) ───────────────────────────── */}
      {mode === 'student' && studentRec && !loadingInit && (
        <div className="bg-gradient-to-r from-indigo-700 to-blue-600 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <GraduationCap size={28} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{studentRec.name}</h3>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className="text-indigo-200 text-sm">Grade {studentRec.grade}{studentRec.parallel}</span>
                {studentClassRec?.section && (
                  <span className="text-xs bg-white/20 border border-white/30 px-2 py-0.5 rounded-full">{studentClassRec.section}</span>
                )}
                {studentRec.admissionNo && <span className="text-xs text-indigo-200 font-mono">{studentRec.admissionNo}</span>}
                {studentRec.gender && <span className="text-xs text-indigo-200">{studentRec.gender}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Subject-teacher selected class banner ────────────────────────────── */}
      {mode === 'subject-teacher' && selectedTeachingClass && !loadingInit && (
        <div className="bg-gradient-to-r from-teal-700 to-emerald-600 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <BookOpen size={28} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Grade {selectedTeachingClass.grade}{selectedTeachingClass.parallel}</h3>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className="text-emerald-200 text-sm">{selectedTeachingClass.section} Section</span>
                <span className="text-xs bg-white/20 border border-white/30 px-2 py-0.5 rounded-full">
                  {(teacherSubjectsMap.get(Number(selectedClassId)) || []).length} subject{(teacherSubjectsMap.get(Number(selectedClassId)) || []).length !== 1 ? 's' : ''} assigned
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Sk key={i} className="h-20" />)}</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><Sk className="h-64" /><Sk className="h-64" /></div>
          <Sk className="h-48" /><Sk className="h-48" />
        </div>
      )}

      {/* No data */}
      {!loading && mode === 'student' && studentRec && analysis === null && !loadingInit && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-14 text-center">
          <BookOpen size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No marks recorded yet.</p>
        </div>
      )}
      {!loading && mode === 'supervisor' && supervisorTab === 'class' && analysis === null && !loadingInit && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-14 text-center">
          <Users size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No marks recorded for this class yet.</p>
        </div>
      )}
      {!loading && mode === 'subject-teacher' && selectedClassId && analysis === null && !loadingInit && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-14 text-center">
          <BookOpen size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No marks found for your subjects in this class.</p>
        </div>
      )}

      {/* Admin: empty — no class selected */}
      {mode === 'admin' && !adminSelectedClass && !loadingInit && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-14 text-center">
          <School size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Select a class from the grid above to start analysis.</p>
        </div>
      )}
      {mode === 'subject-teacher' && !selectedClassId && !loadingInit && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-14 text-center">
          <BookOpen size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Select one of your teaching classes above.</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* STUDENT analysis output                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {!loading && analysis && mode === 'student' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Overall Average" value={analysis.overallAvg ?? '—'}
              sub={analysis.overallAvg ? `Grade ${getGrade(Number(analysis.overallAvg))}` : undefined}
              icon={TrendingUp} iconBg="bg-indigo-500" />
            <StatCard label="Marks Recorded" value={analysis.totalEntries}
              sub={`${analysis.examSections.length} exam${analysis.examSections.length !== 1 ? 's' : ''}`}
              icon={BookOpen} iconBg="bg-blue-500" />
            <StatCard label="Best Subject" value={analysis.bestSubject?.avg ?? '—'}
              sub={analysis.bestSubject?.name} icon={Star} iconBg="bg-emerald-500" />
            <StatCard label="Needs Attention" value={analysis.worstSubject?.avg ?? '—'}
              sub={analysis.worstSubject?.name} icon={AlertCircle} iconBg="bg-amber-500" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GradeDistribution dist={analysis.gradeDist} total={analysis.totalEntries} />
            <SubjectBarChart subjects={analysis.subjectTrends.map(st => ({ subjectId: st.name, name: st.name, avg: st.avg }))} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
              <Award size={15} className="text-amber-500" /> Exam Breakdown
            </h3>
            <div className="space-y-4">
              {analysis.examSections.map(section => (
                <ExamSection key={section.examId} section={section} showClassComparison={false} />
              ))}
            </div>
          </div>
          {analysis.subjectTrends.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                  <BarChart2 size={15} className="text-purple-500" /> Subject Summary
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Average</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Best</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Lowest</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Exams</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {analysis.subjectTrends.map(st => {
                      const g = getGrade(Number(st.avg));
                      return (
                        <tr key={st.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-slate-800 dark:text-slate-100">{st.name}</p>
                            {st.code && <p className="text-xs text-slate-400 font-mono">{st.code}</p>}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-100">{st.avg}</td>
                          <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold">{st.best}</td>
                          <td className="px-4 py-3 text-center text-red-500 dark:text-red-400 font-semibold">{st.worst}</td>
                          <td className="px-4 py-3 text-center text-slate-500">{st.scores.length}</td>
                          <td className="px-4 py-3 text-center"><GradeBadge grade={g} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ADMIN — Class Overview tab                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mode === 'admin' && adminSelectedClass && adminTab === 'class' && (
        <>
          {adminClassLoading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Sk key={i} className="h-20" />)}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><Sk className="h-64" /><Sk className="h-64" /></div>
              <Sk className="h-48" />
            </div>
          )}
          {!adminClassLoading && !adminClassAnalysis && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-14 text-center">
              <Users size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">No marks recorded for this class yet.</p>
            </div>
          )}
          {!adminClassLoading && adminClassAnalysis && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Class Average" value={adminClassAnalysis.overallAvg ?? '—'}
                  sub={adminClassAnalysis.overallAvg ? `Grade ${getGrade(Number(adminClassAnalysis.overallAvg))}` : undefined}
                  icon={TrendingUp} iconBg="bg-indigo-500" />
                <StatCard label="Students" value={adminClassAnalysis.classStudents.length}
                  sub={`${adminClassAnalysis.studentAvgs.length} with marks`} icon={Users} iconBg="bg-blue-500" />
                <StatCard label="Top Subject" value={adminClassAnalysis.bestSubject?.avg ?? '—'}
                  sub={adminClassAnalysis.bestSubject?.name} icon={Star} iconBg="bg-emerald-500" />
                <StatCard label="Weakest Subject" value={adminClassAnalysis.worstSubject?.avg ?? '—'}
                  sub={adminClassAnalysis.worstSubject?.name} icon={AlertCircle} iconBg="bg-amber-500" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <GradeDistribution dist={adminClassAnalysis.gradeDist} total={adminClassAnalysis.totalEntries} />
                <SubjectBarChart subjects={adminClassAnalysis.subjectStats} label="Subject Averages (Class)" />
              </div>
              {adminClassAnalysis.examSections.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
                    <Award size={15} className="text-amber-500" /> Exam Breakdown
                  </h3>
                  <div className="space-y-4">
                    {adminClassAnalysis.examSections.map(s => <ClassExamCard key={s.examId} section={s} />)}
                  </div>
                </div>
              )}
              {adminClassAnalysis.studentAvgs.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <Trophy size={15} className="text-amber-500" />
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Student Rankings (All-time Avg)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">Rank</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Average</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Records</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {adminClassAnalysis.studentAvgs.map((r, i) => {
                          const g = getGrade(Number(r.avg));
                          const RS = ['bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300','bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300','bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'];
                          return (
                            <tr key={r.student.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${i < 3 ? 'bg-amber-50/20 dark:bg-amber-900/5' : ''}`}>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? RS[i] : 'text-slate-400 dark:text-slate-500'}`}>{i + 1}</span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-800 dark:text-slate-100">{r.student.name}</p>
                                <p className="text-xs text-slate-400 font-mono">{r.student.admissionNo}</p>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-100">{r.avg}</td>
                              <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">{r.count}</td>
                              <td className="px-4 py-3 text-center"><GradeBadge grade={g} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ADMIN — Subject / Teacher tab                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mode === 'admin' && adminSelectedClass && adminTab === 'teacher' && (
        <>
          {adminTeachersList.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-14 text-center">
              <User size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">No subject teachers assigned to this class yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {adminTeachersList.map(entry => {
                const isSelected = adminSelectedTeacher?.teacher.id === entry.teacher.id;
                return (
                  <button key={entry.teacher.id}
                    onClick={() => handleAdminSelectTeacher(isSelected ? null : entry)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                        {entry.teacher.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100'}`}>
                          {entry.teacher.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {entry.subjects.length} subject{entry.subjects.length !== 1 ? 's' : ''}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {entry.subjects.slice(0, 4).map(s => (
                            <span key={s.id} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-medium">
                              {s.code ? s.code.replace(/\d+$/, '') : s.name.slice(0, 6)}
                            </span>
                          ))}
                          {entry.subjects.length > 4 && (
                            <span className="text-[10px] text-slate-400 px-1 py-0.5">+{entry.subjects.length - 4}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {adminTeacherLoading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Sk key={i} className="h-20" />)}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><Sk className="h-64" /><Sk className="h-64" /></div>
              <Sk className="h-48" />
            </div>
          )}
          {!adminTeacherLoading && adminSelectedTeacher && !adminTeacherAnalysis && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-14 text-center">
              <BookOpen size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">No marks found for {adminSelectedTeacher.teacher.name}'s subjects in this class.</p>
            </div>
          )}
          {!adminTeacherLoading && adminTeacherAnalysis && (
            <>
              <div className="bg-gradient-to-r from-indigo-700 to-blue-600 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 text-white font-black text-lg">
                    {adminSelectedTeacher.teacher.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{adminSelectedTeacher.teacher.name}</h3>
                    <p className="text-indigo-200 text-sm mt-0.5 line-clamp-1">
                      {adminSelectedTeacher.subjects.map(s => s.name).join(' · ')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Overall Average" value={adminTeacherAnalysis.overallAvg ?? '—'}
                  sub={adminTeacherAnalysis.overallAvg ? `Grade ${getGrade(Number(adminTeacherAnalysis.overallAvg))}` : undefined}
                  icon={TrendingUp} iconBg="bg-indigo-500" />
                <StatCard label="Total Records" value={adminTeacherAnalysis.totalEntries}
                  sub={`${adminTeacherAnalysis.subjectStats.length} subject${adminTeacherAnalysis.subjectStats.length !== 1 ? 's' : ''}`}
                  icon={BookOpen} iconBg="bg-blue-500" />
                <StatCard label="Top Subject" value={adminTeacherAnalysis.subjectStats[0]?.avg ?? '—'}
                  sub={adminTeacherAnalysis.subjectStats[0]?.name} icon={Star} iconBg="bg-emerald-500" />
                <StatCard label="Needs Attention" value={adminTeacherAnalysis.subjectStats[adminTeacherAnalysis.subjectStats.length - 1]?.avg ?? '—'}
                  sub={adminTeacherAnalysis.subjectStats[adminTeacherAnalysis.subjectStats.length - 1]?.name} icon={AlertCircle} iconBg="bg-amber-500" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <GradeDistribution dist={adminTeacherAnalysis.gradeDist} total={adminTeacherAnalysis.totalEntries} />
                <SubjectBarChart subjects={adminTeacherAnalysis.subjectStats} label="Subject Averages" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
                  <BookOpen size={15} className="text-indigo-500" /> Subject Details &amp; Student Performance
                </h3>
                <div className="space-y-4">
                  {adminTeacherAnalysis.subjectStats.map(sub => (
                    <SubjectDetailCard key={sub.subjectId} subject={sub} />
                  ))}
                </div>
              </div>
              {adminTeacherAnalysis.examBreakdown.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
                    <Award size={15} className="text-amber-500" /> Exam Breakdown
                  </h3>
                  <div className="space-y-4">
                    {adminTeacherAnalysis.examBreakdown.map(s => <ClassExamCard key={s.examId} section={s} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ADMIN — Student tab                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mode === 'admin' && adminSelectedClass && adminTab === 'student' && (
        <>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <GraduationCap size={15} className="text-slate-500" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Students — Grade {adminSelectedClass.grade}{adminSelectedClass.parallel}
              </span>
              <div className="ml-auto relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search…"
                  value={adminStudentSearch} onChange={e => setAdminStudentSearch(e.target.value)}
                  className="pl-7 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 w-40"
                />
              </div>
            </div>
            {adminClassStudents.length === 0 ? (
              <div className="p-10 text-center">
                <GraduationCap size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-400 dark:text-slate-500">No students in this class.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-72 overflow-y-auto">
                {filteredAdminStudents.map((s, i) => {
                  const isSelected = String(s.id) === String(adminSelectedStudentId);
                  return (
                    <button key={s.id}
                      onClick={() => handleAdminSelectStudent(isSelected ? '' : String(s.id))}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-2 border-transparent'
                      }`}
                    >
                      <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">{i + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {s.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100'}`}>{s.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{s.admissionNo}</p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{s.gender}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Sk key={i} className="h-20" />)}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><Sk className="h-64" /><Sk className="h-64" /></div>
              <Sk className="h-48" />
            </div>
          )}
          {!loading && !adminSelectedStudentId && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
              <GraduationCap size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">Select a student above to view their analysis.</p>
            </div>
          )}
          {!loading && adminSelectedStudentId && studentRec && !analysis && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-14 text-center">
              <BookOpen size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">No marks recorded for {studentRec.name} yet.</p>
            </div>
          )}
          {!loading && analysis && studentRec && (
            <>
              <div className="bg-gradient-to-r from-indigo-700 to-blue-600 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <GraduationCap size={28} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{studentRec.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <span className="text-indigo-200 text-sm">Grade {studentRec.grade}{studentRec.parallel}</span>
                      {adminSelectedClass?.section && <span className="text-xs bg-white/20 border border-white/30 px-2 py-0.5 rounded-full">{adminSelectedClass.section}</span>}
                      {studentRec.admissionNo && <span className="text-xs text-indigo-200 font-mono">{studentRec.admissionNo}</span>}
                      {studentRec.gender && <span className="text-xs text-indigo-200">{studentRec.gender}</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Overall Average" value={analysis.overallAvg ?? '—'}
                  sub={analysis.overallAvg ? `Grade ${getGrade(Number(analysis.overallAvg))}` : undefined}
                  icon={TrendingUp} iconBg="bg-indigo-500" />
                <StatCard label="Marks Recorded" value={analysis.totalEntries}
                  sub={`${analysis.examSections.length} exam${analysis.examSections.length !== 1 ? 's' : ''}`}
                  icon={BookOpen} iconBg="bg-blue-500" />
                <StatCard label="Best Subject" value={analysis.bestSubject?.avg ?? '—'}
                  sub={analysis.bestSubject?.name} icon={Star} iconBg="bg-emerald-500" />
                <StatCard label="Needs Attention" value={analysis.worstSubject?.avg ?? '—'}
                  sub={analysis.worstSubject?.name} icon={AlertCircle} iconBg="bg-amber-500" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <GradeDistribution dist={analysis.gradeDist} total={analysis.totalEntries} />
                <SubjectBarChart subjects={analysis.subjectTrends.map(st => ({ subjectId: st.name, name: st.name, avg: st.avg }))} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
                  <Award size={15} className="text-amber-500" /> Exam Breakdown
                </h3>
                <div className="space-y-4">
                  {analysis.examSections.map(section => (
                    <ExamSection key={section.examId} section={section} showClassComparison={true} />
                  ))}
                </div>
              </div>
              {analysis.subjectTrends.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                      <BarChart2 size={15} className="text-purple-500" /> Subject Summary
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Average</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Best</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Lowest</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Exams</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {analysis.subjectTrends.map(st => {
                          const g = getGrade(Number(st.avg));
                          return (
                            <tr key={st.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="px-5 py-3">
                                <p className="font-medium text-slate-800 dark:text-slate-100">{st.name}</p>
                                {st.code && <p className="text-xs text-slate-400 font-mono">{st.code}</p>}
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-100">{st.avg}</td>
                              <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold">{st.best}</td>
                              <td className="px-4 py-3 text-center text-red-500 dark:text-red-400 font-semibold">{st.worst}</td>
                              <td className="px-4 py-3 text-center text-slate-500">{st.scores.length}</td>
                              <td className="px-4 py-3 text-center"><GradeBadge grade={g} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUPERVISOR — Class Overview tab                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {!loading && analysis && mode === 'supervisor' && supervisorTab === 'class' && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Class Average" value={analysis.overallAvg ?? '—'}
              sub={analysis.overallAvg ? `Grade ${getGrade(Number(analysis.overallAvg))}` : undefined}
              icon={TrendingUp} iconBg="bg-indigo-500" />
            <StatCard label="Students" value={analysis.classStudents.length}
              sub={`${analysis.studentAvgs.length} with marks`} icon={Users} iconBg="bg-blue-500" />
            <StatCard label="Top Subject" value={analysis.bestSubject?.avg ?? '—'}
              sub={analysis.bestSubject?.name} icon={Star} iconBg="bg-emerald-500" />
            <StatCard label="Weakest Subject" value={analysis.worstSubject?.avg ?? '—'}
              sub={analysis.worstSubject?.name} icon={AlertCircle} iconBg="bg-amber-500" />
          </div>

          {/* Grade dist + Subject avgs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GradeDistribution dist={analysis.gradeDist} total={analysis.totalEntries} />
            <SubjectBarChart subjects={analysis.subjectStats} label="Subject Averages (Class)" />
          </div>

          {/* Exam-by-exam class breakdown */}
          {analysis.examSections.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
                <Award size={15} className="text-amber-500" /> Exam Breakdown
              </h3>
              <div className="space-y-4">
                {analysis.examSections.map(section => (
                  <ClassExamCard key={section.examId} section={section} />
                ))}
              </div>
            </div>
          )}

          {/* Top & bottom students */}
          {analysis.studentAvgs.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Trophy size={15} className="text-amber-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Student Rankings (All-time Avg)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">Rank</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Average</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Records</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {analysis.studentAvgs.map((r, i) => {
                      const g = getGrade(Number(r.avg));
                      const RANK_STYLE = [
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                        'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                        'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
                      ];
                      return (
                        <tr key={r.student.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${i < 3 ? 'bg-amber-50/20 dark:bg-amber-900/5' : ''}`}>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? RANK_STYLE[i] : 'text-slate-400 dark:text-slate-500'}`}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800 dark:text-slate-100">{r.student.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{r.student.admissionNo}</p>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-100">{r.avg}</td>
                          <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">{r.count}</td>
                          <td className="px-4 py-3 text-center"><GradeBadge grade={g} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUPERVISOR — My Subjects tab                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mode === 'supervisor' && supervisorTab === 'subjects' && (
        <>
          {/* Class picker */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
              <BookOpen size={15} className="text-indigo-500" /> Select Teaching Class
            </h3>
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <select
                value={supervisorSubjectClassId}
                onChange={e => handleSupervisorSubjectClass(e.target.value)}
                className="flex-1 sm:max-w-xs border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
              >
                <option value="">— Select Class —</option>
                {teachingClasses.map(c => (
                  <option key={c.id} value={c.id}>Grade {c.grade}{c.parallel} — {c.section}</option>
                ))}
              </select>
              {supervisorSubjectClassId && teacherSubjectsMap.has(Number(supervisorSubjectClassId)) && (
                <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 px-2.5 py-1.5 rounded-full font-medium self-center">
                  {(teacherSubjectsMap.get(Number(supervisorSubjectClassId)) || []).length} subject{(teacherSubjectsMap.get(Number(supervisorSubjectClassId)) || []).length !== 1 ? 's' : ''} assigned
                </span>
              )}
            </div>
            {teachingClasses.length === 0 && (
              <p className="text-sm text-slate-400 mt-3 flex items-center gap-2">
                <AlertCircle size={14} /> No subject teaching assignments found.
              </p>
            )}
          </div>

          {/* Selected class banner */}
          {(() => {
            const selCls = teachingClasses.find(c => c.id === Number(supervisorSubjectClassId));
            return selCls ? (
              <div className="bg-gradient-to-r from-teal-700 to-emerald-600 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <BookOpen size={28} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Grade {selCls.grade}{selCls.parallel}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <span className="text-emerald-200 text-sm">{selCls.section} Section</span>
                      <span className="text-xs bg-white/20 border border-white/30 px-2 py-0.5 rounded-full">
                        {(teacherSubjectsMap.get(selCls.id) || []).length} subject{(teacherSubjectsMap.get(selCls.id) || []).length !== 1 ? 's' : ''} assigned
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null;
          })()}

          {/* Loading */}
          {subjectLoading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Sk key={i} className="h-20" />)}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><Sk className="h-64" /><Sk className="h-64" /></div>
              <Sk className="h-48" />
            </div>
          )}

          {/* No data */}
          {!subjectLoading && supervisorSubjectClassId && subjectAnalysis === null && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-14 text-center">
              <BookOpen size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">No marks found for your subjects in this class.</p>
            </div>
          )}

          {/* Empty prompt */}
          {!supervisorSubjectClassId && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-14 text-center">
              <BookOpen size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">Select one of your teaching classes above.</p>
            </div>
          )}

          {/* Subject analysis output */}
          {!subjectLoading && subjectAnalysis && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Overall Average" value={subjectAnalysis.overallAvg ?? '—'}
                  sub={subjectAnalysis.overallAvg ? `Grade ${getGrade(Number(subjectAnalysis.overallAvg))}` : undefined}
                  icon={TrendingUp} iconBg="bg-teal-500" />
                <StatCard label="Total Records" value={subjectAnalysis.totalEntries}
                  sub={`${subjectAnalysis.subjectStats.length} subject${subjectAnalysis.subjectStats.length !== 1 ? 's' : ''}`}
                  icon={BookOpen} iconBg="bg-blue-500" />
                <StatCard label="Top Subject" value={subjectAnalysis.subjectStats[0]?.avg ?? '—'}
                  sub={subjectAnalysis.subjectStats[0]?.name} icon={Star} iconBg="bg-emerald-500" />
                <StatCard label="Needs Attention" value={subjectAnalysis.subjectStats[subjectAnalysis.subjectStats.length - 1]?.avg ?? '—'}
                  sub={subjectAnalysis.subjectStats[subjectAnalysis.subjectStats.length - 1]?.name} icon={AlertCircle} iconBg="bg-amber-500" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <GradeDistribution dist={subjectAnalysis.gradeDist} total={subjectAnalysis.totalEntries} />
                <SubjectBarChart subjects={subjectAnalysis.subjectStats} label="Your Subject Averages" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
                  <BookOpen size={15} className="text-teal-500" /> Subject Details &amp; Student Performance
                </h3>
                <div className="space-y-4">
                  {subjectAnalysis.subjectStats.map(sub => (
                    <SubjectDetailCard key={sub.subjectId} subject={sub} />
                  ))}
                </div>
              </div>
              {subjectAnalysis.examBreakdown.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
                    <Award size={15} className="text-amber-500" /> Exam Breakdown
                  </h3>
                  <div className="space-y-4">
                    {subjectAnalysis.examBreakdown.map(section => (
                      <ClassExamCard key={section.examId} section={section} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUBJECT-TEACHER analysis output                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {!loading && analysis && mode === 'subject-teacher' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Overall Average" value={analysis.overallAvg ?? '—'}
              sub={analysis.overallAvg ? `Grade ${getGrade(Number(analysis.overallAvg))}` : undefined}
              icon={TrendingUp} iconBg="bg-teal-500" />
            <StatCard label="Total Records" value={analysis.totalEntries}
              sub={`${analysis.subjectStats.length} subject${analysis.subjectStats.length !== 1 ? 's' : ''}`}
              icon={BookOpen} iconBg="bg-blue-500" />
            <StatCard label="Top Subject" value={analysis.subjectStats[0]?.avg ?? '—'}
              sub={analysis.subjectStats[0]?.name} icon={Star} iconBg="bg-emerald-500" />
            <StatCard label="Needs Attention" value={analysis.subjectStats[analysis.subjectStats.length - 1]?.avg ?? '—'}
              sub={analysis.subjectStats[analysis.subjectStats.length - 1]?.name} icon={AlertCircle} iconBg="bg-amber-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GradeDistribution dist={analysis.gradeDist} total={analysis.totalEntries} />
            <SubjectBarChart subjects={analysis.subjectStats} label="Your Subject Averages" />
          </div>

          {/* Per-subject detail cards with student rankings */}
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
              <BookOpen size={15} className="text-teal-500" /> Subject Details &amp; Student Performance
            </h3>
            <div className="space-y-4">
              {analysis.subjectStats.map(sub => (
                <SubjectDetailCard key={sub.subjectId} subject={sub} />
              ))}
            </div>
          </div>

          {/* Exam breakdown */}
          {analysis.examBreakdown.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
                <Award size={15} className="text-amber-500" /> Exam Breakdown
              </h3>
              <div className="space-y-4">
                {analysis.examBreakdown.map(section => (
                  <ClassExamCard key={section.examId} section={section} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
