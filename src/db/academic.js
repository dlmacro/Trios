import Dexie from 'dexie';

// Academic Database - Students, Teachers, Classes
export const academicDB = new Dexie('EduPortalAcademic');

academicDB.version(1).stores({
  students: '++id, userId, studentId, grade, section, level, enrollmentDate, parentName, parentPhone, classId',
  teachers: '++id, userId, employeeId, department, specialization, hireDate',
  classes: '++id, name, grade, level, parallelClass, teacherId, room, capacity, academicYear'
});

// Helper to get students
export async function getStudents() {
  return await academicDB.students.toArray();
}

// Helper to get teachers
export async function getTeachers() {
  return await academicDB.teachers.toArray();
}

// Helper to get classes
export async function getClasses() {
  return await academicDB.classes.toArray();
}

// Helper to add student
export async function addStudent(data) {
  return await academicDB.students.add(data);
}

// Helper to add teacher
export async function addTeacher(data) {
  return await academicDB.teachers.add(data);
}

// Helper to add class
export async function addClass(data) {
  return await academicDB.classes.add(data);
}

// Helper to update student
export async function updateStudent(id, data) {
  return await academicDB.students.update(id, data);
}

// Helper to update teacher
export async function updateTeacher(id, data) {
  return await academicDB.teachers.update(id, data);
}

// Helper to update class
export async function updateClass(id, data) {
  return await academicDB.classes.update(id, data);
}

// Helper to delete student
export async function deleteStudent(id) {
  return await academicDB.students.delete(id);
}

// Helper to delete teacher
export async function deleteTeacher(id) {
  return await academicDB.teachers.delete(id);
}

// Helper to delete class
export async function deleteClass(id) {
  return await academicDB.classes.delete(id);
}

export default academicDB;
