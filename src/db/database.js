import Dexie from 'dexie';

export const db = new Dexie('SchoolPortalDB');

db.version(1).stores({
  users: '++id, username, role, email',
  students: '++id, admissionNo, name, grade, parallel, section, gender, status, academicYear',
  teachers: '++id, employeeId, name, email, gender, status',
  classes: '++id, grade, parallel, section, academicYear, classTeacherId',
  subjects: '++id, code, name, grade, section, teacherId, type',
  attendance: '++id, studentId, classId, date, status',
  exams: '++id, name, type, grade, section, academicYear, term, startDate, endDate',
  marks: '++id, studentId, examId, subjectId, marks, grade',
  timetable: '++id, classId, day, period, subjectId, teacherId, room',
  fees: '++id, studentId, feeType, amount, dueDate, paidDate, status, academicYear, term',
  events: '++id, title, description, date, endDate, category, audience',
  announcements: '++id, title, content, date, priority, audience, authorId',
  library: '++id, title, author, isbn, category, quantity, available, borrowedBy',
  settings: '++id, &key, value',
});

// Version 2: adds subjectTeachers junction table (many teachers per subject)
db.version(2).stores({
  subjectTeachers: '++id, subjectId, teacherId',
});

// Version 3: adds group index to subjects; migrates Art → Aesthetics (5 subjects)
db.version(3).stores({
  subjects: '++id, code, name, grade, section, teacherId, type, group',
}).upgrade(async tx => {
  const artSubjects = await tx.table('subjects').where('name').equals('Art').toArray();
  for (const art of artSubjects) {
    const suffix = art.code.replace('ART', '');
    // Rename existing Art record to keep it as the "Art" sub-subject under Aesthetics
    await tx.table('subjects').update(art.id, {
      code: `AES${suffix}`,
      name: 'Art',
      group: 'Aesthetics',
    });
    // Add the four new Aesthetics sub-subjects
    await tx.table('subjects').bulkAdd([
      { code: `DAN${suffix}`, name: 'Dance',          type: 'Elective', grade: art.grade, section: art.section, group: 'Aesthetics', teacherId: art.teacherId },
      { code: `EMU${suffix}`, name: 'Eastern Music',  type: 'Elective', grade: art.grade, section: art.section, group: 'Aesthetics', teacherId: art.teacherId },
      { code: `WMU${suffix}`, name: 'Western Music',  type: 'Elective', grade: art.grade, section: art.section, group: 'Aesthetics', teacherId: art.teacherId },
      { code: `LIT${suffix}`, name: 'Literature',     type: 'Elective', grade: art.grade, section: art.section, group: 'Aesthetics', teacherId: art.teacherId },
    ]);
  }
});

// Version 5: add classId to subjectTeachers so assignments are per-class, not per-grade
db.version(5).stores({
  subjectTeachers: '++id, subjectId, teacherId, classId',
});

// Version 6: replace Middle section subjects with correct Sri Lanka curriculum (grades 6-9)
db.version(6).stores({}).upgrade(async tx => {
  // Remove all existing Middle subjects
  const middleSubjects = await tx.table('subjects').where('section').equals('Middle').toArray();
  await Promise.all(middleSubjects.map(s => tx.table('subjects').delete(s.id)));

  const newMiddle = [
    // Religion group (students take one based on faith)
    { basecode: 'BUD', name: 'Buddhism',                      type: 'Core', group: 'Religion' },
    { basecode: 'CAT', name: 'Catholicism',                   type: 'Core', group: 'Religion' },
    { basecode: 'CHR', name: 'Christianity',                  type: 'Core', group: 'Religion' },
    { basecode: 'HIN', name: 'Hinduism',                      type: 'Core', group: 'Religion' },
    { basecode: 'ISL', name: 'Islam',                         type: 'Core', group: 'Religion' },
    // Core subjects
    { basecode: 'SIL', name: 'Sinhala Language & Literature', type: 'Core' },
    { basecode: 'TLL', name: 'Tamil Language & Literature',   type: 'Core' },
    { basecode: 'ENG', name: 'English',                       type: 'Core' },
    { basecode: 'MTH', name: 'Mathematics',                   type: 'Core' },
    { basecode: 'SCI', name: 'Science',                       type: 'Core' },
    { basecode: 'HIS', name: 'History',                       type: 'Core' },
    { basecode: 'GEO', name: 'Geography',                     type: 'Core' },
    { basecode: 'CIV', name: 'Civic Education',               type: 'Core' },
    { basecode: 'PTS', name: 'Practical and Technical Skills',type: 'Core' },
    { basecode: 'HPE', name: 'Health and Physical Education', type: 'Core' },
    { basecode: 'TAM', name: 'Tamil',                         type: 'Core' },
    // Aesthetics group
    { basecode: 'DRA', name: 'Drama',                         type: 'Elective', group: 'Aesthetics' },
    { basecode: 'MUS', name: 'Music',                         type: 'Elective', group: 'Aesthetics' },
    { basecode: 'ART', name: 'Art',                           type: 'Elective', group: 'Aesthetics' },
    { basecode: 'DNC', name: 'Dancing',                       type: 'Elective', group: 'Aesthetics' },
  ];

  const toAdd = [];
  for (let g = 6; g <= 9; g++) {
    newMiddle.forEach(s => {
      toAdd.push({
        code: `${s.basecode}${g}`,
        name: s.name,
        type: s.type,
        grade: g,
        section: 'Middle',
        group: s.group || null,
        teacherId: null,
      });
    });
  }
  await tx.table('subjects').bulkAdd(toAdd);
});

// Version 9: replace AL subjects with proper stream-based list (Arts/Commerce/Science/Technology)
db.version(9).stores({}).upgrade(async tx => {
  const alSubs = await tx.table('subjects').where('section').equals('AL').toArray();
  await Promise.all(alSubs.map(s => tx.table('subjects').delete(s.id)));

  const alSubjects = [
    // Arts Stream
    { basecode: 'SIL',  name: 'Sinhala Literature',           stream: 'Arts' },
    { basecode: 'TLL',  name: 'Tamil Literature',             stream: 'Arts' },
    { basecode: 'ELT',  name: 'English Literature',           stream: 'Arts' },
    { basecode: 'AHIS', name: 'History',                      stream: 'Arts' },
    { basecode: 'AGEO', name: 'Geography',                    stream: 'Arts' },
    { basecode: 'POL',  name: 'Political Science',            stream: 'Arts' },
    { basecode: 'LOG',  name: 'Logic and Scientific Method',  stream: 'Arts' },
    { basecode: 'AECO', name: 'Economics',                    stream: 'Arts' },
    { basecode: 'ABUD', name: 'Buddhism',                     stream: 'Arts', group: 'Religion' },
    { basecode: 'AHND', name: 'Hinduism',                     stream: 'Arts', group: 'Religion' },
    { basecode: 'AISL', name: 'Islam',                        stream: 'Arts', group: 'Religion' },
    { basecode: 'ACHR', name: 'Christianity',                 stream: 'Arts', group: 'Religion' },
    { basecode: 'ASA',  name: 'Aesthetic Studies - Art',      stream: 'Arts', group: 'Aesthetics' },
    { basecode: 'ASM',  name: 'Aesthetic Studies - Music',    stream: 'Arts', group: 'Aesthetics' },
    { basecode: 'ASD',  name: 'Aesthetic Studies - Dance',    stream: 'Arts', group: 'Aesthetics' },
    { basecode: 'ASDR', name: 'Aesthetic Studies - Drama',    stream: 'Arts', group: 'Aesthetics' },
    { basecode: 'MDS',  name: 'Media Studies',                stream: 'Arts' },
    { basecode: 'AIT',  name: 'Information Technology',       stream: 'Arts' },
    // Commerce Stream
    { basecode: 'BST',  name: 'Business Studies',             stream: 'Commerce' },
    { basecode: 'ACC',  name: 'Accounting',                   stream: 'Commerce' },
    { basecode: 'CECO', name: 'Economics',                    stream: 'Commerce' },
    { basecode: 'CIT',  name: 'Information Technology',       stream: 'Commerce' },
    { basecode: 'ENT',  name: 'Entrepreneurship Studies',     stream: 'Commerce' },
    // Science Stream
    { basecode: 'PHY',  name: 'Physics',                      stream: 'Science' },
    { basecode: 'CHM',  name: 'Chemistry',                    stream: 'Science' },
    { basecode: 'BIO',  name: 'Biology',                      stream: 'Science' },
    { basecode: 'CMT',  name: 'Combined Mathematics',         stream: 'Science' },
    { basecode: 'AGR',  name: 'Agriculture',                  stream: 'Science' },
    { basecode: 'SIT',  name: 'Information Technology',       stream: 'Science' },
    // Technology Stream
    { basecode: 'SFT',  name: 'Science for Technology',       stream: 'Technology' },
    { basecode: 'EGT',  name: 'Engineering Technology',       stream: 'Technology' },
    { basecode: 'BSY',  name: 'Bio-systems Technology',       stream: 'Technology' },
    { basecode: 'TIT',  name: 'Information & Communication Technology', stream: 'Technology' },
  ];

  const toAdd = [];
  for (let g = 12; g <= 13; g++) {
    alSubjects.forEach(s => {
      toAdd.push({ code: `${s.basecode}${g}`, name: s.name, type: 'Core', grade: g, section: 'AL', stream: s.stream, group: s.group || null, teacherId: null });
    });
  }
  await tx.table('subjects').bulkAdd(toAdd);
});

// Version 10: rename sections — Middle→Secondary, Secondary→Ordinary, AL→Advanced
db.version(10).stores({}).upgrade(async tx => {
  const renameSection = { Middle: 'Secondary', Secondary: 'Ordinary', AL: 'Advanced' };
  for (const table of ['students', 'classes', 'subjects', 'exams']) {
    const records = await tx.table(table).toArray();
    for (const r of records) {
      if (renameSection[r.section]) {
        await tx.table(table).update(r.id, { section: renameSection[r.section] });
      }
    }
  }
});

// Version 12: profile change request queue for teacher/student approval workflow
db.version(12).stores({
  profileChangeRequests: '++id, userId, status, requestedAt',
});

// Version 13: reset all user-entered data — keep only schema + curriculum subjects + settings
// Clears teachers, students, classes, marks, fees, events, announcements, timetable,
// attendance, library, subjectTeachers, profileChangeRequests, and all non-admin users.
db.version(13).stores({}).upgrade(async tx => {
  const tablesToClear = [
    'teachers', 'students', 'classes', 'marks', 'fees',
    'events', 'announcements', 'timetable', 'attendance',
    'library', 'subjectTeachers', 'profileChangeRequests',
  ];
  for (const t of tablesToClear) {
    try { await tx.table(t).clear(); } catch { /* table may not exist */ }
  }

  // Reset users to admin + principal only
  await tx.table('users').clear();
  await tx.table('users').bulkAdd([
    { username: 'admin',     password: 'admin123',     role: 'admin',     name: 'System Administrator', email: 'admin@school.edu.lk' },
    { username: 'principal', password: 'principal123', role: 'principal', name: 'Principal',             email: 'principal@school.edu.lk' },
  ]);

  // Reset settings to clean defaults
  try {
    await tx.table('settings').clear();
    await tx.table('settings').bulkAdd([
      { key: 'schoolName',    value: 'School Name' },
      { key: 'schoolType',    value: 'Government' },
      { key: 'address',       value: '' },
      { key: 'phone',         value: '' },
      { key: 'email',         value: '' },
      { key: 'principalName', value: 'Principal' },
      { key: 'academicYear',  value: String(new Date().getFullYear()) },
      { key: 'currentTerm',   value: '1' },
      { key: 'gradingSystem', value: 'SriLankan' },
    ]);
  } catch { /* settings table issue */ }
});

// Version 11: index teacherId and studentId on users; auto-create accounts for existing teachers/students
db.version(11).stores({
  users: '++id, username, role, email, teacherId, studentId',
}).upgrade(async tx => {
  const teachers = await tx.table('teachers').toArray();
  for (const t of teachers) {
    const username = t.employeeId.toLowerCase();
    const existing = await tx.table('users').where('username').equals(username).first();
    if (!existing) {
      await tx.table('users').add({
        username,
        password: 'teacher@123',
        role: 'teacher',
        name: t.name,
        email: t.email || '',
        teacherId: t.id,
      });
    }
  }
  const students = await tx.table('students').toArray();
  for (const s of students) {
    const username = s.admissionNo.toLowerCase();
    const existing = await tx.table('users').where('username').equals(username).first();
    if (!existing) {
      await tx.table('users').add({
        username,
        password: 'student@123',
        role: 'student',
        name: s.name,
        email: s.parentEmail || '',
        studentId: s.id,
      });
    }
  }
});

// Version 8: replace Secondary subjects with official GCE O/L subject list
db.version(8).stores({}).upgrade(async tx => {
  const secondarySubs = await tx.table('subjects').where('section').equals('Secondary').toArray();
  await Promise.all(secondarySubs.map(s => tx.table('subjects').delete(s.id)));

  const olSubjects = [
    // Religion (students take one)
    { basecode: 'BUD',  name: 'Buddhism',                                    type: 'Core',     group: 'Religion' },
    { basecode: 'SAI',  name: 'Saivanery',                                   type: 'Core',     group: 'Religion' },
    { basecode: 'CAT',  name: 'Catholicism',                                 type: 'Core',     group: 'Religion' },
    { basecode: 'CHR',  name: 'Christianity',                                type: 'Core',     group: 'Religion' },
    { basecode: 'ISL',  name: 'Islam',                                       type: 'Core',     group: 'Religion' },
    // Core compulsory
    { basecode: 'SIL',  name: 'Sinhala Language & Literature',               type: 'Core' },
    { basecode: 'TLL',  name: 'Tamil Language & Literature',                 type: 'Core' },
    { basecode: 'ENG',  name: 'English Language',                            type: 'Core' },
    { basecode: 'MTH',  name: 'Mathematics',                                 type: 'Core' },
    { basecode: 'HIS',  name: 'History',                                     type: 'Core' },
    { basecode: 'SCI',  name: 'Science',                                     type: 'Core' },
    // Category I – Optional
    { basecode: 'BAS',  name: 'Business & Accounting Studies',               type: 'Elective', group: 'Optional' },
    { basecode: 'GEO',  name: 'Geography',                                   type: 'Elective', group: 'Optional' },
    { basecode: 'CIV',  name: 'Civic Education',                             type: 'Elective', group: 'Optional' },
    { basecode: 'ENT',  name: 'Entrepreneurship Studies',                    type: 'Elective', group: 'Optional' },
    { basecode: 'SL2',  name: 'Second Language (Sinhala)',                   type: 'Elective', group: 'Optional' },
    { basecode: 'TL2',  name: 'Second Language (Tamil)',                     type: 'Elective', group: 'Optional' },
    { basecode: 'PAL',  name: 'Pali',                                        type: 'Elective', group: 'Optional' },
    { basecode: 'SAN',  name: 'Sanskrit',                                    type: 'Elective', group: 'Optional' },
    { basecode: 'FRN',  name: 'French',                                      type: 'Elective', group: 'Optional' },
    { basecode: 'GER',  name: 'German',                                      type: 'Elective', group: 'Optional' },
    { basecode: 'HND',  name: 'Hindi',                                       type: 'Elective', group: 'Optional' },
    { basecode: 'JPN',  name: 'Japanese',                                    type: 'Elective', group: 'Optional' },
    { basecode: 'ARB',  name: 'Arabic',                                      type: 'Elective', group: 'Optional' },
    { basecode: 'KOR',  name: 'Korean',                                      type: 'Elective', group: 'Optional' },
    { basecode: 'CHN',  name: 'Chinese',                                     type: 'Elective', group: 'Optional' },
    { basecode: 'RUS',  name: 'Russian',                                     type: 'Elective', group: 'Optional' },
    // Category II – Aesthetics
    { basecode: 'MOR',  name: 'Music (Oriental)',                            type: 'Elective', group: 'Aesthetics' },
    { basecode: 'MWS',  name: 'Music (Western)',                             type: 'Elective', group: 'Aesthetics' },
    { basecode: 'MCR',  name: 'Music (Carnatic)',                            type: 'Elective', group: 'Aesthetics' },
    { basecode: 'ART',  name: 'Art',                                         type: 'Elective', group: 'Aesthetics' },
    { basecode: 'DOR',  name: 'Dancing (Oriental)',                          type: 'Elective', group: 'Aesthetics' },
    { basecode: 'DBH',  name: 'Dancing (Bharata)',                           type: 'Elective', group: 'Aesthetics' },
    { basecode: 'AEL',  name: 'Appreciation of English Literary Texts',      type: 'Elective', group: 'Aesthetics' },
    { basecode: 'ASL',  name: 'Appreciation of Sinhala Literary Texts',      type: 'Elective', group: 'Aesthetics' },
    { basecode: 'ATL',  name: 'Appreciation of Tamil Literary Texts',        type: 'Elective', group: 'Aesthetics' },
    { basecode: 'AAL',  name: 'Appreciation of Arabic Literary Texts',       type: 'Elective', group: 'Aesthetics' },
    { basecode: 'DTS',  name: 'Drama and Theatre (Sinhala)',                 type: 'Elective', group: 'Aesthetics' },
    { basecode: 'DTT',  name: 'Drama and Theatre (Tamil)',                   type: 'Elective', group: 'Aesthetics' },
    { basecode: 'DTE',  name: 'Drama and Theatre (English)',                 type: 'Elective', group: 'Aesthetics' },
    // Category III – Technical
    { basecode: 'ICT',  name: 'Information & Communication Technology',      type: 'Elective', group: 'Technical' },
    { basecode: 'AFT',  name: 'Agriculture & Food Technology',               type: 'Elective', group: 'Technical' },
    { basecode: 'AQB',  name: 'Aquatic Bioresources Technology',             type: 'Elective', group: 'Technical' },
    { basecode: 'ARC',  name: 'Art & Crafts',                                type: 'Elective', group: 'Technical' },
    { basecode: 'HEC',  name: 'Home Economics',                              type: 'Elective', group: 'Technical' },
    { basecode: 'HPE',  name: 'Health & Physical Education',                 type: 'Elective', group: 'Technical' },
    { basecode: 'CMS',  name: 'Communication & Media Studies',               type: 'Elective', group: 'Technical' },
    { basecode: 'DCT',  name: 'Design & Construction Technology',            type: 'Elective', group: 'Technical' },
    { basecode: 'DMT',  name: 'Design & Mechanical Technology',              type: 'Elective', group: 'Technical' },
    { basecode: 'DEE',  name: 'Design, Electrical & Electronic Technology',  type: 'Elective', group: 'Technical' },
    { basecode: 'EWS',  name: 'Electronic Writing & Shorthand (Sinhala)',    type: 'Elective', group: 'Technical' },
    { basecode: 'EWT',  name: 'Electronic Writing & Shorthand (Tamil)',      type: 'Elective', group: 'Technical' },
    { basecode: 'EWE',  name: 'Electronic Writing & Shorthand (English)',    type: 'Elective', group: 'Technical' },
  ];

  const toAdd = [];
  for (let g = 10; g <= 11; g++) {
    olSubjects.forEach(s => {
      toAdd.push({ code: `${s.basecode}${g}`, name: s.name, type: s.type, grade: g, section: 'Secondary', group: s.group || null, teacherId: null });
    });
  }
  await tx.table('subjects').bulkAdd(toAdd);
});

// Version 7: replace Primary subjects with NIE national curriculum (grades 1-5)
// - 4 subject fields: Language, Mathematics, Environment Related Activities, Religion
// - English + 2nd national language added from Grade 3 only
db.version(7).stores({}).upgrade(async tx => {
  // Remove all existing Primary subjects
  const primarySubs = await tx.table('subjects').where('section').equals('Primary').toArray();
  await Promise.all(primarySubs.map(s => tx.table('subjects').delete(s.id)));

  // Subjects taught at ALL primary grades (1-5)
  const allGrades = [
    { basecode: 'BUD', name: 'Buddhism',                     type: 'Core', group: 'Religion' },
    { basecode: 'CAT', name: 'Catholicism',                  type: 'Core', group: 'Religion' },
    { basecode: 'CHR', name: 'Christianity',                 type: 'Core', group: 'Religion' },
    { basecode: 'HIN', name: 'Hinduism',                     type: 'Core', group: 'Religion' },
    { basecode: 'ISL', name: 'Islam',                        type: 'Core', group: 'Religion' },
    { basecode: 'SIN', name: 'Sinhala',                      type: 'Core' },
    { basecode: 'TAM', name: 'Tamil',                        type: 'Core' },
    { basecode: 'MTH', name: 'Mathematics',                  type: 'Core' },
    { basecode: 'ERA', name: 'Environment Related Activities', type: 'Core' },
  ];
  // Subjects added from Grade 3 onwards
  const fromGrade3 = [
    { basecode: 'ENG', name: 'English',                      type: 'Core' },
  ];

  const toAdd = [];
  for (let g = 1; g <= 5; g++) {
    const suffix = `0${g}`;
    allGrades.forEach(s => {
      toAdd.push({ code: `${s.basecode}${suffix}`, name: s.name, type: s.type, grade: g, section: 'Primary', group: s.group || null, teacherId: null });
    });
    if (g >= 3) {
      fromGrade3.forEach(s => {
        toAdd.push({ code: `${s.basecode}${suffix}`, name: s.name, type: s.type, grade: g, section: 'Primary', group: null, teacherId: null });
      });
    }
  }
  await tx.table('subjects').bulkAdd(toAdd);
});

// Version 4: primary subjects — update names, add HPE
db.version(4).stores({}).upgrade(async tx => {
  const allSubjects = await tx.table('subjects').where('section').equals('Primary').toArray();
  for (const s of allSubjects) {
    if (s.name === 'Environmental Science') {
      await tx.table('subjects').update(s.id, { name: 'Environmental Studies' });
    }
    if (s.name === 'Religion') {
      await tx.table('subjects').update(s.id, { name: 'Religion & Moral Education' });
    }
  }
  // Add Health & Physical Education to primary grades 1-5 if not already present
  for (let g = 1; g <= 5; g++) {
    const suffix = `0${g}`;
    const exists = await tx.table('subjects')
      .where('name').equals('Health & Physical Education').and(s => s.grade === g).first();
    if (!exists) {
      await tx.table('subjects').add({
        code: `HPE${suffix}`, name: 'Health & Physical Education',
        type: 'Core', grade: g, section: 'Primary', group: null, teacherId: null,
      });
    }
  }
});

// Version 14: add idCards table for QR credential cards
db.version(14).stores({
  idCards: '++id, personId, personType, username, createdAt',
});

export async function initializeDB() {
  try {
    const userCount = await db.users.count();
    if (userCount > 0) return;

    // Fresh install: seed only admin accounts and default settings.
    // All curriculum subjects are populated via schema migration upgrades (v6–v9).
    await db.users.bulkAdd([
      { username: 'admin',     password: 'admin123',     role: 'admin',     name: 'System Administrator', email: 'admin@school.edu.lk' },
      { username: 'principal', password: 'principal123', role: 'principal', name: 'Principal',             email: 'principal@school.edu.lk' },
    ]);

    await db.settings.bulkAdd([
      { key: 'schoolName',    value: 'School Name' },
      { key: 'schoolType',    value: 'Government' },
      { key: 'address',       value: '' },
      { key: 'phone',         value: '' },
      { key: 'email',         value: '' },
      { key: 'principalName', value: 'Principal' },
      { key: 'academicYear',  value: String(new Date().getFullYear()) },
      { key: 'currentTerm',   value: '1' },
      { key: 'gradingSystem', value: 'SriLankan' },
    ]);

    console.log('Database initialised — admin account ready.');
  } catch (err) {
    console.error('DB initialization error:', err);
  }
}

export default db;
