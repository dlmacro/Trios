import Dexie from 'dexie';

// Curriculum Database - Courses, Exams, Marks
export const curriculumDB = new Dexie('EduPortalCurriculum');

curriculumDB.version(1).stores({
  courses: '++id, name, code, description, teacherId, grade, level, schedule, room',
  exams: '++id, title, courseId, date, duration, totalMarks, type',
  marks: '++id, examId, studentId, marksObtained, gradedBy, gradedAt'
});

// Helper to get courses
export async function getCourses() {
  return await curriculumDB.courses.toArray();
}

// Helper to get course by ID
export async function getCourseById(id) {
  return await curriculumDB.courses.get(id);
}

// Helper to get courses by grade
export async function getCoursesByGrade(grade) {
  return await curriculumDB.courses.where('grade').equals(String(grade)).toArray();
}

// Helper to get courses by teacher
export async function getCoursesByTeacher(teacherId) {
  return await curriculumDB.courses.where('teacherId').equals(teacherId).toArray();
}

// Helper to add course
export async function addCourse(data) {
  return await curriculumDB.courses.add(data);
}

// Helper to update course
export async function updateCourse(id, data) {
  return await curriculumDB.courses.update(id, data);
}

// Helper to delete course
export async function deleteCourse(id) {
  return await curriculumDB.courses.delete(id);
}

// Helper to get exams
export async function getExams() {
  return await curriculumDB.exams.toArray();
}

// Helper to get exam by ID
export async function getExamById(id) {
  return await curriculumDB.exams.get(id);
}

// Helper to get exams by course
export async function getExamsByCourse(courseId) {
  return await curriculumDB.exams.where('courseId').equals(courseId).toArray();
}

// Helper to add exam
export async function addExam(data) {
  return await curriculumDB.exams.add(data);
}

// Helper to update exam
export async function updateExam(id, data) {
  return await curriculumDB.exams.update(id, data);
}

// Helper to delete exam
export async function deleteExam(id) {
  return await curriculumDB.exams.delete(id);
}

// Helper to get marks
export async function getMarks() {
  return await curriculumDB.marks.toArray();
}

// Helper to get marks by exam
export async function getMarksByExam(examId) {
  return await curriculumDB.marks.where('examId').equals(examId).toArray();
}

// Helper to get marks by student
export async function getMarksByStudent(studentId) {
  return await curriculumDB.marks.where('studentId').equals(studentId).toArray();
}

// Helper to add mark
export async function addMark(data) {
  return await curriculumDB.marks.add(data);
}

// Helper to update mark
export async function updateMark(id, data) {
  return await curriculumDB.marks.update(id, data);
}

// Helper to delete mark
export async function deleteMark(id) {
  return await curriculumDB.marks.delete(id);
}

export default curriculumDB;
