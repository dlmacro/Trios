import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  ClipboardCheck, Building2, FileText, Bell,
  LogOut, ChevronLeft, ChevronRight, Settings, X,
  Calendar, Library,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const menuItems = {
  admin: [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/students', icon: Users, label: 'Students' },
    { path: '/teachers', icon: GraduationCap, label: 'Teachers' },
    { path: '/classes', icon: Building2, label: 'Classes' },
    { path: '/subjects', icon: BookOpen, label: 'Subjects' },
    { path: '/timetable', icon: Calendar, label: 'Timetable' },
    { path: '/exams', icon: ClipboardCheck, label: 'Exams' },
    { path: '/marks', icon: FileText, label: 'Marks' },
  ],
  principal: [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/students', icon: Users, label: 'Students' },
    { path: '/teachers', icon: GraduationCap, label: 'Teachers' },
    { path: '/classes', icon: Building2, label: 'Classes' },
    { path: '/exams', icon: ClipboardCheck, label: 'Exams' },
    { path: '/marks', icon: FileText, label: 'Marks' },
  ],
  teacher: [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/timetable', icon: Calendar, label: 'Timetable' },
    { path: '/exams', icon: ClipboardCheck, label: 'Exams' },
    { path: '/marks', icon: FileText, label: 'Marks' },
  ],
  student: [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/timetable', icon: Calendar, label: 'Timetable' },
    { path: '/exams', icon: ClipboardCheck, label: 'Exams' },
    { path: '/marks', icon: FileText, label: 'My Marks' },
  ],
};

export default function Sidebar({ collapsed, setCollapsed, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const items = menuItems[user?.role] || menuItems.student;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 transform transition-all duration-300 lg:static lg:translate-x-0 ${collapsed ? 'w-20' : 'w-72'} bg-gradient-to-b from-indigo-700 via-indigo-800 to-slate-900 text-white border-r border-indigo-500/30 shadow-2xl`}
      aria-label="Main navigation"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between p-3 border-b border-white/15">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-base font-bold">TR</div>
            {!collapsed && (
              <div>
                <p className="text-sm font-semibold tracking-wide">TRIOS®</p>
                <p className="text-[11px] text-slate-200/80">Offline School Management</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded-md bg-white/10 hover:bg-white/20"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded-md bg-white/10 hover:bg-white/20"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto p-2 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200 ${
                  isActive ? 'bg-white/20 shadow-md ring-1 ring-white/40' : 'hover:bg-white/10'
                } ${collapsed ? 'justify-center px-1' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 text-white" />
              {!collapsed && <span className="text-sm font-medium text-white">{item.label}</span>}
            </NavLink>
          ))}
        </div>

        <div className="border-t border-white/15 p-3 space-y-2">
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                isActive ? 'bg-white/20' : 'hover:bg-white/10'
              } ${collapsed ? 'justify-center px-1' : ''}`
            }
            title={collapsed ? 'Notifications' : undefined}
          >
            <Bell className="w-4 h-4 text-white" />
            {!collapsed && <span>Notifications</span>}
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                isActive ? 'bg-white/20' : 'hover:bg-white/10'
              } ${collapsed ? 'justify-center px-1' : ''}`
            }
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="w-4 h-4 text-white" />
            {!collapsed && <span>Settings</span>}
          </NavLink>

          <button
            onClick={handleLogout}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-100 transition hover:bg-red-400/20 ${collapsed ? 'justify-center px-1' : ''}`}
            title={collapsed ? 'Logout' : undefined}
          >
            <LogOut className="w-4 h-4 text-red-200" />
            {!collapsed && <span>Logout</span>}
          </button>

          {!collapsed && (
            <div className="mt-2 rounded-xl bg-white/10 p-2 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-200 text-indigo-900 flex items-center justify-center text-sm font-semibold">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div>
                <p className="text-xs font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-[11px] text-slate-200/80 capitalize">{user?.role}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
