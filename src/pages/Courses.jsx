/* eslint-disable no-use-before-define */
import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, X } from 'lucide-react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';

export default function Courses() {
  const { user, hasRole } = useAuth();
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    teacherId: '',
    grade: '',
    schedule: '',
    room: ''
  });

  async function loadData() {
    const allCourses = await db.courses.toArray();
    const allTeachers = await db.teachers.toArray();
    
    const enrichedTeachers = await Promise.all(
      allTeachers.map(async (teacher) => {
        const userData = await db.users.get(teacher.userId);
        return { ...teacher, firstName: userData?.firstName, lastName: userData?.lastName };
      })
    );
    
    const enrichedCourses = await Promise.all(
      allCourses.map(async (course) => {
        const teacher = enrichedTeachers.find(t => t.userId === course.teacherId);
        return { ...course, teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Not Assigned' };
      })
    );

    // Filter courses based on role
    let filteredCourses = enrichedCourses;
    if (user?.role === 'teacher') {
      filteredCourses = enrichedCourses.filter(c => c.teacherId === user.id);
    }

    setCourses(filteredCourses);
    setTeachers(enrichedTeachers);
  }

  useEffect(() => {
    loadData();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingCourse) {
      await db.courses.update(editingCourse.id, formData);
    } else {
      await db.courses.add({
        ...formData,
        teacherId: formData.teacherId || null
      });
    }

    setShowForm(false);
    setEditingCourse(null);
    resetForm();
    loadData();
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      code: course.code,
      description: course.description,
      teacherId: course.teacherId || '',
      grade: course.grade,
      schedule: course.schedule,
      room: course.room
    });
    setShowForm(true);
  };

  const handleDelete = async (course) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      await db.courses.delete(course.id);
      loadData();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      teacherId: '',
      grade: '',
      schedule: '',
      room: ''
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCourse(null);
    resetForm();
  };

  const filteredCourses = courses.filter(course =>
    course.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.teacherName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canEdit = hasRole(['admin', 'teacher']);

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{user?.role === 'teacher' ? 'My Courses' : 'Courses'}</h2>
            <p className="text-slate-500">Manage course offerings</p>
          </div>
          {canEdit && (
            <button
              onClick={() => {
                resetForm();
                setEditingCourse(null);
                setShowForm(true);
              }}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4" />
              Add Course
            </button>
          )}
        </div>

        {/* Inline Form - Shows when showForm is true */}
        {showForm && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                {editingCourse ? 'Edit Course' : 'Add New Course'}
              </h3>
              <button
                onClick={handleCancel}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Course Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Course Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    placeholder="Enter course name"
                    required
                  />
                </div>

                {/* Course Code */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Course Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="input"
                    placeholder="Enter course code"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input resize-none"
                  placeholder="Enter course description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Teacher */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Teacher</label>
                  <select
                    value={formData.teacherId}
                    onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                    className="input"
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.userId}>
                        {teacher.firstName} {teacher.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grade */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Grade</label>
                  <select
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="">Select Grade</option>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Schedule */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Schedule</label>
                  <input
                    type="text"
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    className="input"
                    placeholder="e.g., Mon, Wed - 9:00 AM"
                  />
                </div>

                {/* Room */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Room</label>
                  <input
                    type="text"
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    className="input"
                    placeholder="Enter room number"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-all duration-200"
                >
                  {editingCourse ? 'Update Course' : 'Add Course'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="card p-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* Course Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.length === 0 ? (
            <div className="col-span-full card p-8 text-center">
              <p className="text-slate-500">No courses found</p>
            </div>
          ) : (
            filteredCourses.map((course) => (
              <div key={course.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{course.name}</h3>
                    <p className="text-sm text-slate-500">{course.code}</p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(course)}
                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Edit className="w-4 h-4 text-slate-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(course)}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                  {course.description}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Teacher:</span>
                    <span className="font-medium">{course.teacherName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Grade:</span>
                    <span className="font-medium">{course.grade}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Room:</span>
                    <span className="font-medium">{course.room}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Schedule:</span>
                    <span className="font-medium text-xs">{course.schedule}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
