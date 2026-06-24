import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Sun, Moon, Menu, Search, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../db/database';

const pathNames = {
  '/dashboard': 'Dashboard',
  '/students': 'Students',
  '/teachers': 'Teachers',
  '/courses': 'Courses',
  '/exams': 'Exams',
  '/marks': 'Marks',
  '/attendance': 'Attendance',
  '/buildings': 'Buildings',
  '/resources': 'Resources',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
};

export default function Header({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (user?.id) {
        const notifs = await db.notifications
          .where('userId')
          .equals(user.id)
          .reverse()
          .limit(10)
          .toArray();
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.isRead).length);
      }
    };
    fetchNotifications();
  }, [user?.id]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    await db.notifications.update(id, { isRead: true });
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
    setUnreadCount(prev => prev - 1);
  };

  const pageTitle = pathNames[location.pathname] || 'Dashboard';

  return (
    <header className="h-16 bg-surface-light dark:bg-surface-dark border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb */}
        <div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {pageTitle}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden md:flex items-center relative">
          <Search className="w-4 h-4 absolute left-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-2 w-64 rounded-lg bg-slate-100 dark:bg-slate-800 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-slate-400" />
          ) : (
            <Moon className="w-5 h-5 text-slate-500" />
          )}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 relative"
          >
            <Bell className="w-5 h-5 text-slate-500" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="dropdown w-80 right-0">
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="font-medium">Notifications</span>
                <button 
                  onClick={() => setShowNotifications(false)}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-500">No notifications</p>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer ${
                        !notif.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onClick={() => markAsRead(notif.id)}
                    >
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {notif.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
              <Link
                to="/notifications"
                className="block px-4 py-2 text-center text-sm text-primary hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => setShowNotifications(false)}
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <Link to="/settings" className="flex items-center gap-2 ml-2">
          <div className="w-8 h-8 rounded-full bg-primary dark:bg-primary-dark flex items-center justify-center text-white text-sm font-medium">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
        </Link>
      </div>
    </header>
  );
}
