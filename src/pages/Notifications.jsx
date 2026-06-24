/* eslint-disable no-use-before-define */
import { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';

const NotificationIcon = ({ type }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return <Info className="w-5 h-5 text-blue-500" />;
  }
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');

  async function loadNotifications() {
    if (!user?.id) return;
    
    const allNotifications = await db.notifications
      .where('userId')
      .equals(user.id)
      .reverse()
      .limit(10)
      .toArray();
    
    setNotifications(allNotifications);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifications();
  }, [user?.id]);

  const markAsRead = async (id) => {
    await db.notifications.update(id, { isRead: true });
    loadNotifications();
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.isRead);
    for (const notification of unreadNotifications) {
      await db.notifications.update(notification.id, { isRead: true });
    }
    loadNotifications();
  };

  const deleteNotification = async (id) => {
    await db.notifications.delete(id);
    loadNotifications();
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Notifications</h2>
            <p className="text-slate-500">
              {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="btn btn-secondary"
            >
              <Check className="w-4 h-4" />
              Mark All as Read
            </button>
          )}
        </div>

        {/* Filter */}
        <div className="card p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`btn btn-sm ${filter === 'unread' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`btn btn-sm ${filter === 'read' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Read
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="card">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No notifications found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    !notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                      <NotificationIcon type={notification.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`font-medium ${
                          !notification.isRead ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'
                        }`}>
                          {notification.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-primary rounded-full" />
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{notification.message}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="flex-shrink-0 btn btn-sm btn-outline"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
