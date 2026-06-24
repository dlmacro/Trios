import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Classes from './pages/Classes';
import ClassDetail from './pages/ClassDetail';
import Subjects from './pages/Subjects';
import Exams from './pages/Exams';
import Marks from './pages/Marks';
import MarksEntry from './pages/MarksEntry';
import Timetable from './pages/Timetable';
import Settings from './pages/Settings';
import MyClass from './pages/MyClass';
import Announcements from './pages/Announcements';
import Events from './pages/Events';
import IDCards from './pages/IDCards';
import About from './pages/About';
import Search from './pages/Search';
import AccessDenied from './pages/AccessDenied';
import MarkAnalyzer from './pages/MarkAnalyzer';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      {/* Protected */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute roles={['admin', 'principal']}><Students /></ProtectedRoute>} />
      <Route path="/teachers" element={<ProtectedRoute roles={['admin', 'principal']}><Teachers /></ProtectedRoute>} />
      <Route path="/classes" element={<ProtectedRoute roles={['admin', 'principal']}><Classes /></ProtectedRoute>} />
      <Route path="/classes/:id" element={<ProtectedRoute roles={['admin', 'principal']}><ClassDetail /></ProtectedRoute>} />
      <Route path="/subjects" element={<ProtectedRoute roles={['admin', 'principal']}><Subjects /></ProtectedRoute>} />
      <Route path="/exams" element={<ProtectedRoute roles={['admin', 'principal', 'teacher', 'student']}><Exams /></ProtectedRoute>} />
      <Route path="/marks" element={<ProtectedRoute roles={['admin', 'principal', 'teacher', 'student']}><Marks /></ProtectedRoute>} />
      <Route path="/marks/entry" element={<ProtectedRoute roles={['admin', 'principal', 'teacher']}><MarksEntry /></ProtectedRoute>} />
      <Route path="/mark-analyzer" element={<ProtectedRoute><MarkAnalyzer /></ProtectedRoute>} />
      <Route path="/timetable" element={<ProtectedRoute roles={['admin', 'principal', 'teacher', 'student']}><Timetable /></ProtectedRoute>} />
      <Route path="/my-class" element={<ProtectedRoute roles={['teacher']}><MyClass /></ProtectedRoute>} />
      <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/id-cards" element={<ProtectedRoute roles={['admin', 'principal']}><IDCards /></ProtectedRoute>} />
      <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />

      {/* Access denied — no layout wrapper, standalone page */}
      <Route path="/403" element={<AccessDenied />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
