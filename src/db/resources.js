import Dexie from 'dexie';

// Resources Database - Buildings, Resources, Attendance
export const resourcesDB = new Dexie('EduPortalResources');

resourcesDB.version(1).stores({
  buildings: '++id, name, floors, rooms, capacity',
  resources: '++id, title, type, courseId, fileUrl, uploadedBy, uploadedAt',
  attendance: '++id, studentId, date, status, courseId, markedBy'
});

// Helper to get buildings
export async function getBuildings() {
  return await resourcesDB.buildings.toArray();
}

// Helper to get building by ID
export async function getBuildingById(id) {
  return await resourcesDB.buildings.get(id);
}

// Helper to add building
export async function addBuilding(data) {
  return await resourcesDB.buildings.add(data);
}

// Helper to update building
export async function updateBuilding(id, data) {
  return await resourcesDB.buildings.update(id, data);
}

// Helper to delete building
export async function deleteBuilding(id) {
  return await resourcesDB.buildings.delete(id);
}

// Helper to get resources
export async function getResources() {
  return await resourcesDB.resources.toArray();
}

// Helper to get resource by ID
export async function getResourceById(id) {
  return await resourcesDB.resources.get(id);
}

// Helper to get resources by course
export async function getResourcesByCourse(courseId) {
  return await resourcesDB.resources.where('courseId').equals(courseId).toArray();
}

// Helper to add resource
export async function addResource(data) {
  return await resourcesDB.resources.add(data);
}

// Helper to update resource
export async function updateResource(id, data) {
  return await resourcesDB.resources.update(id, data);
}

// Helper to delete resource
export async function deleteResource(id) {
  return await resourcesDB.resources.delete(id);
}

// Helper to get attendance records
export async function getAttendance() {
  return await resourcesDB.attendance.toArray();
}

// Helper to get attendance by date
export async function getAttendanceByDate(date) {
  return await resourcesDB.attendance.where('date').equals(date).toArray();
}

// Helper to get attendance by student
export async function getAttendanceByStudent(studentId) {
  return await resourcesDB.attendance.where('studentId').equals(studentId).toArray();
}

// Helper to get attendance by course
export async function getAttendanceByCourse(courseId) {
  return await resourcesDB.attendance.where('courseId').equals(courseId).toArray();
}

// Helper to add attendance
export async function addAttendance(data) {
  return await resourcesDB.attendance.add(data);
}

// Helper to update attendance
export async function updateAttendance(id, data) {
  return await resourcesDB.attendance.update(id, data);
}

// Helper to delete attendance
export async function deleteAttendance(id) {
  return await resourcesDB.attendance.delete(id);
}

export default resourcesDB;
