import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Calendar, BookOpen, TrendingUp,
  ClipboardCheck, Clock, Megaphone, ChevronRight,
  Star, AlertCircle, Users, FileText,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_TIMES = { 1:'7:30',2:'8:15',3:'9:00',4:'9:45',5:'10:45',6:'11:30',7:'13:00',8:'13:45' };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getSLGrade(m) {
  if (m >= 75) return 'A';
  if (m >= 65) return 'B';
  if (m >= 55) return 'C';
  if (m >= 35) return 'S';
  return 'W';
}

const GRADE_COLORS  = { A:'#10B981', B:'#3B82F6', C:'#8B5CF6', S:'#F59E0B', W:'#EF4444' };
const GRADE_BADGE   = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  C: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  S: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  W: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const SECTION_GRADIENT = {
  Primary:   'from-pink-600 to-rose-700',
  Secondary: 'from-blue-600 to-indigo-700',
  Ordinary:  'from-emerald-600 to-teal-700',
  Advanced:  'from-slate-700 to-slate-900',
};

function Sk({ className }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl ${className}`} />;
}

function GradeBadge({ grade }) {
  if (!grade) return null;
  return <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${GRADE_BADGE[grade] || ''}`}>{grade}</span>;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, iconBg, sub, loading }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
        <Icon size={18} className="text-white" />
      </div>
      {loading ? (
        <><Sk className="h-7 w-14 mb-1" /><Sk className="h-3.5 w-20" /></>
      ) : (
        <>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
        </>
      )}
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading]             = useState(true);
  const [student, setStudent]             = useState(null);
  const [classInfo, setClassInfo]         = useState(null);
  const [classTeacher, setClassTeacher]   = useState(null);
  const [enrichedMarks, setEnrichedMarks] = useState([]);
  const [examGroups, setExamGroups]       = useState([]); // [{examName, term, rows[{subjectName,marks,grade}], total, avg}]
  const [gradeDist, setGradeDist]         = useState([]);
  const [subjectAvgs, setSubjectAvgs]     = useState([]);
  const [avgScore, setAvgScore]           = useState(null);
  const [classRank, setClassRank]         = useState(null);
  const [classSize, setClassSize]         = useState(0);
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [pendingFees, setPendingFees]     = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const allUsers   = await db.table('users').toArray();
        const userRecord = allUsers.find(u => u.id === user.id);
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

        if (myClass?.classTeacherId) {
          const ct = await db.teachers.get(Number(myClass.classTeacherId));
          setClassTeacher(ct || null);
        }

        // All data in parallel
        const [allSubjects, rawMarks, allExams, allStudents, allTimetable, allAnnouncements, allFees] = await Promise.all([
          db.subjects.toArray(),
          db.marks.where('studentId').equals(studentRecord.id).toArray(),
          db.exams.toArray(),
          db.students.toArray(),
          myClass ? db.timetable.where('classId').equals(myClass.id).toArray() : Promise.resolve([]),
          db.announcements.toArray(),
          db.fees.where('studentId').equals(studentRecord.id).toArray(),
        ]);

        // Marks enrichment
        const subMap  = new Map(allSubjects.map(s => [s.id, s]));
        const examMap = new Map(allExams.map(e => [e.id, e]));
        const enriched = rawMarks.map(m => ({
          ...m,
          subjectName:   subMap.get(m.subjectId)?.name || '—',
          examName:      examMap.get(m.examId)?.name || '—',
          computedGrade: getSLGrade(Number(m.marks)),
        }));
        setEnrichedMarks(enriched);

        // Grade distribution pie data
        const gd = { A:0, B:0, C:0, S:0, W:0 };
        let sum = 0;
        enriched.forEach(m => { gd[m.computedGrade]++; sum += Number(m.marks) || 0; });
        setGradeDist(['A','B','C','S','W'].filter(g => gd[g] > 0).map(g => ({ name: g, value: gd[g] })));
        setAvgScore(enriched.length > 0 ? (sum / enriched.length).toFixed(1) : null);

        // Subject average bar data — ALL subjects with marks, no cap
        const subTotals = new Map();
        enriched.forEach(m => {
          if (!subTotals.has(m.subjectId)) subTotals.set(m.subjectId, { name: m.subjectName, sum: 0, count: 0 });
          subTotals.get(m.subjectId).sum   += Number(m.marks);
          subTotals.get(m.subjectId).count += 1;
        });
        setSubjectAvgs(
          [...subTotals.values()]
            .map(s => ({ name: s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name, fullName: s.name, avg: Number((s.sum / s.count).toFixed(1)) }))
            .sort((a, b) => b.avg - a.avg)
        );

        // Exam groups — all subjects per exam, sorted by exam name
        const byExam = new Map();
        enriched.forEach(m => {
          if (!byExam.has(m.examId)) byExam.set(m.examId, { examName: m.examName, term: examMap.get(m.examId)?.term, rows: [] });
          byExam.get(m.examId).rows.push({ subjectName: m.subjectName, marks: m.marks, grade: m.computedGrade });
        });
        setExamGroups(
          [...byExam.values()].map(g => {
            const rows  = g.rows.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
            const total = rows.reduce((s, r) => s + Number(r.marks), 0);
            const avg   = rows.length ? (total / rows.length).toFixed(1) : null;
            return { ...g, rows, total, avg };
          }).sort((a, b) => a.examName.localeCompare(b.examName))
        );

        // Class rank
        const classmates = allStudents.filter(
          s => Number(s.grade) === Number(studentRecord.grade) && s.parallel === studentRecord.parallel
        );
        setClassSize(classmates.length);
        if (classmates.length >= 2) {
          const allMks = await db.marks.toArray();
          const peerAvgs = classmates.map(s => {
            const ms = allMks.filter(m => m.studentId === s.id);
            return { id: s.id, avg: ms.length ? ms.reduce((a, m) => a + (m.marks || 0), 0) / ms.length : 0 };
          }).sort((a, b) => b.avg - a.avg);
          const pos = peerAvgs.findIndex(p => p.id === studentRecord.id);
          if (pos >= 0 && peerAvgs[pos].avg > 0) setClassRank(pos + 1);
        }

        // Upcoming exams
        const today = new Date().toISOString().split('T')[0];
        setUpcomingExams(
          allExams.filter(e =>
            e.startDate >= today &&
            (e.section === 'Whole School' || e.section === studentRecord.section) &&
            (e.grade == null || Number(e.grade) === Number(studentRecord.grade))
          ).sort((a, b) => a.startDate > b.startDate ? 1 : -1).slice(0, 5)
        );

        // Today's timetable
        const todayName = DAYS[new Date().getDay()];
        const todaySlots = await Promise.all(
          allTimetable.filter(t => t.day === todayName).sort((a, b) => a.period - b.period)
            .map(async t => {
              const sub     = subMap.get(t.subjectId);
              const teacher = t.teacherId ? await db.teachers.get(t.teacherId) : null;
              return { ...t, subjectName: sub?.name || '—', teacherName: teacher?.name || '', time: PERIOD_TIMES[t.period] || '' };
            })
        );
        setTodaySchedule(todaySlots);

        // Announcements
        setAnnouncements(
          allAnnouncements
            .filter(a => a.audience === 'All' || a.audience === 'Students')
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 4)
        );

        // Pending fees
        setPendingFees(allFees.filter(f => f.status === 'Pending' || f.status === 'Overdue').length);

      } catch (err) {
        console.error('StudentDashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const totalMarks    = enrichedMarks.length;
  const distinctExams = new Set(enrichedMarks.map(m => m.examId)).size;
  const heroGrad      = SECTION_GRADIENT[student?.section] || SECTION_GRADIENT.Secondary;
  const firstName      = (student?.name || user?.name || '').split(' ')[0];
  const overallGrade   = avgScore ? getSLGrade(Number(avgScore)) : null;

  const RANK_LABEL = { 1: '1st', 2: '2nd', 3: '3rd' };

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className={`rounded-2xl bg-gradient-to-br ${heroGrad} p-6 text-white shadow-lg`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-white/70 text-sm">{greeting()}</p>
            <h1 className="text-2xl font-bold mt-0.5">{firstName}</h1>
            {student && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="bg-white/20 border border-white/30 text-xs font-semibold px-2.5 py-1 rounded-full">
                  Grade {student.grade}{student.parallel}
                </span>
                {student.section && (
                  <span className="bg-white/15 border border-white/20 text-xs px-2.5 py-1 rounded-full">{student.section}</span>
                )}
                {student.admissionNo && (
                  <span className="text-white/60 text-xs font-mono">{student.admissionNo}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {avgScore && (
              <div className="bg-white/15 border border-white/25 rounded-xl px-4 py-2.5 text-center min-w-[72px]">
                <p className="text-white/60 text-xs">Avg Score</p>
                <p className="font-black text-xl">{avgScore}</p>
              </div>
            )}
            {classRank && (
              <div className="bg-white/15 border border-white/25 rounded-xl px-4 py-2.5 text-center min-w-[72px]">
                <p className="text-white/60 text-xs">Class Rank</p>
                <p className="font-black text-xl">{RANK_LABEL[classRank] || `#${classRank}`}</p>
              </div>
            )}
            {pendingFees > 0 && (
              <div className="bg-red-500/80 border border-red-400 rounded-xl px-4 py-2.5 text-center min-w-[72px]">
                <p className="text-red-100 text-xs">Pending Fees</p>
                <p className="font-black text-xl">{pendingFees}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Class info strip */}
      {!loading && classInfo && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <GraduationCap size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">My Class</p>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Grade {classInfo.grade}{classInfo.parallel} — {classInfo.section}</p>
            </div>
          </div>
          {classTeacher && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Users size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Class Teacher</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{classTeacher.name}</p>
              </div>
            </div>
          )}
          {classSize > 0 && (
            <div className="ml-auto">
              <span className="text-xs text-slate-400 dark:text-slate-500">{classSize} students</span>
            </div>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Avg Score" value={avgScore ?? '—'} sub={overallGrade ? `Grade ${overallGrade}` : undefined} icon={TrendingUp} iconBg="bg-indigo-500" loading={loading} />
        <StatCard label="Marks Recorded" value={totalMarks} sub={`${distinctExams} exam${distinctExams !== 1 ? 's' : ''}`} icon={ClipboardCheck} iconBg="bg-emerald-500" loading={loading} />
        <StatCard label="Class Rank" value={classRank ? (RANK_LABEL[classRank] || `#${classRank}`) : '—'} sub={classSize > 0 ? `of ${classSize} students` : undefined} icon={Star} iconBg="bg-amber-500" loading={loading} />
        <StatCard label="Upcoming Exams" value={upcomingExams.length} icon={FileText} iconBg="bg-blue-500" loading={loading} />
      </div>

      {/* Charts — grade dist + subject performance */}
      {!loading && totalMarks > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Grade distribution pie */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
              <TrendingUp size={15} className="text-emerald-500" /> Grade Distribution
            </h3>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={gradeDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {gradeDist.map(d => <Cell key={d.name} fill={GRADE_COLORS[d.name] || '#94A3B8'} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Subject average bar — all subjects, height scales with count */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
              <BookOpen size={15} className="text-blue-500" /> Subject Averages
              <span className="ml-auto text-xs text-slate-400 font-normal">{subjectAvgs.length} subject{subjectAvgs.length !== 1 ? 's' : ''}</span>
            </h3>
            {subjectAvgs.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(180, subjectAvgs.length * 28)}>
                <BarChart data={subjectAvgs} layout="vertical" barSize={14}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                  <Bar dataKey="avg" name="Average" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-400 text-center py-10">No marks yet</p>}
          </div>
        </div>
      )}

      {/* Marks tables — all subjects per exam */}
      {!loading && examGroups.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <ClipboardCheck size={15} className="text-emerald-500" /> My Marks — All Subjects
            </h3>
            <Link to="/mark-analyzer" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
              Full Analysis <ChevronRight size={12} />
            </Link>
          </div>
          {examGroups.map(group => (
            <div key={group.examName} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Exam header */}
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                    T{group.term || '—'}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{group.examName}</p>
                    <p className="text-xs text-slate-400">{group.rows.length} subject{group.rows.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-xs text-slate-400">Total</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100">{group.total}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Average</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100">{group.avg}</p>
                  </div>
                  {group.avg && <GradeBadge grade={getSLGrade(Number(group.avg))} />}
                </div>
              </div>
              {/* Subject rows */}
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {group.rows.map((row, idx) => {
                  const pct = Math.round((Number(row.marks) / 100) * 100);
                  const barColor = {
                    A: 'bg-emerald-500', B: 'bg-blue-500', C: 'bg-violet-500',
                    S: 'bg-amber-500',   W: 'bg-red-500',
                  }[row.grade] || 'bg-slate-400';
                  return (
                    <div key={idx} className="flex items-center gap-4 px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="w-5 text-xs text-slate-400 text-right shrink-0">{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{row.subjectName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400 w-6 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 w-8 text-right">{row.marks}</span>
                        <GradeBadge grade={row.grade} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timetable + exams row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Today's timetable */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Clock size={15} className="text-blue-500" /> Today — {DAYS[new Date().getDay()]}
            </h3>
            <Link to="/timetable" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
              Full <ChevronRight size={12} />
            </Link>
          </div>
          <div className="p-4">
            {loading ? [1,2,3].map(i => <Sk key={i} className="h-14 mb-2" />)
              : todaySchedule.length === 0
                ? <div className="py-10 text-center"><Clock size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" /><p className="text-sm text-slate-400">No classes today</p></div>
                : (
                  <div className="space-y-1.5">
                    {todaySchedule.map(slot => (
                      <div key={slot.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex flex-col items-center justify-center shrink-0">
                          <span className="text-xs font-bold leading-none">P{slot.period}</span>
                          {slot.time && <span className="text-[9px] leading-tight opacity-80">{slot.time}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{slot.subjectName}</p>
                          {slot.teacherName && <p className="text-xs text-slate-400 truncate">{slot.teacherName}</p>}
                        </div>
                        {slot.room && <span className="text-xs text-slate-400 shrink-0">{slot.room}</span>}
                      </div>
                    ))}
                  </div>
                )
            }
          </div>
        </div>
      </div>

      {/* Upcoming exams + announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming exams */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Calendar size={15} className="text-amber-500" /> Upcoming Exams
            </h3>
            <Link to="/exams" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">All <ChevronRight size={12} /></Link>
          </div>
          <div className="p-4 space-y-1.5">
            {loading ? [1,2,3].map(i => <Sk key={i} className="h-14 mb-2" />)
              : upcomingExams.length === 0
                ? <div className="py-10 text-center"><Calendar size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" /><p className="text-sm text-slate-400">No upcoming exams</p></div>
                : upcomingExams.map(exam => {
                  const d = exam.startDate ? new Date(exam.startDate) : null;
                  const daysLeft = d ? Math.ceil((d - new Date()) / 86400000) : null;
                  return (
                    <div key={exam.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      {d ? (
                        <div className="bg-amber-500 text-white rounded-xl px-2 py-1.5 text-center shrink-0 min-w-[44px]">
                          <p className="text-xs font-bold leading-none">{d.toLocaleDateString('en',{day:'2-digit'})}</p>
                          <p className="text-[9px] leading-tight">{d.toLocaleDateString('en',{month:'short'})}</p>
                        </div>
                      ) : <div className="w-11 h-11 bg-slate-200 dark:bg-slate-700 rounded-xl shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{exam.name}</p>
                        <p className="text-xs text-slate-400">Term {exam.term} · {exam.section}</p>
                      </div>
                      {daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && (
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400 shrink-0">
                          {daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                        </span>
                      )}
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* Announcements */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Megaphone size={15} className="text-rose-500" /> Announcements
            </h3>
            <Link to="/announcements" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">All <ChevronRight size={12} /></Link>
          </div>
          <div className="p-4">
            {loading ? [1,2,3].map(i => <Sk key={i} className="h-12 mb-2" />)
              : announcements.length === 0
                ? <div className="py-10 text-center"><Megaphone size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" /><p className="text-sm text-slate-400">No announcements</p></div>
                : (
                  <div className="space-y-1.5">
                    {announcements.map(a => {
                      const pColor = { High: 'bg-red-500', Medium: 'bg-amber-400', Low: 'bg-emerald-500' };
                      return (
                        <div key={a.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pColor[a.priority] || 'bg-slate-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{a.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {new Date(a.date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
            }
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Link to="/mark-analyzer" className="group flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl p-4 transition-colors shadow-sm">
          <TrendingUp size={20} className="shrink-0" />
          <div><p className="font-semibold text-sm">Mark Analyzer</p><p className="text-indigo-200 text-xs">My performance</p></div>
        </Link>
        <Link to="/timetable" className="group flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-4 transition-colors shadow-sm">
          <Clock size={20} className="shrink-0" />
          <div><p className="font-semibold text-sm">Timetable</p><p className="text-blue-200 text-xs">Weekly schedule</p></div>
        </Link>
        <Link to="/exams" className="group flex items-center gap-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl p-4 transition-colors shadow-sm">
          <ClipboardCheck size={20} className="shrink-0" />
          <div><p className="font-semibold text-sm">Exams</p><p className="text-amber-100 text-xs">Exam schedule</p></div>
        </Link>
      </div>
    </div>
  );
}
