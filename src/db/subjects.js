import Dexie from 'dexie';

// Subjects Database - School Subjects
export const subjectsDB = new Dexie('EduPortalSubjects');

subjectsDB.version(1).stores({
  subjects: '++id, name, code, level, grade, isActive'
});

// Helper to get all subjects
export async function getSubjects() {
  return await subjectsDB.subjects.toArray();
}

// Helper to get subjects by level
export async function getSubjectsByLevel(level) {
  return await subjectsDB.subjects.where('level').equals(level).toArray();
}

// Helper to get subjects by grade
export async function getSubjectsByGrade(grade) {
  return await subjectsDB.subjects.where('grade').equals(String(grade)).toArray();
}

// Helper to get active subjects
export async function getActiveSubjects() {
  return await subjectsDB.subjects.where('isActive').equals(1).toArray();
}

// Helper to add subject
export async function addSubject(data) {
  return await subjectsDB.subjects.add(data);
}

// Helper to update subject
export async function updateSubject(id, data) {
  return await subjectsDB.subjects.update(id, data);
}

// Helper to delete subject
export async function deleteSubject(id) {
  return await subjectsDB.subjects.delete(id);
}

// Get subject by ID
export async function getSubjectById(id) {
  return await subjectsDB.subjects.get(id);
}

export default subjectsDB;
