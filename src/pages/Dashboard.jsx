import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, GraduationCap, Building2, BookOpen, FileText,
  TrendingUp, CalendarDays, Megaphone, ChevronRight,
  ArrowUpRight, CircleAlert, CheckCircle2, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import TeacherDashboard from './TeacherDashboard';
import StudentDashboard from './StudentDashboard';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSLGrade(m) {
  if (m >= 75) return 'A';
  if (m >= 65) return 'B';
  if (m >= 55) return 'C';
  if (m >= 35) return 'S';
  return 'W';
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function Sk({ className }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl ${className}`} />;
}

const SECTION_COLORS = {
  Primary:   '#3B82F6',
  Secondary: '#10B981',
  Ordinary:  '#F59E0B',
  Advanced:  '#8B5CF6',
};

const GRADE_COLORS = {
  A: '#10B981',
  B: '#3B82F6',
  C: '#8B5CF6',
  S: '#F59E0B',
  W: '#EF4444',
};

const EXAM_STATUS_COLORS = {
  Upcoming:  '#3B82F6',
  Ongoing:   '#10B981',
  Completed: '#94A3B8',
};

const GENDER_COLORS = ['#3B82F6', '#EC4899', '#94A3B8'];

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, iconBg, to, loading }) {
  const inner = (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={20} className="text-white" />
        </div>
        {to && <ArrowUpRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />}
      </div>
      {loading ? (
        <><Sk className="h-8 w-16 mb-1.5" /><Sk className="h-3.5 w-24" /></>
      ) : (
        <>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
        </>
      )}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function ChartCard({ title, icon: Icon, iconColor, children, loading, height = 220 }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
      <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
        <Icon size={15} className={iconColor} /> {title}
      </h3>
      {loading ? <Sk className={`w-full`} style={{ height }} /> : children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

function AnnouncementItem({ item }) {
  const colors = {
    High:   'bg-red-500',
    Medium: 'bg-amber-400',
    Low:    'bg-emerald-500',
  };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${colors[item.priority] || 'bg-slate-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.title}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {new Date(item.date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
        </p>
      </div>
    </div>
  );
}

function EventItem({ item }) {
  const d = item.date ? new Date(item.date) : null;
  const catColor = {
    Academic:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Sports:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Cultural:       'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Administrative: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  };
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      {d ? (
        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex flex-col items-center justify-center shrink-0">
          <span className="text-xs font-bold leading-none">{d.toLocaleDateString('en', { day: '2-digit' })}</span>
          <span className="text-[9px] leading-tight">{d.toLocaleDateString('en', { month: 'short' })}</span>
        </div>
      ) : <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.title}</p>
        <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium mt-0.5 inline-block ${catColor[item.category] || catColor.Administrative}`}>
          {item.category}
        </span>
      </div>
    </div>
  );
}

// ── Admin / Principal Dashboard ───────────────────────────────────────────────
function AdminDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats]     = useState({ students: 0, teachers: 0, classes: 0, exams: 0 });
  const [sectionData, setSectionData]       = useState([]);
  const [gradeBarData, setGradeBarData]     = useState([]);
  const [genderData, setGenderData]         = useState([]);
  const [examStatusData, setExamStatusData] = useState([]);
  const [gradeDistData, setGradeDistData]   = useState([]);
  const [announcements, setAnnouncements]   = useState([]);
  const [events, setEvents]                 = useState([]);
  const [schoolName, setSchoolName]         = useState('');
  const [academicYear, setAcademicYear]     = useState('');
  const [term, setTerm]                     = useState('');
  const [feeStats, setFeeStats]             = useState({ Paid: 0, Pending: 0, Overdue: 0 });

  useEffect(() => {
    async function load() {
      try {
        const [students, teachers, classes, exams, fees, marks, announcs, evts] = await Promise.all([
          db.students.toArray(), db.teachers.toArray(), db.classes.toArray(),
          db.exams.toArray(), db.fees.toArray(), db.marks.toArray(),
          db.announcements.toArray(), db.events.toArray(),
        ]);

        setStats({
          students: students.length,
          teachers: teachers.filter(t => t.status === 'Active').length,
          classes:  classes.length,
          exams:    exams.length,
        });

        // Section breakdown for pie
        const sec = { Primary: 0, Secondary: 0, Ordinary: 0, Advanced: 0 };
        students.forEach(s => { if (sec[s.section] !== undefined) sec[s.section]++; });
        setSectionData(Object.entries(sec).filter(([,v]) => v > 0).map(([name, value]) => ({ name, value })));

        // Grade bar (students per grade)
        const gc = {};
        students.forEach(s => { if (s.grade) gc[s.grade] = (gc[s.grade] || 0) + 1; });
        setGradeBarData(
          Array.from({ length: 13 }, (_, i) => i + 1)
            .filter(g => gc[g] > 0)
            .map(g => ({ grade: `G${g}`, count: gc[g] }))
        );

        // Gender pie
        const gn = { Male: 0, Female: 0, Other: 0 };
        students.forEach(s => { const k = ['Male','Female'].includes(s.gender) ? s.gender : 'Other'; gn[k]++; });
        setGenderData(Object.entries(gn).filter(([,v]) => v > 0).map(([name, value]) => ({ name, value })));

        // Exam status pie
        const today = new Date().toISOString().split('T')[0];
        const es = { Upcoming: 0, Ongoing: 0, Completed: 0 };
        exams.forEach(e => {
          if (e.status === 'Completed' || e.endDate < today) es.Completed++;
          else if (e.startDate <= today) es.Ongoing++;
          else es.Upcoming++;
        });
        setExamStatusData(Object.entries(es).filter(([,v]) => v > 0).map(([name, value]) => ({ name, value })));

        // Grade distribution bar
        const gd = { A: 0, B: 0, C: 0, S: 0, W: 0 };
        marks.forEach(m => { const g = getSLGrade(m.marks); gd[g]++; });
        setGradeDistData(['A','B','C','S','W'].map(g => ({ grade: g, count: gd[g] })));

        // Fee stats
        const fs = { Paid: 0, Pending: 0, Overdue: 0 };
        fees.forEach(f => { if (fs[f.status] !== undefined) fs[f.status]++; });
        setFeeStats(fs);

        // Announcements
        setAnnouncements([...announcs].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,4));

        // Upcoming events
        const tdy = new Date().toISOString().split('T')[0];
        setEvents(evts.filter(e => e.date >= tdy).sort((a,b) => a.date > b.date ? 1:-1).slice(0,4));

        // Settings
        const [sn, sy, st] = await Promise.all([
          db.settings.where('key').equals('schoolName').first(),
          db.settings.where('key').equals('academicYear').first(),
          db.settings.where('key').equals('currentTerm').first(),
        ]);
        if (sn) setSchoolName(sn.value);
        if (sy) setAcademicYear(sy.value);
        if (st) setTerm(st.value);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const totalFees = (feeStats.Paid + feeStats.Pending + feeStats.Overdue) || 1;
  const feeData = [
    { name: 'Paid',    value: feeStats.Paid,    color: '#10B981' },
    { name: 'Pending', value: feeStats.Pending,  color: '#F59E0B' },
    { name: 'Overdue', value: feeStats.Overdue,  color: '#EF4444' },
  ].filter(f => f.value > 0);

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-slate-400 text-sm">{greeting()}</p>
            <h1 className="text-2xl font-bold mt-0.5">{user?.name?.split(' ')[0]} <span className="text-slate-400 font-normal">·</span> {user?.role === 'principal' ? 'Principal' : 'Administrator'}</h1>
            {schoolName && <p className="text-slate-400 text-sm mt-1">{schoolName}</p>}
          </div>
          <div className="flex gap-3 flex-wrap">
            {academicYear && (
              <div className="bg-white/10 rounded-xl px-4 py-2.5 text-center min-w-[72px]">
                <p className="text-slate-400 text-xs">Year</p>
                <p className="font-bold">{academicYear}</p>
              </div>
            )}
            {term && (
              <div className="bg-white/10 rounded-xl px-4 py-2.5 text-center min-w-[72px]">
                <p className="text-slate-400 text-xs">Term</p>
                <p className="font-bold">{term}</p>
              </div>
            )}
            <div className="bg-white/10 rounded-xl px-4 py-2.5 text-center min-w-[72px]">
              <p className="text-slate-400 text-xs">Today</p>
              <p className="font-bold text-sm">{new Date().toLocaleDateString('en',{day:'2-digit',month:'short'})}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={stats.students} icon={Users}         iconBg="bg-blue-500"   color="text-blue-600 dark:text-blue-400"   to="/students" loading={loading} />
        <StatCard label="Active Teachers" value={stats.teachers} icon={GraduationCap} iconBg="bg-violet-500" color="text-violet-600 dark:text-violet-400" to="/teachers" loading={loading} />
        <StatCard label="Classes"         value={stats.classes}  icon={Building2}     iconBg="bg-emerald-500" color="text-emerald-600 dark:text-emerald-400" to="/classes" loading={loading} />
        <StatCard label="Exams"           value={stats.exams}    icon={FileText}      iconBg="bg-amber-500"  color="text-amber-600 dark:text-amber-400"   to="/exams" loading={loading} />
      </div>

      {/* Fee quick-view */}
      {!loading && (feeStats.Overdue > 0 || feeStats.Pending > 0) && (
        <div className="flex flex-wrap gap-3">
          {feeStats.Overdue > 0 && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-700 dark:text-red-400 font-medium">
              <CircleAlert size={15} /> {feeStats.Overdue} overdue fee{feeStats.Overdue !== 1 ? 's' : ''}
            </div>
          )}
          {feeStats.Pending > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400 font-medium">
              <Clock size={15} /> {feeStats.Pending} pending fee{feeStats.Pending !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {/* Students by section — pie */}
        <ChartCard title="Students by Section" icon={Users} iconColor="text-blue-500" loading={loading}>
          {sectionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={sectionData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {sectionData.map(e => <Cell key={e.name} fill={SECTION_COLORS[e.name] || '#94A3B8'} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400 text-center py-12">No student data</p>}
        </ChartCard>

        {/* Gender split — pie */}
        <ChartCard title="Gender Distribution" icon={Users} iconColor="text-pink-500" loading={loading}>
          {genderData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {genderData.map((e, i) => <Cell key={e.name} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400 text-center py-12">No data</p>}
        </ChartCard>

        {/* Exam status — pie */}
        <ChartCard title="Exam Status" icon={FileText} iconColor="text-amber-500" loading={loading}>
          {examStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={examStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {examStatusData.map(e => <Cell key={e.name} fill={EXAM_STATUS_COLORS[e.name] || '#94A3B8'} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400 text-center py-12">No exams</p>}
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Students per grade — bar */}
        <ChartCard title="Students per Grade" icon={GraduationCap} iconColor="text-blue-500" loading={loading} height={240}>
          {gradeBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gradeBarData} barSize={20}>
                <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="count" name="Students" fill="#3B82F6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400 text-center py-12">No data</p>}
        </ChartCard>

        {/* Overall grade distribution — bar */}
        <ChartCard title="Mark Grade Distribution" icon={TrendingUp} iconColor="text-emerald-500" loading={loading} height={240}>
          {gradeDistData.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gradeDistData} barSize={36}>
                <XAxis dataKey="grade" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="count" name="Marks" radius={[4,4,0,0]}>
                  {gradeDistData.map(d => <Cell key={d.grade} fill={GRADE_COLORS[d.grade] || '#94A3B8'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400 text-center py-12">No marks recorded</p>}
        </ChartCard>
      </div>

      {/* Fee collection & events/announcements */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Fee collection pie */}
        <ChartCard title="Fee Collection" icon={CheckCircle2} iconColor="text-emerald-500" loading={loading}>
          {feeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={feeData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value">
                  {feeData.map(f => <Cell key={f.name} fill={f.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400 text-center py-12">No fee records</p>}
        </ChartCard>

        {/* Announcements */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Megaphone size={15} className="text-rose-500" /> Announcements
            </h3>
            <Link to="/announcements" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5">
              All <ChevronRight size={12} />
            </Link>
          </div>
          {loading ? [1,2,3].map(i=><Sk key={i} className="h-10 w-full mb-2"/>)
            : announcements.length === 0
              ? <p className="text-sm text-slate-400 py-8 text-center">No announcements</p>
              : announcements.map(a => <AnnouncementItem key={a.id} item={a} />)}
        </div>

        {/* Upcoming events */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CalendarDays size={15} className="text-indigo-500" /> Upcoming Events
            </h3>
            <Link to="/events" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5">
              All <ChevronRight size={12} />
            </Link>
          </div>
          {loading ? [1,2,3].map(i=><Sk key={i} className="h-10 w-full mb-2"/>)
            : events.length === 0
              ? <p className="text-sm text-slate-400 py-8 text-center">No upcoming events</p>
              : events.map(e => <EventItem key={e.id} item={e} />)}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === 'teacher') return <TeacherDashboard />;
  if (user?.role === 'student') return <StudentDashboard />;
  return <AdminDashboard />;
}
