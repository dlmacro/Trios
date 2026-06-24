/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import { db } from '../db/database';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('school_portal_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const found = await db.users.where('username').equals(username).first();
      if (!found) throw new Error('Invalid username or password');
      if (found.password !== password) throw new Error('Invalid username or password');

      const userData = {
        id: found.id,
        username: found.username,
        name: found.name,
        email: found.email,
        role: found.role,
        teacherId: found.teacherId || null,
        studentId: found.studentId || null,
      };

      localStorage.setItem('school_portal_user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('school_portal_user');
    setUser(null);
  };

  const hasRole = (roles) => {
    if (!user) return false;
    if (Array.isArray(roles)) return roles.includes(user.role);
    return user.role === roles;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
