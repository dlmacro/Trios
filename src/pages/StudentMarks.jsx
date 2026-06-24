import { useState, useEffect, useRef } from 'react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import { Printer, TrendingUp, BarChart3, Award, BookOpen } from 'lucide-react';

function getSLGrade(m) {
  const n = Number(m);
  if (n >= 75) return 'A';
  if (n >= 65) return 'B';
  if (n >= 55) return 'C';
  if (n >= 35) return 'S';
  return 'W';
}

const GRADE_CFG = {
  A: { label: 'Excellent',   bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500', print: '#059669' },
  B: { label: 'Very Good',   bg: 'bg-blue-100 dark:bg-blue-900/30',       text: 'text-blue-700 dark:text-blue-400',       bar: 'bg-blue-500',   print: '#2563eb' },
  C: { label: 'Good',        bg: 'bg-violet-100 dark:bg-violet-900/30',   text: 'text-violet-700 dark:text-violet-400',   bar: 'bg-violet-500', print: '#7c3aed' },
  S: { label: 'Average',     bg: 'bg-amber-100 dark:bg-amber-900/30',     text: 'text-amber-700 dark:text-amber-400',     bar: 'bg-amber-500',  print: '#d97706' },
  W: { label: 'Weak',        bg: 'bg-red-100 dark:bg-red-900/30',         text: 'text-red-700 dark:text-red-400',         bar: 'bg-red-500',    print: '#dc2626' },
};

const GRADE_ORDER = ['A','B','C','S','W'];

function Skel({ className }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl ${className}`} />;
}

function GradeBadge({ grade }) {
  const cfg = GRADE_CFG[grade] || GRADE_CFG.W;
  return (
    <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {grade}
    </span>
  );
}

export default function StudentMarks() {
  const { user } = useAuth();
  const printRef = useRef(null);

  const [loading, setLoading]       = useState(true);
  const [student, setStudent]       = useState(null);
  const [classInfo, setClassInfo]   = useState(null);
  const [classTeacher, setClassTeacher] = useState(null);
  const [schoolName, setSchoolName] = useState('School');
  const [exams, setExams]           = useState([]);       // exams the student has results for
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [allResults, setAllResults] = useState([]);       // { examId, examName, examTerm, subjects: [{name, marks, grade}] }

  useEffect(() => {
    async function load() {
      try {
        // School name
        const sn = await db.settings.where('key').equals('schoolName').first();
        if (sn?.value) setSchoolName(sn.value);

        // Resolve student
        const userRecord = await db.users.get(user.id);
        const studentId  = userRecord?.studentId ?? user?.studentId;
        if (!studentId) { setLoading(false); return; }

        const studentRecord = await db.students.get(studentId);
        if (!studentRecord) { setLoading(false); return; }
        setStudent(studentRecord);

        // Class & teacher
        const allClasses = await db.classes.toArray();
        const myClass = allClasses.find(
          c => Number(c.grade) === Number(studentRecord.grade) && c.parallel === studentRecord.parallel
        ) || null;
        setClassInfo(myClass);
        if (myClass?.classTeacherId) {
          const ct = await db.teachers.get(Number(myClass.classTeacherId));
          setClassTeacher(ct || null);
        }

        // All marks for this student
        const rawMarks = await db.marks.where('studentId').equals(studentRecord.id).toArray();
        if (rawMarks.length === 0) { setLoading(false); return; }

        // Enrich with subject & exam info
        const allSubjectsArr = await db.subjects.toArray();
        const allExamsArr    = await db.exams.toArray();
        const subMap  = Object.fromEntries(allSubjectsArr.map(s => [s.id, s]));
        const examMap = Object.fromEntries(allExamsArr.map(e => [e.id, e]));

        // Group by exam
        const grouped = {};
        rawMarks.forEach(m => {
          const exam    = examMap[m.examId];
          const subject = subMap[m.subjectId];
          if (!exam || !subject) return;
          if (!grouped[m.examId]) {
            grouped[m.examId] = {
              examId:   m.examId,
              examName: exam.name,
              examTerm: exam.term,
              examDate: exam.startDate,
              subjects: [],
            };
          }
          const g = getSLGrade(m.marks);
          grouped[m.examId].subjects.push({
            subjectId:   m.subjectId,
            subjectName: subject.name,
            marks:       Number(m.marks),
            grade:       g,
          });
        });

        // Sort subjects by name within each exam
        const results = Object.values(grouped)
          .map(r => ({ ...r, subjects: r.subjects.sort((a,b) => a.subjectName.localeCompare(b.subjectName)) }))
          .sort((a,b) => new Date(b.examDate) - new Date(a.examDate));

        setAllResults(results);
        setExams(results.map(r => ({ id: r.examId, name: r.examName, term: r.examTerm })));
        if (results.length > 0) setSelectedExamId(results[0].examId);
      } catch(err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const selectedResult = allResults.find(r => r.examId === selectedExamId) || null;

  // Derived analysis for selected exam
  const analysis = (() => {
    if (!selectedResult) return null;
    const subs = selectedResult.subjects;
    if (subs.length === 0) return null;
    const total  = subs.reduce((s,m) => s + m.marks, 0);
    const avg    = (total / subs.length).toFixed(1);
    const best   = subs.reduce((a,b) => a.marks >= b.marks ? a : b);
    const worst  = subs.reduce((a,b) => a.marks <= b.marks ? a : b);
    const dist   = { A:0, B:0, C:0, S:0, W:0 };
    subs.forEach(s => dist[s.grade]++);
    return { total, avg, best, worst, dist, count: subs.length };
  })();

  // Overall analysis across all exams
  const overall = (() => {
    const all = allResults.flatMap(r => r.subjects);
    if (all.length === 0) return null;
    const total = all.reduce((s,m) => s + m.marks, 0);
    const avg   = (total / all.length).toFixed(1);
    const dist  = { A:0, B:0, C:0, S:0, W:0 };
    all.forEach(m => dist[m.grade]++);
    return { avg, dist, count: all.length };
  })();

  // Print report card
  const handlePrint = () => {
    if (!student || !selectedResult) return;
    const subs    = selectedResult.subjects;
    const an      = analysis;
    const today   = new Date().toLocaleDateString('en-LK', { year:'numeric', month:'long', day:'numeric' });
    const gradeColorPrint = (g) => GRADE_CFG[g]?.print || '#64748b';

    const rows = subs.map(s => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 12px;font-size:13px;color:#334155;">${s.subjectName}</td>
        <td style="padding:10px 12px;text-align:center;font-size:14px;font-weight:700;color:#1e293b;">${s.marks}</td>
        <td style="padding:10px 12px;text-align:center;font-size:13px;color:#64748b;">${((s.marks/100)*100).toFixed(0)}%</td>
        <td style="padding:10px 12px;text-align:center;">
          <span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${gradeColorPrint(s.grade)}22;color:${gradeColorPrint(s.grade)};">${s.grade}</span>
        </td>
        <td style="padding:10px 12px;font-size:12px;color:#64748b;">${GRADE_CFG[s.grade]?.label || ''}</td>
      </tr>
    `).join('');

    const distRows = GRADE_ORDER.map(g => {
      const cnt = an?.dist[g] || 0;
      const pct = an ? Math.round((cnt / an.count) * 100) : 0;
      return `<tr><td style="padding:4px 8px;font-size:12px;font-weight:700;color:${gradeColorPrint(g)};">${g}</td><td style="padding:4px 8px;font-size:12px;">${GRADE_CFG[g]?.label}</td><td style="padding:4px 8px;font-size:12px;text-align:right;">${cnt}</td><td style="padding:4px 8px;font-size:12px;text-align:right;">${pct}%</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Report Card — ${student.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
    .page { max-width: 800px; margin: 0 auto; padding: 32px; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 20px; border-bottom: 3px solid #2563eb; margin-bottom: 24px; }
    .school-name { font-size: 22px; font-weight: 900; color: #1e293b; }
    .report-title { font-size: 14px; color: #64748b; margin-top: 4px; }
    .badge { background: #2563eb; color: white; padding: 4px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; }
    .info-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
    .info-value { font-size: 16px; font-weight: 700; color: #1e293b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #1e293b; color: white; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    thead th:not(:first-child) { text-align: center; }
    .section-title { font-size: 13px; font-weight: 700; color: #1e293b; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: .08em; border-left: 3px solid #2563eb; padding-left: 8px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
    .sum-box { text-align: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 10px; }
    .sum-val { font-size: 28px; font-weight: 900; color: #2563eb; }
    .sum-lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
    .sig-line { border-top: 1px solid #94a3b8; width: 160px; text-align: center; padding-top: 4px; font-size: 11px; color: #64748b; margin-top: 32px; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="school-name">${schoolName}</div>
      <div class="report-title">Student Progress Report Card</div>
    </div>
    <span class="badge">Term ${selectedResult.examTerm || '—'} · ${new Date().getFullYear()}</span>
  </div>

  <div class="info-grid">
    <div class="info-box"><div class="info-label">Student Name</div><div class="info-value">${student.name}</div></div>
    <div class="info-box"><div class="info-label">Admission No.</div><div class="info-value">${student.admissionNo}</div></div>
    <div class="info-box"><div class="info-label">Grade &amp; Class</div><div class="info-value">Grade ${classInfo?.grade || ''}${classInfo?.parallel || ''} · ${student.section}</div></div>
    <div class="info-box"><div class="info-label">Examination</div><div class="info-value">${selectedResult.examName}</div></div>
    ${classTeacher ? `<div class="info-box"><div class="info-label">Class Teacher</div><div class="info-value">${classTeacher.name}</div></div>` : ''}
    <div class="info-box"><div class="info-label">Date Issued</div><div class="info-value">${today}</div></div>
  </div>

  <div class="summary">
    <div class="sum-box"><div class="sum-val">${an?.avg || '—'}</div><div class="sum-lbl">Average Score</div></div>
    <div class="sum-box"><div class="sum-val">${an?.total || '—'}</div><div class="sum-lbl">Total Marks</div></div>
    <div class="sum-box"><div class="sum-val">${an?.count || '—'}</div><div class="sum-lbl">Subjects</div></div>
  </div>

  <div class="section-title">Subject Results</div>
  <table>
    <thead>
      <tr>
        <th>Subject</th>
        <th>Marks</th>
        <th>%</th>
        <th>Grade</th>
        <th>Remark</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="background:#f8fafc;font-weight:700;">
        <td style="padding:10px 12px;font-size:13px;">Total / Average</td>
        <td style="padding:10px 12px;text-align:center;font-size:14px;">${an?.total || '—'}</td>
        <td style="padding:10px 12px;text-align:center;font-size:13px;">${an?.avg || '—'}%</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>

  <div class="section-title">Grade Distribution</div>
  <table style="width:280px;">
    <thead><tr><th>Grade</th><th>Description</th><th>Count</th><th>%</th></tr></thead>
    <tbody>${distRows}</tbody>
  </table>

  ${an?.best ? `
  <div class="section-title">Highlights</div>
  <table style="width:100%;">
    <thead><tr><th>Category</th><th>Subject</th><th>Score</th><th>Grade</th></tr></thead>
    <tbody>
      <tr><td style="padding:8px 12px;font-size:12px;">Best Subject</td><td style="padding:8px 12px;font-size:13px;font-weight:600;">${an.best.subjectName}</td><td style="padding:8px 12px;text-align:center;font-size:13px;font-weight:700;">${an.best.marks}</td><td style="padding:8px 12px;text-align:center;"><span style="padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${gradeColorPrint(an.best.grade)}22;color:${gradeColorPrint(an.best.grade)};">${an.best.grade}</span></td></tr>
      <tr><td style="padding:8px 12px;font-size:12px;">Needs Improvement</td><td style="padding:8px 12px;font-size:13px;font-weight:600;">${an.worst.subjectName}</td><td style="padding:8px 12px;text-align:center;font-size:13px;font-weight:700;">${an.worst.marks}</td><td style="padding:8px 12px;text-align:center;"><span style="padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${gradeColorPrint(an.worst.grade)}22;color:${gradeColorPrint(an.worst.grade)};">${an.worst.grade}</span></td></tr>
    </tbody>
  </table>
  ` : ''}

  <div class="footer">
    <span>Generated on ${today} · ${schoolName} School Portal</span>
    <span>Grading: A ≥75 · B 65–74 · C 55–64 · S 35–54 · W &lt;35</span>
  </div>

  <div style="display:flex;gap:60px;margin-top:20px;">
    <div class="sig-line">Class Teacher</div>
    <div class="sig-line">Principal</div>
  </div>
</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">My Results</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Loading…' : student ? `${student.name} · Grade ${student.grade}${student.parallel}` : ''}
          </p>
        </div>
        {!loading && selectedResult && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Printer size={16} /> Print Report Card
          </button>
        )}
      </div>

      {/* Exam tabs */}
      {!loading && exams.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {exams.map(e => (
            <button
              key={e.id}
              onClick={() => setSelectedExamId(e.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${selectedExamId === e.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'}`}
            >
              {e.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skel className="h-32 w-full" />
          <Skel className="h-64 w-full" />
        </div>
      ) : allResults.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-14 text-center">
          <BookOpen size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No results recorded yet.</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Your exam results will appear here once they are entered.</p>
        </div>
      ) : selectedResult && (
        <>
          {/* Analysis summary cards */}
          {analysis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Average Score', value: analysis.avg, icon: TrendingUp, color: 'from-blue-400 to-indigo-500' },
                { label: 'Total Marks',  value: analysis.total, icon: BarChart3,  color: 'from-emerald-400 to-teal-500' },
                { label: 'Best Subject', value: analysis.best.grade, icon: Award, color: 'from-amber-400 to-orange-500' },
                { label: 'Subjects',     value: analysis.count, icon: BookOpen,  color: 'from-purple-400 to-violet-500' },
              ].map(c => (
                <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-4 text-white shadow-md`}>
                  <c.icon size={18} className="opacity-80 mb-2" />
                  <p className="text-2xl font-black">{c.value}</p>
                  <p className="text-xs opacity-80 mt-0.5">{c.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Grade distribution */}
          {analysis && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <BarChart3 size={15} className="text-blue-500" /> Grade Distribution
              </h3>
              <div className="space-y-2.5">
                {GRADE_ORDER.map(g => {
                  const count = analysis.dist[g] || 0;
                  const pct   = Math.round((count / analysis.count) * 100);
                  const cfg   = GRADE_CFG[g];
                  return (
                    <div key={g} className="flex items-center gap-3">
                      <GradeBadge grade={g} />
                      <span className="text-xs text-slate-400 dark:text-slate-500 w-20 shrink-0">{cfg.label}</span>
                      <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${cfg.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 w-16 text-right shrink-0">{count} <span className="opacity-60">({pct}%)</span></span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Best / Worst highlights */}
          {analysis && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-md">
                  <Award size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide">Best Subject</p>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-100">{analysis.best.subjectName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{analysis.best.marks} / 100 · <GradeBadge grade={analysis.best.grade} /></p>
                </div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500 flex items-center justify-center shrink-0 shadow-md">
                  <TrendingUp size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold uppercase tracking-wide">Needs Improvement</p>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-100">{analysis.worst.subjectName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{analysis.worst.marks} / 100 · <GradeBadge grade={analysis.worst.grade} /></p>
                </div>
              </div>
            </div>
          )}

          {/* Subject results table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {selectedResult.examName} — Subject Results
              </h3>
              <span className="text-xs text-slate-400 dark:text-slate-500">{selectedResult.subjects.length} subjects</span>
            </div>

            {/* ── Mobile: stacked rows ── */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {selectedResult.subjects.map(s => {
                const cfg = GRADE_CFG[s.grade];
                const pct = s.marks;
                return (
                  <div key={s.subjectId} className="px-4 py-3">
                    {/* Subject + grade badge row */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">{s.subjectName}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-black font-mono text-slate-700 dark:text-slate-200">{s.marks}</span>
                        <GradeBadge grade={s.grade} />
                      </div>
                    </div>
                    {/* Progress bar + % */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${cfg.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 w-8 text-right shrink-0">{pct}%</span>
                    </div>
                  </div>
                );
              })}
              {/* Mobile totals footer */}
              {analysis && (
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Total / Average</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">{analysis.total}</span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{analysis.avg}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Desktop: full table ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {['Subject','Marks','%','Grade','Bar'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider last:w-40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedResult.subjects.map(s => {
                    const cfg = GRADE_CFG[s.grade];
                    const pct = s.marks;
                    return (
                      <tr key={s.subjectId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{s.subjectName}</td>
                        <td className="px-5 py-3 font-mono font-bold text-slate-700 dark:text-slate-200">{s.marks}</td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{pct}%</td>
                        <td className="px-5 py-3"><GradeBadge grade={s.grade} /></td>
                        <td className="px-5 py-3">
                          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden w-full">
                            <div className={`h-full ${cfg.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {analysis && (
                  <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                    <tr>
                      <td className="px-5 py-3 font-bold text-slate-700 dark:text-slate-200">Total / Average</td>
                      <td className="px-5 py-3 font-bold text-slate-700 dark:text-slate-200">{analysis.total}</td>
                      <td className="px-5 py-3 font-bold text-blue-600 dark:text-blue-400">{analysis.avg}%</td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Overall performance across all exams */}
          {overall && allResults.length > 1 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">Overall Performance — All Exams</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{overall.count} results across {allResults.length} exams · Average: <span className="font-semibold text-blue-600 dark:text-blue-400">{overall.avg}</span></p>
              <div className="space-y-2">
                {GRADE_ORDER.map(g => {
                  const count = overall.dist[g] || 0;
                  const pct   = Math.round((count / overall.count) * 100);
                  const cfg   = GRADE_CFG[g];
                  return (
                    <div key={g} className="flex items-center gap-3">
                      <GradeBadge grade={g} />
                      <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${cfg.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 w-16 text-right shrink-0">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
