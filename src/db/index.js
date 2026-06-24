// Main Database Index - Links all separate databases
import Dexie from 'dexie';

// Main Database - Users, Settings, Notifications, Announcements
export const db = new Dexie('EduPortalDB');

db.version(4).stores({
  users: '++id, email, password, role, firstName, lastName, avatar, createdAt, isActive',
  settings: '++id, key, value',
  notifications: '++id, userId, title, message, type, isRead, createdAt',
  announcements: '++id, title, content, targetRole, createdBy, createdAt'
});

// Re-export all database helpers
export { academicDB, getStudents, getTeachers, getClasses, addStudent, addTeacher, addClass, updateStudent, updateTeacher, updateClass, deleteStudent, deleteTeacher, deleteClass } from './academic';
export { subjectsDB, getSubjects, getSubjectsByLevel, getSubjectsByGrade, getActiveSubjects, addSubject, updateSubject, deleteSubject, getSubjectById } from './subjects';
export { curriculumDB, getCourses, getCourseById, getCoursesByGrade, getCoursesByTeacher, addCourse, updateCourse, deleteCourse, getExams, getExamById, getExamsByCourse, addExam, updateExam, deleteExam, getMarks, getMarksByExam, getMarksByStudent, addMark, updateMark, deleteMark } from './curriculum';
export { resourcesDB, getBuildings, getBuildingById, addBuilding, updateBuilding, deleteBuilding, getResources, getResourceById, getResourcesByCourse, addResource, updateResource, deleteResource, getAttendance, getAttendanceByDate, getAttendanceByStudent, getAttendanceByCourse, addAttendance, updateAttendance, deleteAttendance } from './resources';

// Database linking helper - gets data from multiple databases
export async function getStudentWithDetails(studentId) {
  const { getStudents } = await import('./academic');
  const { getClasses } = await import('./academic');
  
  const students = await getStudents();
  const student = students.find(s => s.id === studentId);
  
  if (!student) return null;
  
  // Get user data from main db
  const user = await db.users.get(student.userId);
  const classInfo = student.classId ? await getClasses().then(classes => classes.find(c => c.id === student.classId)) : null;
  
  return {
    ...student,
    ...user,
    class: classInfo
  };
}

export async function getTeacherWithDetails(teacherId) {
  const { getTeachers } = await import('./academic');
  
  const teachers = await getTeachers();
  const teacher = teachers.find(t => t.id === teacherId);
  
  if (!teacher) return null;
  
  // Get user data from main db
  const user = await db.users.get(teacher.userId);
  
  // Get courses from curriculum db
  const { getCoursesByTeacher } = await import('./curriculum');
  const courses = await getCoursesByTeacher(teacher.userId);
  
  return {
    ...teacher,
    ...user,
    courses
  };
}

export async function getCourseWithDetails(courseId) {
  const { getCourseById } = await import('./curriculum');
  
  const course = await getCourseById(courseId);
  
  if (!course) return null;
  
  // Get teacher details
  const user = course.teacherId ? await db.users.get(course.teacherId) : null;
  
  // Get subject details
  const { getSubjectsByGrade } = await import('./subjects');
  const subjects = await getSubjectsByGrade(course.grade);
  const subject = subjects.find(s => s.name.toLowerCase() === course.name.toLowerCase());
  
  return {
    ...course,
    teacher: user,
    subject
  };
}

export default db;
