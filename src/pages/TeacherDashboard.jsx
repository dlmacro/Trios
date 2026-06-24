import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, Building2, ClipboardCheck, Calendar,
  ArrowRight, GraduationCap, FileText, Clock, CheckCircle2,
  ChevronRight, QrCode, User, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import ClassQRModal from '../components/ClassQRModal';

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

const GRADE_COLORS = { A:'#10B981', B:'#3B82F6', C:'#8B5CF6', S:'#F59E0B', W:'#EF4444' };

const SECTION_BADGE = {
  Primary:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Secondary:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Ordinary:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Advanced:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'Whole School': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
};

const STATUS_STYLE = {
  Upcoming:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Ongoing:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Completed: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
};

function Sk({ className }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl ${className}`} />;
}

function SectionBadge({ section }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SECTION_BADGE[section] || 'bg-slate-100 text-slate-600'}`}>
      {section}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, iconBg, loading, sub }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      {loading ? (
        <><Sk className="h-8 w-16 mb-1.5" /><Sk className="h-3.5 w-24" /></>
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

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>}
      {payload.map((p,i) => <p key={i} style={{ color: p.color || p.fill }} className="font-medium">{p.name}: {p.value}</p>)}
    </div>
  );
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [teacher, setTeacher]                     = useState(null);
  const [qrClass, setQrClass]                     = useState(null);
  const [supervisingClass, setSupervisingClass]   = useState(null);
  const [supervisingStudentCount, setSupervisingStudentCount] = useState(0);
  const [teachingClasses, setTeachingClasses]     = useState([]);
  const [upcomingExams, setUpcomingExams]         = useState([]);
  const [todayTimetable, setTodayTimetable]       = useState([]);
  const [recentMarks, setRecentMarks]             = useState([]);
  const [gradeDistData, setGradeDistData]         = useState([]);
  const [classPerfData, setClassPerfData]         = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const allUsers   = await db.table('users').toArray();
        const userRecord = allUsers.find(u => u.id === user.id);
        const teacherId  = userRecord?.teacherId ?? user?.teacherId;

        let teacherRecord = teacherId ? await db.teachers.get(teacherId) : null;
        if (!teacherRecord) {
          const name = userRecord?.name || user?.name;
          if (name) teacherRecord = await db.teachers.where('name').equals(name).first();
        }
        if (!teacherRecord) { setLoading(false); return; }
        setTeacher(teacherRecord);

        const [allClasses, allStudents, allSubjects, allExams] = await Promise.all([
          db.classes.toArray(), db.students.toArray(),
          db.subjects.toArray(), db.exams.toArray(),
        ]);

        // Supervising class
        const supervised = allClasses.find(
          c => c.classTeacherId && Number(c.classTeacherId) === Number(teacherRecord.id)
        ) || null;
        setSupervisingClass(supervised);
        if (supervised) {
          setSupervisingStudentCount(
            allStudents.filter(s => s.grade === supervised.grade && s.parallel === supervised.parallel && s.status === 'Active').length
          );
        }

        // Teaching assignments
        const stRows = await db.subjectTeachers.where('teacherId').equals(teacherRecord.id).toArray();
        const ownedSubjects = allSubjects.filter(s => s.teacherId === teacherRecord.id);

        const classMap = new Map();
        if (stRows.length > 0) {
          for (const row of stRows) {
            const cls  = allClasses.find(c => c.id === row.classId);
            const subj = allSubjects.find(s => s.id === row.subjectId);
            if (!cls || !subj) continue;
            if (!classMap.has(cls.id)) classMap.set(cls.id, { cls, subjects: [] });
            classMap.get(cls.id).subjects.push({ subjectId: subj.id, name: subj.name, code: subj.code });
          }
        } else if (ownedSubjects.length > 0) {
          for (const subj of ownedSubjects) {
            for (const cls of allClasses.filter(c => c.grade === subj.grade)) {
              if (!classMap.has(cls.id)) classMap.set(cls.id, { cls, subjects: [] });
              if (!classMap.get(cls.id).subjects.find(s => s.subjectId === subj.id))
                classMap.get(cls.id).subjects.push({ subjectId: subj.id, name: subj.name, code: subj.code });
            }
          }
        }

        const teachingList = [];
        for (const [classId, { cls, subjects }] of classMap.entries()) {
          const count = allStudents.filter(s => s.grade === cls.grade && s.parallel === cls.parallel && s.status === 'Active').length;
          teachingList.push({ classId, classLabel: `Grade ${cls.grade}${cls.parallel}`, grade: cls.grade, parallel: cls.parallel, section: cls.section, studentCount: count, subjects });
        }
        teachingList.sort((a,b) => a.grade - b.grade || a.parallel.localeCompare(b.parallel));
        setTeachingClasses(teachingList);

        // Upcoming exams
        const today = new Date().toISOString().split('T')[0];
        const mySections = new Set([
          ...(supervised ? [supervised.section] : []),
          ...teachingList.map(t => t.section),
        ]);
        setUpcomingExams(
          allExams.filter(e => e.startDate >= today && (e.section === 'Whole School' || mySections.has(e.section)))
            .sort((a,b) => a.startDate > b.startDate ? 1 : -1).slice(0, 5)
        );

        // Today's timetable
        const todayName = DAYS[new Date().getDay()];
        const ttRows = await db.timetable.where('teacherId').equals(teacherRecord.id).toArray();
        const todayRows = await Promise.all(
          ttRows.filter(r => r.day === todayName).sort((a,b) => a.period - b.period)
            .map(async r => {
              const cls  = allClasses.find(c => c.id === r.classId);
              const subj = allSubjects.find(s => s.id === r.subjectId);
              return { ...r, classLabel: cls ? `Grade ${cls.grade}${cls.parallel}` : '', subjectName: subj?.name || '—', section: cls?.section || '', time: PERIOD_TIMES[r.period] || '' };
            })
        );
        setTodayTimetable(todayRows);

        // Recent marks — grouped by class
        const mySubjectIds = new Set([...stRows.map(r => r.subjectId), ...ownedSubjects.map(s => s.id)]);
        if (mySubjectIds.size > 0) {
          const allMarks = await db.marks.toArray();
          const myMarks  = allMarks.filter(m => mySubjectIds.has(m.subjectId));

          // Grade distribution across all my marks
          const gd = { A:0, B:0, C:0, S:0, W:0 };
          myMarks.forEach(m => { const g = getSLGrade(m.marks); gd[g]++; });
          setGradeDistData(['A','B','C','S','W'].map(g => ({ grade: g, count: gd[g], fill: GRADE_COLORS[g] })));

          // Class performance averages
          const studentMap = new Map(allStudents.map(s => [s.id, s]));
          const classTotals = new Map();
          myMarks.forEach(m => {
            const stu = studentMap.get(m.studentId);
            if (!stu) return;
            const cls = allClasses.find(c => c.grade === Number(stu.grade) && c.parallel === stu.parallel);
            if (!cls) return;
            const key = cls.id;
            if (!classTotals.has(key)) classTotals.set(key, { cls, sum: 0, count: 0 });
            classTotals.get(key).sum += m.marks;
            classTotals.get(key).count++;
          });
          setClassPerfData(
            [...classTotals.values()]
              .map(({ cls, sum, count }) => ({ label: `G${cls.grade}${cls.parallel}`, avg: count ? Number((sum/count).toFixed(1)) : 0 }))
              .sort((a,b) => b.avg - a.avg).slice(0, 8)
          );

          // Recent mark groups
          const examMap = new Map((await db.exams.toArray()).map(e => [e.id, e]));
          const subMap  = new Map(allSubjects.map(s => [s.id, s]));
          const groupMap = new Map();
          myMarks.forEach(m => {
            const stu = studentMap.get(m.studentId);
            if (!stu) return;
            const cls = allClasses.find(c => c.grade === Number(stu.grade) && c.parallel === stu.parallel);
            if (!cls) return;
            const key = `${m.subjectId}|${m.examId}|${cls.id}`;
            if (!groupMap.has(key)) groupMap.set(key, { subjectId: m.subjectId, examId: m.examId, cls, count: 0, maxId: 0 });
            const g = groupMap.get(key);
            g.count++;
            if (m.id > g.maxId) g.maxId = m.id;
          });
          setRecentMarks(
            [...groupMap.values()].sort((a,b) => b.maxId - a.maxId).slice(0, 6).map(g => ({
              key: `${g.subjectId}|${g.examId}|${g.cls.id}`,
              classLabel: `Grade ${g.cls.grade}${g.cls.parallel}`,
              section: g.cls.section,
              subjectName: subMap.get(g.subjectId)?.name || '—',
              examName:    examMap.get(g.examId)?.name  || '—',
              count: g.count,
            }))
          );
        }
      } catch (err) {
        console.error('TeacherDashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const uniqueSubjectCount = new Set(teachingClasses.flatMap(c => c.subjects.map(s => s.subjectId))).size;
  const totalStudents      = teachingClasses.reduce((s, c) => s + c.studentCount, 0);

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-700 to-blue-800 p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-indigo-300 text-sm">{greeting()}</p>
            <h1 className="text-2xl font-bold mt-0.5">
              {loading ? <span className="inline-block h-7 w-40 bg-white/20 rounded animate-pulse" /> : (teacher?.name || user?.name)}
            </h1>
            {!loading && (
              <p className="text-indigo-200 text-sm mt-1">
                {teacher?.employeeId && <span>{teacher.employeeId}</span>}
                {teacher?.qualifications && <span> · {teacher.qualifications}</span>}
              </p>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 self-start sm:self-auto bg-white/15 border border-white/25 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            <GraduationCap size={13} /> Teacher
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Classes I Teach" value={teachingClasses.length} icon={Building2}     iconBg="bg-blue-500"   loading={loading} />
        <StatCard label="My Subjects"     value={uniqueSubjectCount}      icon={BookOpen}      iconBg="bg-violet-500" loading={loading} />
        <StatCard label="Total Students"  value={totalStudents}           icon={Users}         iconBg="bg-emerald-500" loading={loading} />
        <StatCard label="Upcoming Exams"  value={upcomingExams.length}    icon={ClipboardCheck} iconBg="bg-amber-500"  loading={loading} />
      </div>

      {/* Supervising class card */}
      {!loading && supervisingClass && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-800 p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold bg-indigo-600 text-white px-2.5 py-0.5 rounded-full">Class Teacher</span>
              </div>
              <p className="text-3xl font-black text-indigo-700 dark:text-indigo-300 mt-2">
                Grade {supervisingClass.grade}{supervisingClass.parallel}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <SectionBadge section={supervisingClass.section} />
                <span className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <Users size={13} className="text-indigo-400" /> {supervisingStudentCount} active students
                </span>
                {supervisingClass.academicYear && (
                  <span className="text-xs text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">AY {supervisingClass.academicYear}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link to="/my-class" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-2 rounded-xl transition-colors">
                <Users size={14} /> My Class
              </Link>
              <Link to={`/marks/entry?classId=${supervisingClass.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl transition-colors shadow-sm">
                <FileText size={14} /> Enter Marks
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Charts row — grade dist + class performance */}
      {gradeDistData.some(d => d.count > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Grade distribution */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
              <TrendingUp size={15} className="text-emerald-500" /> My Marks — Grade Distribution
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={gradeDistData} barSize={36}>
                <XAxis dataKey="grade" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="count" name="Marks" radius={[4,4,0,0]}>
                  {gradeDistData.map(d => <Cell key={d.grade} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Class average performance */}
          {classPerfData.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                <Building2 size={15} className="text-blue-500" /> Class Average Marks
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={classPerfData} barSize={24} layout="vertical">
                  <XAxis type="number" domain={[0,100]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                  <Bar dataKey="avg" name="Avg" fill="#3B82F6" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Teaching classes grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Building2 size={15} className="text-blue-500" /> My Teaching Classes
          </h3>
        </div>
        {loading ? (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <Sk key={i} className="h-28" />)}
          </div>
        ) : teachingClasses.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">No teaching assignments found.</p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teachingClasses.map(tc => (
              <div key={tc.classId} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100">{tc.classLabel}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <SectionBadge section={tc.section} />
                      <span className="text-xs text-slate-500 dark:text-slate-400"><Users size={10} className="inline mr-0.5" />{tc.studentCount}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setQrClass({ classId: tc.classId, classLabel: tc.classLabel, section: tc.section })}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
                    ><QrCode size={13} /></button>
                    <Link
                      to={`/marks/entry?classId=${tc.classId}`}
                      className="text-xs font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2.5 py-1.5 rounded-lg transition-colors"
                    >Enter Marks</Link>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {tc.subjects.slice(0,5).map(s => (
                    <span key={s.subjectId} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">{s.code || s.name.slice(0,4)}</span>
                  ))}
                  {tc.subjects.length > 5 && <span className="text-xs text-slate-400 px-1 py-0.5">+{tc.subjects.length - 5}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom panels — timetable / exams / recent marks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's timetable */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Clock size={15} className="text-blue-500" /> Today — {DAYS[new Date().getDay()]}
            </h3>
            <Link to="/timetable" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">Full <ChevronRight size={12} /></Link>
          </div>
          <div className="p-4 space-y-2">
            {loading ? [1,2,3].map(i => <Sk key={i} className="h-14" />)
              : todayTimetable.length === 0
                ? <div className="py-10 text-center"><Clock size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" /><p className="text-sm text-slate-400">No classes today</p></div>
                : todayTimetable.map(row => (
                  <div key={row.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="w-9 h-9 bg-blue-500 text-white rounded-lg flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs font-bold leading-none">P{row.period}</span>
                      {row.time && <span className="text-[9px] leading-tight opacity-80">{row.time}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{row.subjectName}</p>
                      <p className="text-xs text-slate-400">{row.classLabel}{row.room && ` · ${row.room}`}</p>
                    </div>
                    <SectionBadge section={row.section} />
                  </div>
                ))
            }
          </div>
        </div>

        {/* Upcoming exams */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Calendar size={15} className="text-amber-500" /> Upcoming Exams
            </h3>
            <Link to="/exams" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">All <ChevronRight size={12} /></Link>
          </div>
          <div className="p-4 space-y-2">
            {loading ? [1,2,3].map(i => <Sk key={i} className="h-14" />)
              : upcomingExams.length === 0
                ? <div className="py-10 text-center"><ClipboardCheck size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" /><p className="text-sm text-slate-400">No upcoming exams</p></div>
                : upcomingExams.map(exam => {
                  const d = exam.startDate ? new Date(exam.startDate) : null;
                  return (
                    <div key={exam.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      {d ? (
                        <div className="bg-amber-500 text-white rounded-lg px-2 py-1.5 text-center shrink-0 min-w-[40px]">
                          <p className="text-xs font-bold leading-none">{d.toLocaleDateString('en',{day:'2-digit'})}</p>
                          <p className="text-[9px] leading-tight">{d.toLocaleDateString('en',{month:'short'})}</p>
                        </div>
                      ) : <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{exam.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <SectionBadge section={exam.section} />
                          <span className="text-xs text-slate-400">Term {exam.term}</span>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[exam.status] || ''}`}>{exam.status}</span>
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* Recent marks */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-500" /> Recent Marks
            </h3>
            {supervisingClass && (
              <Link to="/marks" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">All <ChevronRight size={12} /></Link>
            )}
          </div>
          <div className="p-4 space-y-2">
            {loading ? [1,2,3].map(i => <Sk key={i} className="h-14" />)
              : recentMarks.length === 0
                ? <div className="py-10 text-center"><FileText size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" /><p className="text-sm text-slate-400">No marks entered yet</p></div>
                : recentMarks.map(g => (
                  <div key={g.key} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{g.classLabel}</p>
                      <p className="text-xs text-slate-400 truncate">{g.subjectName} · {g.examName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{g.count}</p>
                      <p className="text-[10px] text-slate-400">students</p>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/settings" className="group flex items-center justify-between gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-5 transition-colors shadow-sm">
          <div><p className="font-semibold">View Profile</p><p className="text-blue-200 text-sm mt-0.5">Your account & settings</p></div>
          <div className="flex items-center gap-2"><User size={22} /><ArrowRight size={16} className="opacity-70 group-hover:translate-x-1 transition-transform" /></div>
        </Link>
        <Link to="/timetable" className="group flex items-center justify-between gap-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl p-5 transition-colors shadow-sm">
          <div><p className="font-semibold">My Timetable</p><p className="text-indigo-200 text-sm mt-0.5">View weekly schedule</p></div>
          <div className="flex items-center gap-2"><Calendar size={22} /><ArrowRight size={16} className="opacity-70 group-hover:translate-x-1 transition-transform" /></div>
        </Link>
        <Link to="/exams" className="group flex items-center justify-between gap-3 bg-slate-700 hover:bg-slate-800 text-white rounded-2xl p-5 transition-colors shadow-sm">
          <div><p className="font-semibold">Exams</p><p className="text-slate-300 text-sm mt-0.5">Browse exam schedule</p></div>
          <div className="flex items-center gap-2"><GraduationCap size={22} /><ArrowRight size={16} className="opacity-70 group-hover:translate-x-1 transition-transform" /></div>
        </Link>
      </div>

      {qrClass && (
        <ClassQRModal isOpen={!!qrClass} onClose={() => setQrClass(null)}
          classId={qrClass.classId} classLabel={qrClass.classLabel} section={qrClass.section} />
      )}
    </div>
  );
}
