import { useState, useEffect } from 'react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import { Printer, Clock } from 'lucide-react';

const DAYS         = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS      = [1, 2, 3, 4, 5, 6, 7, 8];
const PERIOD_TIMES = { 1:'7:30–8:15', 2:'8:15–9:00', 3:'9:00–9:45', 4:'9:45–10:30', 5:'10:45–11:30', 6:'11:30–12:15', 7:'13:00–13:45', 8:'13:45–14:30' };

const CELL_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-800 dark:text-blue-300',    border: 'border-blue-200 dark:border-blue-800',    print: '#dbeafe' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', print: '#d1fae5' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-800 dark:text-amber-300',  border: 'border-amber-200 dark:border-amber-800',  print: '#fef3c7' },
  { bg: 'bg-purple-100 dark:bg-purple-900/30',text: 'text-purple-800 dark:text-purple-300',border: 'border-purple-200 dark:border-purple-800',print: '#ede9fe' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30',    text: 'text-rose-800 dark:text-rose-300',    border: 'border-rose-200 dark:border-rose-800',    print: '#ffe4e6' },
  { bg: 'bg-teal-100 dark:bg-teal-900/30',    text: 'text-teal-800 dark:text-teal-300',    border: 'border-teal-200 dark:border-teal-800',    print: '#ccfbf1' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/30',text: 'text-indigo-800 dark:text-indigo-300',border: 'border-indigo-200 dark:border-indigo-800',print: '#e0e7ff' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30',    text: 'text-pink-800 dark:text-pink-300',    border: 'border-pink-200 dark:border-pink-800',    print: '#fce7f3' },
];

function Skel({ className }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl ${className}`} />;
}

export default function StudentTimetable() {
  const { user } = useAuth();

  const [loading, setLoading]         = useState(true);
  const [student, setStudent]         = useState(null);
  const [classInfo, setClassInfo]     = useState(null);
  const [timetable, setTimetable]     = useState([]);
  const [subjects, setSubjects]       = useState([]);
  const [teachers, setTeachers]       = useState([]);
  const [colorMap, setColorMap]       = useState({});
  const [schoolName, setSchoolName]   = useState('School');

  useEffect(() => {
    async function load() {
      try {
        const sn = await db.settings.where('key').equals('schoolName').first();
        if (sn?.value) setSchoolName(sn.value);

        const userRecord = await db.users.get(user.id);
        const studentId  = userRecord?.studentId ?? user?.studentId;
        if (!studentId) { setLoading(false); return; }

        const studentRecord = await db.students.get(studentId);
        if (!studentRecord) { setLoading(false); return; }
        setStudent(studentRecord);

        const allClasses = await db.classes.toArray();
        const myClass = allClasses.find(
          c => Number(c.grade) === Number(studentRecord.grade) && c.parallel === studentRecord.parallel
        ) || null;
        setClassInfo(myClass);

        if (!myClass) { setLoading(false); return; }

        const [tt, subs, tchs] = await Promise.all([
          db.timetable.where('classId').equals(myClass.id).toArray(),
          db.subjects.where('grade').equals(Number(studentRecord.grade)).toArray(),
          db.teachers.toArray(),
        ]);

        setTimetable(tt);
        setSubjects(subs);
        setTeachers(tchs);

        // Assign consistent colour per subject
        const map = {};
        const seen = new Set();
        let idx = 0;
        tt.forEach(t => {
          if (t.subjectId && !seen.has(t.subjectId)) {
            seen.add(t.subjectId);
            map[t.subjectId] = CELL_COLORS[idx % CELL_COLORS.length];
            idx++;
          }
        });
        setColorMap(map);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const getCell      = (day, period) => timetable.find(t => t.day === day && t.period === Number(period));
  const getSubject   = (id) => subjects.find(s => s.id === id);
  const getTeacher   = (id) => teachers.find(t => t.id === id);
  const todayName    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

  const handlePrint = () => {
    if (!classInfo || !student) return;

    // Build colour map for print (print bg colours)
    const printColorMap = {};
    Object.entries(colorMap).forEach(([id, cfg]) => { printColorMap[id] = cfg.print; });

    const headerRow = DAYS.map(d =>
      `<th style="padding:8px 6px;background:#1e293b;color:white;font-size:11px;font-weight:700;text-align:center;border:1px solid #334155;${d === todayName ? 'background:#2563eb;' : ''}">${d}</th>`
    ).join('');

    const bodyRows = PERIODS.map(p => {
      const cells = DAYS.map(d => {
        const cell    = timetable.find(t => t.day === d && t.period === p);
        const sub     = cell ? getSubject(cell.subjectId) : null;
        const teacher = cell && cell.teacherId ? getTeacher(cell.teacherId) : null;
        const bg      = cell ? (printColorMap[cell.subjectId] || '#f8fafc') : '#f8fafc';
        const isToday = d === todayName ? 'border-left:3px solid #2563eb;' : '';
        return cell
          ? `<td style="border:1px solid #e2e8f0;padding:6px;vertical-align:top;${isToday}">
               <div style="background:${bg};border-radius:6px;padding:6px 8px;">
                 <p style="font-size:12px;font-weight:700;color:#1e293b;margin:0 0 2px;">${sub?.name || '—'}</p>
                 ${teacher ? `<p style="font-size:11px;color:#64748b;margin:0;">${teacher.name}</p>` : ''}
                 ${cell.room ? `<p style="font-size:10px;color:#94a3b8;margin:0;">${cell.room}</p>` : ''}
               </div>
             </td>`
          : `<td style="border:1px solid #e2e8f0;padding:6px;background:#fafafa;${isToday}"></td>`;
      }).join('');
      return `<tr>
        <td style="border:1px solid #e2e8f0;padding:6px 10px;background:#f8fafc;text-align:center;white-space:nowrap;">
          <strong style="font-size:12px;color:#1e293b;">P${p}</strong><br/>
          <span style="font-size:10px;color:#64748b;">${PERIOD_TIMES[p]}</span>
        </td>
        ${cells}
      </tr>`;
    }).join('');

    const today = new Date().toLocaleDateString('en-LK', { year:'numeric', month:'long', day:'numeric' });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Timetable — ${student.name}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; color:#1e293b; }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    }
    .page { max-width:960px; margin:0 auto; padding:28px; }
    .header { display:flex; align-items:flex-start; justify-content:space-between; padding-bottom:16px; border-bottom:3px solid #2563eb; margin-bottom:20px; }
    .school { font-size:20px; font-weight:900; color:#1e293b; }
    .sub    { font-size:13px; color:#64748b; margin-top:3px; }
    .badge  { background:#2563eb; color:white; padding:4px 14px; border-radius:999px; font-size:12px; font-weight:700; }
    .info   { display:flex; gap:24px; margin-bottom:20px; flex-wrap:wrap; }
    .info-item { font-size:13px; color:#475569; }
    .info-item strong { color:#1e293b; }
    table   { width:100%; border-collapse:collapse; }
    .footer { margin-top:20px; font-size:11px; color:#94a3b8; text-align:center; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="school">${schoolName}</div>
      <div class="sub">Weekly Class Timetable</div>
    </div>
    <span class="badge">Grade ${classInfo.grade}${classInfo.parallel}</span>
  </div>

  <div class="info">
    <div class="info-item">Student: <strong>${student.name}</strong></div>
    <div class="info-item">Admission No: <strong>${student.admissionNo}</strong></div>
    <div class="info-item">Class: <strong>Grade ${classInfo.grade}${classInfo.parallel} · ${student.section}</strong></div>
    <div class="info-item">Printed: <strong>${today}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="padding:8px 10px;background:#1e293b;color:white;font-size:11px;font-weight:700;text-align:center;border:1px solid #334155;min-width:80px;">Period</th>
        ${headerRow}
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <div class="footer">Printed from ${schoolName} School Portal · ${today} · Today highlighted in blue</div>
</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1000,height=720');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">My Timetable</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Loading…' : classInfo ? `Grade ${classInfo.grade}${classInfo.parallel} · ${student?.section}` : 'No class assigned'}
          </p>
        </div>
        {!loading && timetable.length > 0 && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm self-start"
          >
            <Printer size={16} /> Print Timetable
          </button>
        )}
      </div>

      {/* Today highlight pill */}
      {!loading && DAYS.includes(todayName) && (
        <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-xl px-4 py-2.5 w-fit">
          <Clock size={15} />
          <span>Today is <strong>{todayName}</strong> — highlighted in the timetable</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skel className="h-10 w-full" />
          <Skel className="h-64 w-full" />
        </div>
      ) : !classInfo ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-14 text-center">
          <Clock size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No class assigned yet.</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Your timetable will appear here once a class is assigned to you.</p>
        </div>
      ) : timetable.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-14 text-center">
          <Clock size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Timetable not set up yet.</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Ask your teacher to set up the class timetable.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">
              Grade {classInfo.grade}{classInfo.parallel} — Weekly Schedule
            </h3>
          </div>

          {/* Mobile: day-by-day stacked cards */}
          <div className="block lg:hidden p-4 space-y-4">
            {DAYS.map(day => {
              const isToday = day === todayName;
              const daySlots = PERIODS.map(p => ({ period: p, cell: getCell(day, p) })).filter(s => s.cell);
              return (
                <div key={day} className={`rounded-2xl border overflow-hidden ${isToday ? 'border-blue-400 dark:border-blue-600' : 'border-slate-200 dark:border-slate-700'}`}>
                  <div className={`px-4 py-2 text-sm font-bold ${isToday ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
                    {day} {isToday && '· Today'}
                  </div>
                  {daySlots.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">No classes</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {daySlots.map(({ period, cell }) => {
                        const sub     = getSubject(cell.subjectId);
                        const teacher = cell.teacherId ? getTeacher(cell.teacherId) : null;
                        const colors  = colorMap[cell.subjectId] || CELL_COLORS[0];
                        return (
                          <div key={period} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="text-center shrink-0 w-10">
                              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">P{period}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">{PERIOD_TIMES[period]?.split('–')[0]}</p>
                            </div>
                            <div className={`flex-1 rounded-xl px-3 py-2 border ${colors.bg} ${colors.border}`}>
                              <p className={`text-sm font-semibold ${colors.text}`}>{sub?.name || '—'}</p>
                              {teacher && <p className="text-xs text-slate-500 dark:text-slate-400">{teacher.name}</p>}
                              {cell.room && <p className="text-xs text-slate-400 dark:text-slate-500">{cell.room}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: full grid */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-[90px]">Period</th>
                  {DAYS.map(day => {
                    const isToday = day === todayName;
                    return (
                      <th key={day} className={`border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center text-xs font-semibold min-w-[130px] ${isToday ? 'bg-blue-600 text-white dark:bg-blue-700' : 'text-slate-700 dark:text-slate-200'}`}>
                        {day} {isToday && '✦'}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(period => (
                  <tr key={period} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">P{period}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{PERIOD_TIMES[period]}</p>
                    </td>
                    {DAYS.map(day => {
                      const cell    = getCell(day, period);
                      const sub     = cell ? getSubject(cell.subjectId) : null;
                      const teacher = cell?.teacherId ? getTeacher(cell.teacherId) : null;
                      const colors  = cell ? (colorMap[cell.subjectId] || CELL_COLORS[0]) : null;
                      const isToday = day === todayName;
                      return (
                        <td key={day} className={`border border-slate-200 dark:border-slate-700 p-1.5 ${isToday ? 'border-l-2 border-l-blue-400 dark:border-l-blue-600' : ''}`}>
                          {cell && sub ? (
                            <div className={`rounded-xl px-3 py-2 border h-full ${colors.bg} ${colors.border}`}>
                              <p className={`text-xs font-bold leading-tight ${colors.text}`}>{sub.name}</p>
                              {teacher && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{teacher.name}</p>}
                              {cell.room && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{cell.room}</p>}
                            </div>
                          ) : (
                            <div className="h-14 rounded-xl bg-slate-50 dark:bg-slate-800/30" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Colour legend */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
            {Object.entries(colorMap).map(([subId, colors]) => {
              const sub = getSubject(Number(subId));
              if (!sub) return null;
              return (
                <span key={subId} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border}`}>
                  {sub.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
