import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Building2, BookOpen, Megaphone, CalendarDays, FileText, SearchX } from 'lucide-react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';

const ADMIN_ROLES = ['admin', 'principal'];

function highlight(text = '', query = '') {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-700 text-slate-900 dark:text-white rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function ResultGroup({ icon: Icon, label, color, children }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 ${color}`}>
        <Icon size={15} />
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {children}
      </div>
    </div>
  );
}

function ResultRow({ primary, secondary, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
    >
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{primary}</p>
        {secondary && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{secondary}</p>}
      </div>
      {badge && (
        <span className="ml-3 shrink-0 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs border border-slate-200 dark:border-slate-700">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function Search() {
  const [params] = useSearchParams();
  const query = params.get('q')?.trim() || '';
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role);

  const [results, setResults] = useState({ students: [], teachers: [], classes: [], subjects: [], announcements: [], events: [], exams: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) return;
    setLoading(true);

    const q = query.toLowerCase();

    const searches = [
      isAdmin
        ? db.students.filter(s => s.name?.toLowerCase().includes(q) || s.admissionNo?.toLowerCase().includes(q)).limit(10).toArray()
        : Promise.resolve([]),
      isAdmin
        ? db.teachers.filter(t => t.name?.toLowerCase().includes(q) || t.employeeId?.toLowerCase().includes(q)).limit(10).toArray()
        : Promise.resolve([]),
      isAdmin
        ? db.classes.filter(c => String(c.grade).includes(q) || c.parallel?.toLowerCase().includes(q) || c.section?.toLowerCase().includes(q)).limit(10).toArray()
        : Promise.resolve([]),
      db.subjects.filter(s => s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q)).limit(10).toArray(),
      db.announcements.filter(a => a.title?.toLowerCase().includes(q) || a.content?.toLowerCase().includes(q)).limit(10).toArray(),
      db.events.filter(e => e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q)).limit(10).toArray(),
      db.exams.filter(e => e.name?.toLowerCase().includes(q) || e.type?.toLowerCase().includes(q)).limit(10).toArray(),
    ];

    Promise.all(searches).then(([students, teachers, classes, subjects, announcements, events, exams]) => {
      setResults({ students, teachers, classes, subjects, announcements, events, exams });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [query, isAdmin]);

  const total = Object.values(results).reduce((s, arr) => s + arr.length, 0);

  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600">
        <SearchX size={48} strokeWidth={1.5} />
        <p className="mt-4 text-base font-medium">Type something in the search bar to get started.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          Search results for <span className="text-blue-600 dark:text-blue-400">"{query}"</span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {loading ? 'Searching…' : `${total} result${total !== 1 ? 's' : ''} found`}
        </p>
      </div>

      {!loading && total === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
          <SearchX size={44} strokeWidth={1.5} />
          <p className="mt-4 text-base font-medium">No results found for "{query}"</p>
          <p className="text-sm mt-1">Try different keywords or check the spelling.</p>
        </div>
      )}

      {results.students.length > 0 && (
        <ResultGroup icon={Users} label="Students" color="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
          {results.students.map(s => (
            <ResultRow
              key={s.id}
              primary={highlight(s.name, query)}
              secondary={`Admission No: ${s.admissionNo} · Grade ${s.grade} ${s.parallel || ''}`}
              badge={s.status}
              onClick={() => navigate('/students')}
            />
          ))}
        </ResultGroup>
      )}

      {results.teachers.length > 0 && (
        <ResultGroup icon={GraduationCap} label="Teachers" color="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20">
          {results.teachers.map(t => (
            <ResultRow
              key={t.id}
              primary={highlight(t.name, query)}
              secondary={`Employee ID: ${t.employeeId}${t.email ? ` · ${t.email}` : ''}`}
              badge={t.status}
              onClick={() => navigate('/teachers')}
            />
          ))}
        </ResultGroup>
      )}

      {results.classes.length > 0 && (
        <ResultGroup icon={Building2} label="Classes" color="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20">
          {results.classes.map(c => (
            <ResultRow
              key={c.id}
              primary={`Grade ${c.grade}${c.parallel ? ` – ${c.parallel}` : ''}`}
              secondary={`Section: ${c.section} · Year: ${c.academicYear || '—'}`}
              onClick={() => navigate(`/classes/${c.id}`)}
            />
          ))}
        </ResultGroup>
      )}

      {results.subjects.length > 0 && (
        <ResultGroup icon={BookOpen} label="Subjects" color="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20">
          {results.subjects.map(s => (
            <ResultRow
              key={s.id}
              primary={highlight(s.name, query)}
              secondary={`Code: ${s.code} · Grade ${s.grade} · ${s.section}`}
              badge={s.type}
              onClick={() => navigate('/subjects')}
            />
          ))}
        </ResultGroup>
      )}

      {results.announcements.length > 0 && (
        <ResultGroup icon={Megaphone} label="Announcements" color="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20">
          {results.announcements.map(a => (
            <ResultRow
              key={a.id}
              primary={highlight(a.title, query)}
              secondary={a.content?.slice(0, 80) + (a.content?.length > 80 ? '…' : '')}
              badge={a.priority}
              onClick={() => navigate('/announcements')}
            />
          ))}
        </ResultGroup>
      )}

      {results.events.length > 0 && (
        <ResultGroup icon={CalendarDays} label="Events" color="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20">
          {results.events.map(e => (
            <ResultRow
              key={e.id}
              primary={highlight(e.title, query)}
              secondary={e.date ? `Date: ${e.date}` : e.description?.slice(0, 80)}
              badge={e.category}
              onClick={() => navigate('/events')}
            />
          ))}
        </ResultGroup>
      )}

      {results.exams.length > 0 && (
        <ResultGroup icon={FileText} label="Examinations" color="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20">
          {results.exams.map(e => (
            <ResultRow
              key={e.id}
              primary={highlight(e.name, query)}
              secondary={`Type: ${e.type} · Grade ${e.grade} · Term ${e.term || '—'}`}
              onClick={() => navigate('/exams')}
            />
          ))}
        </ResultGroup>
      )}
    </div>
  );
}
