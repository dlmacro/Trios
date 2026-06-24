import { useState, useEffect } from 'react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import { Calendar, Clock, BookOpen, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

/* ── Type colours (dot + card accent) ── */
const TYPE_COLOR = {
  'Term Test':  { dot: '#8B5CF6', light: '#EDE9FE', dark: '#4C1D95', text: '#6D28D9', border: '#C4B5FD' },
  'Assessment': { dot: '#F97316', light: '#FFF7ED', dark: '#7C2D12', text: '#C2410C', border: '#FED7AA' },
  'Practice':   { dot: '#64748B', light: '#F8FAFC', dark: '#1E293B', text: '#475569', border: '#CBD5E1' },
  'Mock Exam':  { dot: '#EC4899', light: '#FDF2F8', dark: '#831843', text: '#BE185D', border: '#FBCFE8' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function typeColor(type) {
  return TYPE_COLOR[type] || TYPE_COLOR['Practice'];
}

/* ── Countdown text ── */
function countdown(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0) return null;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} day${diff > 1 ? 's' : ''}`;
}

/* ── Year Calendar ── */
function YearCalendar({ exams }) {
  const year = new Date().getFullYear();
  const today = new Date().toISOString().split('T')[0];

  // Build a map: dateStr → [exam, ...]
  const dateMap = {};
  exams.forEach(e => {
    if (!e.startDate) return;
    const start = new Date(e.startDate);
    const end   = e.endDate ? new Date(e.endDate) : start;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      if (!dateMap[key]) dateMap[key] = [];
      dateMap[key].push(e);
    }
  });

  const [hoveredDate, setHoveredDate] = useState(null);
  const hoveredExams = hoveredDate ? (dateMap[hoveredDate] || []) : [];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 py-4 text-white">
        <div className="flex items-center gap-2">
          <Calendar size={18} />
          <h2 className="font-bold text-base">Academic Calendar {year}</h2>
        </div>
        <p className="text-white/70 text-xs mt-0.5">Hover a date to see exams</p>
      </div>

      {/* Legend */}
      <div className="px-5 pt-3 pb-1 flex flex-wrap gap-x-4 gap-y-1.5 border-b border-slate-100 dark:border-slate-800">
        {Object.entries(TYPE_COLOR).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, display: 'inline-block', flexShrink: 0 }} />
            <span className="text-xs text-slate-500 dark:text-slate-400">{type}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#3B82F6', display: 'inline-block', flexShrink: 0 }} />
          <span className="text-xs text-slate-500 dark:text-slate-400">Today</span>
        </div>
      </div>

      {/* Months grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, mi) => {
          const firstDay = new Date(year, mi, 1).getDay();
          const daysInMonth = new Date(year, mi + 1, 0).getDate();
          return (
            <div key={mi}>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{MONTH_FULL[mi]}</p>
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 gap-px mb-0.5">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="text-center text-[9px] text-slate-400 dark:text-slate-600 font-semibold">{d}</div>
                ))}
              </div>
              {/* Date cells */}
              <div className="grid grid-cols-7 gap-px">
                {Array.from({ length: firstDay }, (_, i) => (
                  <div key={`e${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, di) => {
                  const day = di + 1;
                  const dateStr = `${year}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayExams = dateMap[dateStr] || [];
                  const isToday = dateStr === today;
                  const isPast = dateStr < today;

                  // Pick dot colour — first exam's type colour
                  const dotColor = dayExams.length > 0 ? typeColor(dayExams[0].type).dot : null;
                  const multiDot = dayExams.length > 1;

                  return (
                    <div
                      key={day}
                      onMouseEnter={() => dayExams.length > 0 && setHoveredDate(dateStr)}
                      onMouseLeave={() => setHoveredDate(null)}
                      style={{
                        position: 'relative',
                        cursor: dayExams.length > 0 ? 'pointer' : 'default',
                      }}
                      title={dayExams.map(e => e.name).join(', ') || undefined}
                    >
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: isToday ? 800 : dayExams.length > 0 ? 700 : 400,
                          background: isToday
                            ? '#3B82F6'
                            : dayExams.length > 0
                              ? typeColor(dayExams[0].type).light
                              : 'transparent',
                          color: isToday
                            ? '#fff'
                            : dayExams.length > 0
                              ? typeColor(dayExams[0].type).text
                              : isPast
                                ? 'var(--sdb-day-past, #94A3B8)'
                                : 'var(--sdb-day-future, #334155)',
                          outline: dayExams.length > 0 && !isToday
                            ? `1.5px solid ${typeColor(dayExams[0].type).border}`
                            : 'none',
                          transition: 'transform 0.1s',
                          transform: hoveredDate === dateStr ? 'scale(1.3)' : 'scale(1)',
                        }}
                      >
                        {day}
                      </div>
                      {/* Multi-exam dot indicator */}
                      {multiDot && (
                        <div style={{
                          position: 'absolute', bottom: 0, right: 0,
                          width: 4, height: 4, borderRadius: '50%',
                          background: typeColor(dayExams[1]?.type).dot,
                          border: '1px solid white',
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hover tooltip */}
      {hoveredExams.length > 0 && (
        <div className="mx-4 mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
            {new Date(hoveredDate + 'T00:00:00').toLocaleDateString('en-LK', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {hoveredExams.map(e => (
            <div key={e.id} className="flex items-center gap-2 py-0.5">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: typeColor(e.type).dot, flexShrink: 0 }} />
              <span className="text-xs text-slate-600 dark:text-slate-300">{e.name}</span>
              <span className="ml-auto text-[10px]" style={{ color: typeColor(e.type).dot }}>{e.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Single exam flowchart card ── */
function ExamCard({ exam, isPast, isFirst }) {
  const tc = typeColor(exam.type);
  const cd = !isPast ? countdown(exam.startDate) : null;
  const daysUntil = (() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(exam.startDate); d.setHours(0,0,0,0);
    return Math.round((d - today) / 86400000);
  })();

  const urgencyBg = !isPast
    ? daysUntil <= 3  ? '#FEF2F2'
    : daysUntil <= 7  ? '#FFFBEB'
    : '#F0FDF4'
    : null;
  const urgencyBorder = !isPast
    ? daysUntil <= 3  ? '#FCA5A5'
    : daysUntil <= 7  ? '#FCD34D'
    : '#86EFAC'
    : null;
  const urgencyText = !isPast
    ? daysUntil <= 3  ? '#DC2626'
    : daysUntil <= 7  ? '#D97706'
    : '#16A34A'
    : null;

  return (
    <div className="flex gap-3 items-start">
      {/* Timeline stem + dot */}
      <div className="flex flex-col items-center shrink-0 mt-1" style={{ width: 28 }}>
        <div
          style={{
            width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
            background: isPast ? '#CBD5E1' : tc.dot,
            border: `3px solid ${isPast ? '#E2E8F0' : tc.border}`,
            boxShadow: isPast ? 'none' : `0 0 0 4px ${tc.light}`,
          }}
        />
      </div>

      {/* Card */}
      <div
        className="flex-1 mb-4 rounded-2xl border overflow-hidden"
        style={{
          borderColor: isPast ? '#E2E8F0' : tc.border,
          background: isPast ? '#F8FAFC' : '#FFFFFF',
          boxShadow: isPast ? 'none' : '0 2px 12px rgba(0,0,0,0.06)',
        }}
      >
        {/* Top accent bar */}
        {!isPast && (
          <div style={{ height: 3, background: `linear-gradient(90deg, ${tc.dot}, ${tc.border})` }} />
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              {/* Type + section badges */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: tc.light, color: tc.text, border: `1px solid ${tc.border}` }}
                >
                  {exam.type}
                </span>
                {exam.section && exam.section !== 'Whole School' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                    {exam.section}
                  </span>
                )}
                {exam.term && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                    Term {exam.term}
                  </span>
                )}
              </div>

              <h3
                className="font-bold leading-snug"
                style={{ color: isPast ? '#64748B' : '#1E293B', fontSize: 14 }}
              >
                {exam.name}
              </h3>

              {exam.description && (
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{exam.description}</p>
              )}
            </div>

            {/* Countdown badge */}
            {!isPast && cd && (
              <div
                className="shrink-0 rounded-xl px-3 py-1.5 text-center"
                style={{ background: urgencyBg, border: `1px solid ${urgencyBorder}` }}
              >
                <p className="text-[10px] font-semibold" style={{ color: urgencyText }}>{cd}</p>
              </div>
            )}

            {/* Past check */}
            {isPast && (
              <CheckCircle2 size={18} className="shrink-0 text-slate-300 mt-0.5" />
            )}
          </div>

          {/* Date row */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t" style={{ borderColor: isPast ? '#F1F5F9' : tc.border + '55' }}>
            <div className="flex items-center gap-1.5">
              <Calendar size={12} style={{ color: isPast ? '#94A3B8' : tc.dot }} />
              <span className="text-xs" style={{ color: isPast ? '#94A3B8' : '#475569' }}>
                {new Date(exam.startDate + 'T00:00:00').toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            {exam.endDate && exam.endDate !== exam.startDate && (
              <>
                <span className="text-xs text-slate-300">→</span>
                <span className="text-xs" style={{ color: isPast ? '#94A3B8' : '#475569' }}>
                  {new Date(exam.endDate + 'T00:00:00').toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </>
            )}
            {exam.academicYear && (
              <span className="ml-auto text-[10px] text-slate-400">{exam.academicYear}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function StudentExams() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [pastExams, setPastExams] = useState([]);
  const [showPast, setShowPast] = useState(false);
  const [allForCalendar, setAllForCalendar] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const userRecord = await db.users.get(user.id);
        const studentId  = userRecord?.studentId ?? user?.studentId;
        if (!studentId) { setLoading(false); return; }

        const student = await db.students.get(studentId);
        if (!student) { setLoading(false); return; }

        const today = new Date().toISOString().split('T')[0];
        const allExams = await db.exams.toArray();

        // Filter exams relevant to this student
        const relevant = allExams.filter(e =>
          (e.section === 'Whole School' || e.section === student.section) &&
          (e.grade == null || e.grade === '' || Number(e.grade) === Number(student.grade))
        );

        setAllForCalendar(relevant);

        const upcoming = relevant
          .filter(e => e.startDate >= today)
          .sort((a, b) => a.startDate > b.startDate ? 1 : -1);

        const past = relevant
          .filter(e => e.startDate < today)
          .sort((a, b) => a.startDate > b.startDate ? -1 : 1); // newest past first

        setUpcomingExams(upcoming);
        setPastExams(past);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  /* Skeleton */
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-72 rounded-3xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="flex gap-3 items-start">
              <div className="w-3.5 h-3.5 mt-1 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
              <div className="flex-1 h-28 rounded-2xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalExams = upcomingExams.length + pastExams.length;

  return (
    <div className="space-y-5">
      {/* Year Calendar */}
      <YearCalendar exams={allForCalendar} />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Upcoming', value: upcomingExams.length, color: '#3B82F6', bg: '#EFF6FF' },
          { label: 'Completed', value: pastExams.length,   color: '#10B981', bg: '#ECFDF5' },
          { label: 'Total',     value: totalExams,          color: '#8B5CF6', bg: '#F5F3FF' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border p-3 text-center" style={{ background: s.bg, borderColor: s.color + '33' }}>
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── UPCOMING FLOWCHART ── */}
      {upcomingExams.length > 0 ? (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Upcoming Exams</h2>
            <span className="text-xs text-slate-400 ml-1">({upcomingExams.length})</span>
          </div>

          {/* Flowchart vertical timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-[13px] top-2"
              style={{
                width: 2,
                bottom: 0,
                background: 'linear-gradient(to bottom, #6366F1, #C7D2FE)',
                borderRadius: 2,
              }}
            />
            <div>
              {upcomingExams.map((exam, i) => (
                <ExamCard key={exam.id} exam={exam} isPast={false} isFirst={i === 0} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <span className="text-4xl">🎉</span>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-3">No upcoming exams!</p>
          <p className="text-xs text-slate-400 mt-1">Enjoy your break.</p>
        </div>
      )}

      {/* ── PAST EXAMS (collapsible) ── */}
      {pastExams.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast(p => !p)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Past Exams <span className="font-normal text-slate-400">({pastExams.length})</span>
              </span>
            </div>
            {showPast ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
          </button>

          {showPast && (
            <div className="relative mt-4">
              {/* Vertical line — greyed out */}
              <div
                className="absolute left-[13px] top-2"
                style={{ width: 2, bottom: 0, background: '#E2E8F0', borderRadius: 2 }}
              />
              <div>
                {pastExams.map((exam, i) => (
                  <ExamCard key={exam.id} exam={exam} isPast={true} isFirst={i === 0} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
