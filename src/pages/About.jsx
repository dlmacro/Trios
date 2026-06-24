import {
  Shield, Database, WifiOff, Users, BookOpen, Clock,
  FileText, BarChart3, Megaphone, CalendarDays, CreditCard,
  Building2, GraduationCap,
} from 'lucide-react';

const VERSION = '2.0.0';
const BUILD_YEAR = '2026';

const features = [
  { icon: Users,        label: 'Student Management',     desc: 'Enrol and manage student records, profiles, and academic history.' },
  { icon: GraduationCap,label: 'Teacher Management',    desc: 'Maintain teacher profiles, assignments, and class allocations.' },
  { icon: Building2,    label: 'Class Management',       desc: 'Organise classes by grade, section, and assigned class teacher.' },
  { icon: BookOpen,     label: 'Subject Management',     desc: 'Full Sri Lanka NIE curriculum for Primary, Secondary, O/L, and A/L.' },
  { icon: Clock,        label: 'Timetable',              desc: 'Create and view period-by-period timetables per class and teacher.' },
  { icon: FileText,     label: 'Examinations',           desc: 'Schedule term exams and track exam metadata across academic years.' },
  { icon: BarChart3,    label: 'Results & Marks',        desc: 'Enter, review, and report student marks with Sri Lankan grading.' },
  { icon: Megaphone,    label: 'Announcements',          desc: 'Broadcast school-wide or role-targeted notices instantly.' },
  { icon: CalendarDays, label: 'Events',                 desc: 'Plan and display school events on a shared calendar.' },
  { icon: CreditCard,   label: 'ID Cards',               desc: 'Generate QR-coded digital ID cards for students and teachers.' },
];

const highlights = [
  { icon: WifiOff,   title: '100% Offline',        desc: 'Works without internet. All data is stored locally in the browser using IndexedDB — no server required.' },
  { icon: Database,  title: 'Local-First Storage',  desc: 'Powered by Dexie.js on top of IndexedDB. Your data never leaves your device.' },
  { icon: Shield,    title: 'Role-Based Access',    desc: 'Four access levels — Admin, Principal, Teacher, and Student — each with tailored views and permissions.' },
];

export default function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">

      {/* Hero card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 p-8 flex flex-col sm:flex-row items-center gap-6 shadow-xl">
        <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-lg">
          <img src={`${import.meta.env.BASE_URL}Icon.ico`} alt="TRIOS" className="w-16 h-16 object-contain" />
        </div>
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>TRIOS®</h1>
          <p className="text-slate-300 text-base mt-0.5">Offline School Management System</p>
          <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
            <span className="px-3 py-1 rounded-full bg-blue-600/30 text-blue-300 text-xs font-semibold border border-blue-500/30">
              Version {VERSION}
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600">
              © {BUILD_YEAR} TRIOS®
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">About TRIOS®</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          <strong className="text-slate-800 dark:text-slate-200">TRIOS®</strong> is a comprehensive, fully offline school management system
          designed specifically for Sri Lankan schools. Built as a modern Progressive Web App, it runs entirely in the browser —
          no internet connection, no server, and no subscription required. All data is stored securely on the local device using
          IndexedDB, making it reliable even in low-connectivity environments.
        </p>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mt-3">
          TRIOS® covers the complete school administration workflow — from student enrolment and teacher management to timetabling,
          examinations, results reporting, and QR-coded ID card generation. The system is aligned with the National Institute of
          Education (NIE) Sri Lanka curriculum, supporting Primary, Secondary, GCE O/L, and GCE A/L grade structures with their
          respective subject streams.
        </p>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mt-3">
          With a clean, responsive interface and role-based access for Administrators, Principals, Teachers, and Students,
          TRIOS® brings enterprise-grade school management to every school — regardless of infrastructure.
        </p>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {highlights.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <Icon size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={15} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech stack */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Technology Stack</h2>
        <div className="flex flex-wrap gap-2">
          {['React 19', 'Vite 8', 'Tailwind CSS 4', 'Dexie.js (IndexedDB)', 'React Router 7', 'Lucide Icons', 'React QR Code'].map(t => (
            <span key={t} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-slate-400 dark:text-slate-600">
        TRIOS® v{VERSION} &nbsp;·&nbsp; Offline School Management System &nbsp;·&nbsp; {BUILD_YEAR}
      </p>
    </div>
  );
}
