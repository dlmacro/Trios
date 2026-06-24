import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, BookOpen, Clock, FileText, BarChart3,
  Users, GraduationCap, Settings, ChevronDown,
  Bell, Search, LogOut, User, Menu, X, Sun, Moon, School,
  Megaphone, CalendarDays, CreditCard, Info, BarChart2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { db } from '../db/database';

const ALL_ROLES = ['admin', 'principal', 'teacher', 'student'];
const ADMIN_ONLY = ['admin', 'principal'];
const STAFF_ROLES = ['admin', 'principal', 'teacher'];

const navSections = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ALL_ROLES },
    ],
  },
  {
    label: 'Academic',
    items: [
      { label: 'Classes',        icon: Building2,  path: '/classes',   roles: ADMIN_ONLY },
      { label: 'Subjects',       icon: BookOpen,   path: '/subjects',  roles: ADMIN_ONLY },
      { label: 'My Class',       icon: School,     path: '/my-class',  roles: ['teacher'] },
      { label: 'Timetable',      icon: Clock,        path: '/timetable',      roles: ALL_ROLES },
      { label: 'Examinations',   icon: FileText,     path: '/exams',          roles: ALL_ROLES },
      { label: 'Results & Marks',icon: BarChart3,    path: '/marks',          roles: ALL_ROLES },
      { label: 'Mark Analyzer', icon: BarChart2,    path: '/mark-analyzer',  roles: ALL_ROLES },
      { label: 'Announcements',  icon: Megaphone,    path: '/announcements',  roles: ALL_ROLES },
      { label: 'Events',         icon: CalendarDays, path: '/events',         roles: ALL_ROLES },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Students', icon: Users,         path: '/students',  roles: ADMIN_ONLY },
      { label: 'Teachers', icon: GraduationCap, path: '/teachers',  roles: ADMIN_ONLY },
      { label: 'ID Cards',  icon: CreditCard,    path: '/id-cards',  roles: ADMIN_ONLY },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Settings', icon: Settings, path: '/settings', roles: ALL_ROLES },
      { label: 'About',    icon: Info,     path: '/about',    roles: ALL_ROLES },
    ],
  },
];

/* Nav item — larger on mobile, compact on desktop */
function SidebarItem({ item, collapsed }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 lg:gap-2
         px-4 py-3 lg:px-2.5 lg:py-1.5
         rounded-xl lg:rounded-lg
         text-sm lg:text-xs font-medium
         transition-colors duration-150
         ${collapsed ? 'lg:justify-center' : ''}
         ${isActive
           ? 'bg-blue-600 text-white'
           : 'text-slate-300 hover:bg-slate-800 hover:text-white'
         }`
      }
      title={collapsed ? item.label : undefined}
    >
      <Icon size={18} className="shrink-0 lg:hidden" />
      <Icon size={15} className="shrink-0 hidden lg:block" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

/* Sidebar content — shared between mobile and desktop */
function SidebarContent({ collapsed, schoolName, handleLogout, userRole, isSupervisor }) {
  return (
    <>
      {/* Navigation */}
      <nav className="flex-1 py-3 lg:py-2 px-3 lg:px-2 flex flex-col gap-0.5">
        {navSections.map(section => {
          const isAdminRole = userRole === 'admin' || userRole === 'principal';
          const visibleItems = section.items.filter(item => {
            if (!item.roles.includes(userRole)) return false;
            // My Class and Results & Marks: admins + supervisors only
            if (item.path === '/my-class' || item.path === '/marks') {
              return isAdminRole || (userRole === 'teacher' && isSupervisor);
            }
            // Mark Analyzer: students, admins, and all teachers (page handles per-role access internally)
            if (item.path === '/mark-analyzer') {
              return userRole === 'student' || isAdminRole || userRole === 'teacher';
            }
            return true;
          });
          if (visibleItems.length === 0) return null;
          return (
          <div key={section.label} className="mb-1 lg:mb-0.5">
            {!collapsed && (
              <p className="text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-4 lg:px-2.5 py-1.5 lg:py-1">
                {section.label}
              </p>
            )}
            {collapsed && <div className="border-t border-slate-800 my-1" />}
            <div className="space-y-0.5">
              {visibleItems.map(item => (
                <SidebarItem key={item.path} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
          );
        })}

        {/* Logout */}
        <div className="mt-auto pt-3 lg:pt-2 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 lg:gap-2 w-full
              px-4 py-3 lg:px-2.5 lg:py-1.5
              rounded-xl lg:rounded-lg
              text-sm lg:text-xs font-medium
              text-slate-300 hover:bg-slate-800 hover:text-red-400
              transition-colors
              ${collapsed ? 'lg:justify-center' : ''}`}
          >
            <LogOut size={18} className="shrink-0 lg:hidden" />
            <LogOut size={15} className="shrink-0 hidden lg:block" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </nav>
    </>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [announcementCount, setAnnouncementCount] = useState(0);
  const [schoolName, setSchoolName] = useState('Sri Dharmasoka National School');
  const [isSupervisor, setIsSupervisor] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    db.announcements.count().then(c => setAnnouncementCount(c)).catch(() => {});
    db.settings.where('key').equals('schoolName').first().then(s => {
      if (s?.value) setSchoolName(s.value);
    }).catch(() => {});
  }, []);

  // Check if logged-in teacher is a class supervisor
  useEffect(() => {
    if (user?.role !== 'teacher') return;
    (async () => {
      try {
        const userRecord = await db.users.get(user.id);
        const teacherId  = userRecord?.teacherId ?? user?.teacherId;
        let teacherRecord = teacherId ? await db.teachers.get(teacherId) : null;
        if (!teacherRecord) {
          const name = userRecord?.name || user?.name;
          if (name) teacherRecord = await db.teachers.where('name').equals(name).first();
        }
        if (!teacherRecord) return;
        const cls = await db.classes.where('classTeacherId').equals(teacherRecord.id).first();
        setIsSupervisor(!!cls);
      } catch { /* keep false */ }
    })();
  }, [user]);

  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const pageTitle = (() => {
    const match = navSections.flatMap(s => s.items).find(i => i.path === location.pathname);
    return match ? match.label : 'Dashboard';
  })();

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">

      {/* ── MOBILE SIDEBAR (fullscreen overlay, completely outside flex flow) ── */}
      {/* Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300
          ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
      />
      {/* Drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-50 flex flex-col bg-slate-900
          transition-transform duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Mobile header row */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
              <img src={`${import.meta.env.BASE_URL}Icon.ico`} alt="TRIOS" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>TRIOS®</p>
              <p className="text-slate-400 text-xs">V 2 . 0 . 0</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X size={22} />
          </button>
        </div>
        <SidebarContent collapsed={false} schoolName={schoolName} handleLogout={handleLogout} userRole={user?.role} isSupervisor={isSupervisor} />
      </div>

      {/* ── DESKTOP SIDEBAR (flex child, width transition) ── */}
      <aside
        className={`hidden lg:flex flex-col bg-slate-900 shrink-0
          transition-[width] duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden
          ${collapsed ? 'w-16' : 'w-56'}`}
      >
        {/* Desktop logo */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b border-slate-800 shrink-0 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
            <img src={`${import.meta.env.BASE_URL}Icon.ico`} alt="TRIOS" className="w-6 h-6 object-contain" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white font-semibold text-xs leading-tight truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>TRIOS®</p>
              <p className="text-slate-400 text-[10px] truncate">V 2 . 0 . 0</p>
            </div>
          )}
        </div>
        <SidebarContent collapsed={collapsed} schoolName={schoolName} handleLogout={handleLogout} userRole={user?.role} isSupervisor={isSupervisor} />
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-4 shrink-0 z-20">
          <button
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => window.innerWidth >= 1024 ? setCollapsed(c => !c) : setMobileOpen(o => !o)}
            title="Toggle sidebar"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1">
            <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">{pageTitle}</h1>
          </div>

          <form
            className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 w-56"
            onSubmit={e => { e.preventDefault(); if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`); }}
          >
            <Search size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none w-full placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </form>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
            <Bell size={18} />
            {announcementCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {announcementCount > 9 ? '9+' : announcementCount}
              </span>
            )}
          </button>

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
              <ChevronDown size={14} className="text-slate-400 dark:text-slate-500 hidden sm:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{user?.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role}</p>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    <User size={15} /> Profile & Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className={`flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 ${location.pathname === '/marks/entry' ? '' : 'p-4 md:p-6'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
