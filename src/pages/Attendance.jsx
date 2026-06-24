/* eslint-disable no-use-before-define */
import { useState, useEffect } from 'react';
import { Search, Calendar, Check, X, Users } from 'lucide-react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';

export default function Attendance() {
  const { user, hasRole } = useAuth();
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  async function loadData() {
    // Load students
    const allStudents = await db.students.toArray();
    const enrichedStudents = await Promise.all(
      allStudents.map(async (student) => {
        const userData = await db.users.get(student.userId);
        return { ...student, firstName: userData?.firstName, lastName: userData?.lastName };
      })
    );
    setStudents(enrichedStudents);

    // Load courses
    const allCourses = await db.courses.toArray();
    let filteredCourses = allCourses;
    if (user?.role === 'teacher') {
      filteredCourses = allCourses.filter(c => c.teacherId === user.id);
    }
    setCourses(filteredCourses);

    // Load attendance for selected date
    const attendanceRecords = await db.attendance
      .where('date')
      .equals(selectedDate)
      .toArray();
    setAttendance(attendanceRecords);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [user, selectedDate, selectedCourse]);

  const markAttendance = async (studentId, status) => {
    const existingRecord = attendance.find(
      a => a.studentId === studentId && a.courseId === parseInt(selectedCourse || '0')
    );

    if (existingRecord) {
      await db.attendance.update(existingRecord.id, { status });
    } else {
      await db.attendance.add({
        studentId,
        date: selectedDate,
        status,
        courseId: selectedCourse ? parseInt(selectedCourse) : null,
        markedBy: user?.id
      });
    }

    // Reload attendance
    const attendanceRecords = await db.attendance
      .where('date')
      .equals(selectedDate)
      .toArray();
    setAttendance(attendanceRecords);
  };

  const getAttendanceStatus = (studentId) => {
    const record = attendance.find(
      a => a.studentId === studentId && 
      (selectedCourse === '' || a.courseId === parseInt(selectedCourse))
    );
    return record?.status || 'none';
  };

  const filteredStudents = students.filter(student =>
    student.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canEdit = hasRole(['admin', 'teacher']);

  // Calculate stats
  const presentCount = attendance.filter(a => a.status === 'present').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Attendance</h2>
            <p className="text-slate-500">Track student attendance</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input"
              />
            </div>
            {canEdit && (
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="input md:w-64"
              >
                <option value="">All Courses</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            )}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        {canEdit && (
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-value text-green-600">{presentCount}</p>
                  <p className="stat-label">Present</p>
                </div>
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-value text-red-600">{absentCount}</p>
                  <p className="stat-label">Absent</p>
                </div>
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                  <X className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-value text-amber-600">{lateCount}</p>
                  <p className="stat-label">Late</p>
                </div>
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Attendance List */}
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Grade</th>
                  {canEdit && <th>Status</th>}
                  {!canEdit && <th>My Status</th>}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 4 : 3} className="text-center py-8 text-slate-500">
                      No students found
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => {
                    const status = getAttendanceStatus(student.id);
                    return (
                      <tr key={student.id}>
                        <td className="font-medium">{student.studentId}</td>
                        <td>{student.firstName} {student.lastName}</td>
                        <td>{student.grade}-{student.section}</td>
                        <td>
                          {canEdit ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => markAttendance(student.id, 'present')}
                                className={`p-2 rounded-lg ${
                                  status === 'present' 
                                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30' 
                                    : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-slate-400'
                                }`}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => markAttendance(student.id, 'late')}
                                className={`p-2 rounded-lg ${
                                  status === 'late' 
                                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' 
                                    : 'hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-400'
                                }`}
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => markAttendance(student.id, 'absent')}
                                className={`p-2 rounded-lg ${
                                  status === 'absent' 
                                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30' 
                                    : 'hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400'
                                }`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className={`badge ${
                              status === 'present' ? 'badge-success' :
                              status === 'absent' ? 'badge-danger' :
                              status === 'late' ? 'badge-warning' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {status === 'present' ? 'Present' :
                               status === 'absent' ? 'Absent' :
                               status === 'late' ? 'Late' : 'Not Marked'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Clock({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
