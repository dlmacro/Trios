import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, UserPlus, UserCheck, UserX,
  Edit, Eye, X, Clock, BookOpen,
  Save, Plus, Trash2, Globe, QrCode,
  FileSpreadsheet, Upload, Download, AlertCircle, CheckCircle, AlertTriangle,
  ChevronRight as StepArrow,
} from 'lucide-react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import ClassQRModal from '../components/ClassQRModal';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIOD_TIMES = { 1: '7:30', 2: '8:15', 3: '9:00', 4: '9:45', 5: '10:45', 6: '11:30', 7: '13:00', 8: '13:45' };
const STATUSES = ['Active', 'Inactive', 'Transferred'];
const SUBJECT_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
];
const SECTION_GRADIENT = {
  Primary:   'from-blue-600 to-blue-700',
  Secondary: 'from-emerald-600 to-emerald-700',
  Ordinary:  'from-amber-600 to-amber-700',
  Advanced:  'from-purple-600 to-purple-700',
};
const AL_STREAMS = ['Arts', 'Commerce', 'Science', 'Technology'];
const AL_STREAM_STYLE = {
  Arts:       { label: 'text-pink-600 dark:text-pink-400',      header: 'bg-pink-50/60 dark:bg-pink-900/10',      dot: 'bg-pink-500' },
  Commerce:   { label: 'text-amber-600 dark:text-amber-400',    header: 'bg-amber-50/60 dark:bg-amber-900/10',    dot: 'bg-amber-500' },
  Science:    { label: 'text-emerald-600 dark:text-emerald-400',header: 'bg-emerald-50/60 dark:bg-emerald-900/10',dot: 'bg-emerald-500' },
  Technology: { label: 'text-blue-600 dark:text-blue-400',      header: 'bg-blue-50/60 dark:bg-blue-900/10',     dot: 'bg-blue-500' },
};
const MEDIUM_COLORS = {
  Sinhala: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  English: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Tamil:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

// ── Excel import helpers ──────────────────────────────────────────────────────

const XL_COLS = [
  'admissionNo', 'name', 'gender', 'dob', 'religion',
  'medium', 'status', 'academicYear', 'address',
  'parentName', 'parentPhone', 'parentEmail',
];

const XL_HEADERS = [
  'Admission No (leave blank to auto-generate)',
  'Full Name *',
  'Gender (Male / Female)',
  'Date of Birth (YYYY-MM-DD)',
  'Religion (Buddhism / Hinduism / Islam / Christianity / Other)',
  'Medium (Sinhala / English / Tamil)',
  'Status (Active / Inactive / Transferred)',
  'Academic Year',
  'Address',
  'Parent / Guardian Name',
  'Parent Phone',
  'Parent Email',
];

function downloadClassStudentTemplate(grade, parallel) {
  const metaRow    = ['Grade', String(grade), 'Parallel', String(parallel)];
  const blankRow   = [];
  const headersRow = XL_HEADERS;
  const sampleRow  = [
    '', 'Nimal Perera', 'Male', '2010-05-15', 'Buddhism',
    'Sinhala', 'Active', String(new Date().getFullYear()),
    '45 Main Street, Colombo', 'Kamal Perera', '0711234567', 'kamal@example.com',
  ];
  const ws = XLSX.utils.aoa_to_sheet([metaRow, blankRow, headersRow, sampleRow]);
  ws['!cols'] = [
    { wch: 36 }, { wch: 24 }, { wch: 20 }, { wch: 24 }, { wch: 46 },
    { wch: 24 }, { wch: 28 }, { wch: 14 }, { wch: 34 },
    { wch: 24 }, { wch: 16 }, { wch: 28 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  XLSX.writeFile(wb, `students_G${grade}${parallel}_template.xlsx`);
}

function parseClassStudentXl(file, existingAdmNos) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
        const dataRows = rows.slice(3).filter(r => r.some(c => String(c).trim() !== ''));
        const seenInFile = new Set();
        const parsed = dataRows.map((r, i) => {
          const obj = { _row: i + 4, _errors: [], _dupType: null };
          XL_COLS.forEach((col, ci) => { obj[col] = String(r[ci] ?? '').trim(); });
          if (!obj.name) obj._errors.push('Full Name is required');
          if (!['Male', 'Female'].includes(obj.gender))                                           obj.gender      = 'Male';
          if (!['Active', 'Inactive', 'Transferred'].includes(obj.status))                        obj.status      = 'Active';
          if (!['Buddhism', 'Hinduism', 'Islam', 'Christianity', 'Other'].includes(obj.religion)) obj.religion    = 'Buddhism';
          if (!['Sinhala', 'English', 'Tamil', ''].includes(obj.medium))                          obj.medium      = '';
          if (!obj.academicYear) obj.academicYear = String(new Date().getFullYear());
          if (obj.admissionNo) {
            if (existingAdmNos.has(obj.admissionNo))      obj._dupType = 'db';
            else if (seenInFile.has(obj.admissionNo))     obj._dupType = 'file';
            seenInFile.add(obj.admissionNo);
          }
          return obj;
        });
        resolve(parsed);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

async function generateAdmissionNo() {
  const year = new Date().getFullYear();
  const all  = await db.students.toArray();
  const pattern = new RegExp(`^ADM${year}(\\d+)$`);
  let max = 0;
  all.forEach(s => { const m = s.admissionNo?.match(pattern); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  return `ADM${year}${String(max + 1).padStart(3, '0')}`;
}

function Avatar({ name, size = 'md' }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500'];
  const color = colors[name ? name.charCodeAt(0) % colors.length : 0];
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : 'w-8 h-8 text-xs';
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-bold shrink-0`}>
      {initials}
    </div>
  );
}

function StatusBadge({ status }) {
  const cls = {
    Active:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Inactive:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Transferred: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>;
}

const EMPTY_STUDENT_FORM = {
  admissionNo: '', name: '', gender: 'Male', dob: '', religion: 'Buddhism',
  address: '', parentName: '', parentPhone: '', parentEmail: '',
  status: 'Active', academicYear: '2025', stream: '', medium: '',
};

export default function MyClass() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [accessChecked, setAccessChecked]   = useState(false);
  const [cls, setCls]                       = useState(null);
  const [teacher, setTeacher]               = useState(null);
  const [students, setStudents]             = useState([]);
  const [classlessStudents, setClasslessStudents] = useState([]);
  const [timetable, setTimetable]           = useState([]);
  const [subjects, setSubjects]             = useState([]);
  const [subjectTeachers, setSubjectTeachers] = useState([]);
  const [allTeachers, setAllTeachers]       = useState([]);
  const [loading, setLoading]               = useState(true);
  const [tab, setTab]                       = useState('students');

  // Modals
  const [assignModal, setAssignModal]               = useState(false);
  const [viewModal, setViewModal]                   = useState(false);
  const [editStudentModal, setEditStudentModal]     = useState(false);
  const [assignTeacherModal, setAssignTeacherModal] = useState(false);
  const [selectedSubject, setSelectedSubject]       = useState(null);
  const [teacherAssignForm, setTeacherAssignForm]   = useState({ teacherId: '', medium: 'Sinhala Medium' });
  const [savingTeacherAssign, setSavingTeacherAssign] = useState(false);
  const [teacherAssignError, setTeacherAssignError] = useState('');
  const [selectedStudent, setSelectedStudent]       = useState(null);
  const [studentForm, setStudentForm]               = useState(EMPTY_STUDENT_FORM);
  const [assigning, setAssigning]                   = useState(false);
  const [savingStudent, setSavingStudent]           = useState(false);
  const [studentError, setStudentError]             = useState('');
  const [qrOpen, setQrOpen]                         = useState(false);

  // Import state
  const [importModal,  setImportModal]  = useState(false);
  const [importStep,   setImportStep]   = useState('upload');
  const [importRows,   setImportRows]   = useState([]);
  const [importing,    setImporting]    = useState(false);
  const [importDone,   setImportDone]   = useState(null);
  const [fileError,    setFileError]    = useState('');
  const fileRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Resolve teacher record
      const userRecord = await db.users.get(user.id);
      const teacherId  = userRecord?.teacherId ?? user?.teacherId;
      let teacherRecord = teacherId ? await db.teachers.get(teacherId) : null;
      if (!teacherRecord) {
        const name = userRecord?.name || user?.name;
        if (name) teacherRecord = await db.teachers.where('name').equals(name).first();
      }
      if (!teacherRecord) { setLoading(false); return; }
      setTeacher(teacherRecord);

      const allClasses  = await db.classes.toArray();
      const classRecord = allClasses.find(
        c => c.classTeacherId && Number(c.classTeacherId) === Number(teacherRecord.id)
      );
      if (!classRecord) { setLoading(false); return; }
      setCls(classRecord);

      const [allStudents, allTeachersData, allSubjectsData, classSubjectTeachers] = await Promise.all([
        db.students.toArray(),
        db.teachers.toArray(),
        db.subjects.toArray(),
        db.subjectTeachers.where('classId').equals(classRecord.id).toArray(),
      ]);

      setAllTeachers(allTeachersData);

      const enrolled = allStudents.filter(
        s => Number(s.grade) === classRecord.grade && s.parallel === classRecord.parallel
      );
      setStudents(enrolled);

      const unassigned = allStudents.filter(s => !s.grade || !s.parallel);
      setClasslessStudents(unassigned);

      const tt = await db.timetable.where('classId').equals(classRecord.id).toArray();
      setTimetable(tt);

      const subs = allSubjectsData.filter(s => s.grade === classRecord.grade);
      setSubjects(subs);
      setSubjectTeachers(classSubjectTeachers);
    } catch (err) {
      console.error('MyClass load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Access guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'teacher') { navigate('/403', { replace: true }); return; }
    (async () => {
      try {
        const allUsers    = await db.table('users').toArray();
        const userRecord  = allUsers.find(u => u.id === user.id);
        const teacherId   = userRecord?.teacherId ?? user?.teacherId;
        let teacherRecord = teacherId ? await db.teachers.get(teacherId) : null;
        if (!teacherRecord) {
          const name = userRecord?.name || user?.name;
          if (name) teacherRecord = await db.teachers.where('name').equals(name).first();
        }
        if (!teacherRecord) { navigate('/403', { replace: true }); return; }
        const assigned = await db.classes.where('classTeacherId').equals(teacherRecord.id).first();
        if (!assigned) { navigate('/403', { replace: true }); return; }
        setAccessChecked(true);
      } catch { navigate('/403', { replace: true }); }
    })();
  }, [user]);

  const handleAssignStudent = async (student) => {
    if (!cls) return;
    setAssigning(true);
    try {
      await db.students.update(student.id, { grade: cls.grade, parallel: cls.parallel, section: cls.section });
      await loadData();
    } finally { setAssigning(false); }
  };

  const handleRemoveFromClass = async (student) => {
    await db.students.update(student.id, { grade: null, parallel: null, section: null });
    await loadData();
  };

  const openEditStudent = (s) => {
    setSelectedStudent(s);
    setStudentForm({
      admissionNo: s.admissionNo || '', name: s.name || '', gender: s.gender || 'Male',
      dob: s.dob || '', religion: s.religion || 'Buddhism', address: s.address || '',
      parentName: s.parentName || '', parentPhone: s.parentPhone || '', parentEmail: s.parentEmail || '',
      status: s.status || 'Active', academicYear: s.academicYear || '2025',
      stream: s.stream || '', medium: s.medium || '',
    });
    setStudentError('');
    setEditStudentModal(true);
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!studentForm.name.trim()) { setStudentError('Name is required.'); return; }
    setSavingStudent(true);
    try {
      await db.students.update(selectedStudent.id, { ...studentForm });
      setEditStudentModal(false);
      await loadData();
    } catch (err) { setStudentError(err.message); }
    finally { setSavingStudent(false); }
  };

  // ── Excel import ─────────────────────────────────────────────────────────────
  const openImport = () => {
    setImportStep('upload');
    setImportRows([]);
    setImportDone(null);
    setFileError('');
    setImportModal(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileError('');
    try {
      const allStudents    = await db.students.toArray();
      const existingAdmNos = new Set(allStudents.map(s => s.admissionNo).filter(Boolean));
      const rows = await parseClassStudentXl(file, existingAdmNos);
      if (rows.length === 0) {
        setFileError('No data rows found. Fill in student records below the header row and try again.');
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
      setImportRows(rows);
      setImportStep('preview');
    } catch {
      setFileError('Could not read the file. Make sure it is a valid .xlsx or .xls spreadsheet.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = async () => {
    const toImport = importRows.filter(r => r._errors.length === 0 && !r._dupType);
    if (toImport.length === 0) return;
    setImporting(true);
    let added = 0;
    try {
      const schoolSetting  = await db.settings.where('key').equals('schoolName').first();
      const schoolName     = schoolSetting?.value || 'School Portal';
      const allStudents    = await db.students.toArray();
      const existingAdmNos = new Set(allStudents.map(s => s.admissionNo).filter(Boolean));

      for (const row of toImport) {
        let admNo = row.admissionNo;
        if (!admNo || existingAdmNos.has(admNo)) admNo = await generateAdmissionNo();

        const studentData = {
          admissionNo:  admNo,
          name:         row.name,
          gender:       row.gender,
          dob:          row.dob,
          religion:     row.religion,
          medium:       row.medium,
          status:       row.status,
          academicYear: row.academicYear,
          address:      row.address,
          parentName:   row.parentName,
          parentPhone:  row.parentPhone,
          parentEmail:  row.parentEmail,
          grade:        cls.grade,
          parallel:     cls.parallel,
          section:      cls.section,
          stream:       '',
        };

        const newId   = await db.students.add(studentData);
        existingAdmNos.add(admNo);

        const username = admNo.toLowerCase().replace(/\s+/g, '');
        const password = 'student@123';
        await db.users.add({
          username, password, role: 'student',
          name: row.name, email: row.parentEmail || '', studentId: newId,
        });
        await db.idCards.add({
          personId: newId, personType: 'student',
          name: row.name, idNumber: admNo, username, password,
          schoolName, createdAt: new Date().toISOString(),
        });

        added++;
      }

      const skipped = importRows.length - added;
      setImportDone({ added, skipped });
      loadData();
    } finally {
      setImporting(false);
    }
  };

  const openAssignTeacher = (subject) => {
    setSelectedSubject(subject);
    setTeacherAssignForm({ teacherId: '', medium: 'Sinhala Medium' });
    setTeacherAssignError('');
    setAssignTeacherModal(true);
  };

  const handleAssignTeacher = async (e) => {
    e.preventDefault();
    if (!teacherAssignForm.teacherId) { setTeacherAssignError('Please select a teacher.'); return; }
    const exists = subjectTeachers.find(
      st => st.subjectId === selectedSubject.id &&
            st.teacherId === Number(teacherAssignForm.teacherId) &&
            st.medium === teacherAssignForm.medium
    );
    if (exists) { setTeacherAssignError('This teacher is already assigned with that medium.'); return; }
    setSavingTeacherAssign(true);
    try {
      await db.subjectTeachers.add({
        subjectId: selectedSubject.id,
        teacherId: Number(teacherAssignForm.teacherId),
        medium: teacherAssignForm.medium,
        classId: cls.id,
      });
      setAssignTeacherModal(false);
      await loadData();
    } catch (err) { setTeacherAssignError(err.message); }
    finally { setSavingTeacherAssign(false); }
  };

  const handleRemoveTeacherAssign = async (stId) => {
    await db.subjectTeachers.delete(stId);
    await loadData();
  };

  const getSubjectName = (sid) => subjects.find(s => s.id === sid)?.name || '—';
  const getTeacherName = (tid) => allTeachers.find(t => t.id === tid)?.name || '—';

  const subjectColorMap = {};
  subjects.forEach((s, i) => { subjectColorMap[s.id] = SUBJECT_COLORS[i % SUBJECT_COLORS.length]; });

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Users size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-1">No Supervising Class</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">You are not assigned as class teacher for any class.</p>
        <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <ArrowLeft size={15} /> Back to Dashboard
        </button>
      </div>
    );
  }

  const usedCapacity = students.length;
  const capacity     = cls.capacity || 40;
  const capacityPct  = Math.min(Math.round((usedCapacity / capacity) * 100), 100);
  const gradient     = SECTION_GRADIENT[cls.section] || 'from-blue-600 to-blue-700';

  // Student form fields — identical to ClassDetail
  const StudentFormFields = ({ onSubmit }) => (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          Admission No <span className="text-xs text-slate-400">(auto)</span>
        </label>
        <input
          value={studentForm.admissionNo}
          onChange={e => setStudentForm(f => ({ ...f, admissionNo: e.target.value }))}
          readOnly={!selectedStudent}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 font-mono"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Full Name *</label>
        <input value={studentForm.name} onChange={e => setStudentForm(f => ({ ...f, name: e.target.value }))}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Gender</label>
        <select value={studentForm.gender} onChange={e => setStudentForm(f => ({ ...f, gender: e.target.value }))}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
          <option>Male</option><option>Female</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Date of Birth</label>
        <input type="date" value={studentForm.dob} onChange={e => setStudentForm(f => ({ ...f, dob: e.target.value }))}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Religion</label>
        <select value={studentForm.religion} onChange={e => setStudentForm(f => ({ ...f, religion: e.target.value }))}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
          {['Buddhism', 'Hinduism', 'Islam', 'Christianity', 'Other'].map(r => <option key={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Status</label>
        <select value={studentForm.status} onChange={e => setStudentForm(f => ({ ...f, status: e.target.value }))}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      {cls.section === 'Advanced' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Stream</label>
          <select value={studentForm.stream} onChange={e => setStudentForm(f => ({ ...f, stream: e.target.value }))}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
            <option value="">Select Stream</option>
            <option>Science</option><option>Commerce</option><option>Arts</option><option>Technology</option>
          </select>
        </div>
      )}
      {cls.isEnglishMedium && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Medium</label>
          <select value={studentForm.medium} onChange={e => setStudentForm(f => ({ ...f, medium: e.target.value }))}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
            <option value="">— Select Medium —</option>
            <option>Sinhala</option><option>English</option><option>Tamil</option>
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Academic Year</label>
        <input value={studentForm.academicYear} onChange={e => setStudentForm(f => ({ ...f, academicYear: e.target.value }))}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Address</label>
        <input value={studentForm.address} onChange={e => setStudentForm(f => ({ ...f, address: e.target.value }))}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Parent / Guardian Name</label>
        <input value={studentForm.parentName} onChange={e => setStudentForm(f => ({ ...f, parentName: e.target.value }))}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Parent Phone</label>
        <input value={studentForm.parentPhone} onChange={e => setStudentForm(f => ({ ...f, parentPhone: e.target.value }))}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Parent Email</label>
        <input type="email" value={studentForm.parentEmail} onChange={e => setStudentForm(f => ({ ...f, parentEmail: e.target.value }))}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
      </div>
    </form>
  );

  if (!accessChecked) return null;

  return (
    <div className="space-y-5">
      {/* Back */}
      <button onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      {/* Header banner */}
      <div className={`bg-gradient-to-r ${gradient} rounded-2xl p-6 text-white`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 rounded-xl px-3 py-1.5">
                <span className="text-2xl font-black">G{cls.grade}{cls.parallel}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-lg leading-tight">Grade {cls.grade} — {cls.parallel}</p>
                  {cls.isEnglishMedium && (
                    <span className="flex items-center gap-1 bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                      <Globe size={11} /> English Medium
                    </span>
                  )}
                </div>
                <p className="text-white/70 text-sm">{cls.section} Section · {cls.academicYear}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                {teacher?.name?.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p className="text-xs text-white/60">Class Supervisor (You)</p>
                <p className="text-sm font-medium">{teacher?.name}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <button
              onClick={() => setQrOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors text-white"
            >
              <QrCode size={15} /> QR Code
            </button>
          <div className="bg-white/10 rounded-xl p-4 text-center min-w-[110px]">
            <p className="text-3xl font-bold">{usedCapacity}</p>
            <p className="text-white/70 text-xs mt-0.5">/ {capacity} students</p>
            <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${capacityPct >= 90 ? 'bg-red-400' : capacityPct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${capacityPct}%` }}
              />
            </div>
            <p className="text-xs text-white/60 mt-1">{capacityPct}% full</p>
          </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {[
          { key: 'students',  label: 'Students',  icon: Users },
          { key: 'subjects',  label: 'Subjects',  icon: BookOpen },
          { key: 'timetable', label: 'Timetable', icon: Clock },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── Students Tab ── */}
      {tab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 justify-between">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
                <Users size={15} className="text-blue-600" /> Enrolled Students
                <span className="text-xs text-slate-400 font-normal">({students.length})</span>
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={openImport}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                  <FileSpreadsheet size={13} /> Import Excel
                </button>
                <button onClick={() => setAssignModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                  <UserPlus size={13} /> Add Unassigned
                  {classlessStudents.length > 0 && (
                    <span className="bg-white/30 rounded-full px-1.5 text-xs">{classlessStudents.length}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
              {students.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-400 text-sm">No students enrolled yet</div>
              ) : students.map(s => (
                <div key={s.id} className="p-4 flex items-center gap-3">
                  <Avatar name={s.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <button onClick={() => { setSelectedStudent(s); setViewModal(true); }}
                        className="font-medium text-slate-800 dark:text-slate-100 text-sm text-left truncate">{s.name}</button>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{s.admissionNo} · {s.gender}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <button onClick={() => { setSelectedStudent(s); setViewModal(true); }}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="View"><Eye size={13} /></button>
                      <button onClick={() => openEditStudent(s)}
                        className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg" title="Edit"><Edit size={13} /></button>
                      <button onClick={() => handleRemoveFromClass(s)}
                        className="p-1 text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg" title="Remove from class"><UserX size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {['#', 'Student', 'Admission No', 'Gender', 'DOB',
                      ...(cls.isEnglishMedium ? ['Medium'] : []),
                      'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {students.length === 0 ? (
                    <tr><td colSpan={cls.isEnglishMedium ? 8 : 7} className="px-4 py-8 text-center text-slate-400">No students enrolled yet</td></tr>
                  ) : students.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} />
                          <button onClick={() => { setSelectedStudent(s); setViewModal(true); }}
                            className="font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 text-left">
                            {s.name}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">{s.admissionNo}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.gender}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{s.dob || '—'}</td>
                      {cls.isEnglishMedium && (
                        <td className="px-4 py-3">
                          {s.medium
                            ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MEDIUM_COLORS[s.medium] || 'bg-slate-100 text-slate-600'}`}>{s.medium}</span>
                            : <span className="text-xs text-slate-400 italic">Not set</span>}
                        </td>
                      )}
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setSelectedStudent(s); setViewModal(true); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="View profile"><Eye size={14} /></button>
                          <button onClick={() => openEditStudent(s)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Edit student"><Edit size={14} /></button>
                          <button onClick={() => handleRemoveFromClass(s)}
                            className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors" title="Remove from class"><UserX size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Subjects Tab ── */}
      {tab === 'subjects' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {subjects.length} subjects for Grade {cls.grade} · {cls.section}
          </p>
          {subjects.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-400 text-sm">
              No subjects found for this grade.
            </div>
          ) : (() => {
            const SubjectCard = (sub, idx) => {
              const assignments = subjectTeachers.filter(st => st.subjectId === sub.id);
              const color = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
              return (
                <div key={sub.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${color}`}>{sub.code}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{sub.name}</p>
                        <p className="text-xs text-slate-400">{sub.type}</p>
                      </div>
                    </div>
                    <button onClick={() => openAssignTeacher(sub)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 shrink-0 ml-2">
                      <Plus size={12} /> Assign Teacher
                    </button>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    {assignments.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No teachers assigned yet</p>
                    ) : assignments.map(st => {
                      const t = allTeachers.find(t => t.id === st.teacherId);
                      return (
                        <div key={st.id} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar name={t?.name || '?'} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{t?.name || 'Unknown Teacher'}</p>
                              <span className="text-xs text-slate-400">{st.medium}</span>
                            </div>
                          </div>
                          <button onClick={() => handleRemoveTeacherAssign(st.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0" title="Remove assignment">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            };

            if (cls.section === 'Advanced') {
              return (
                <div className="space-y-5">
                  {AL_STREAMS.map(stream => {
                    const streamSubs = subjects.filter(s => s.stream === stream);
                    if (streamSubs.length === 0) return null;
                    const st = AL_STREAM_STYLE[stream];
                    const relSubs  = streamSubs.filter(s => s.group === 'Religion');
                    const aesSubs  = streamSubs.filter(s => s.group === 'Aesthetics');
                    const coreSubs = streamSubs.filter(s => !s.group);
                    let idx = 0;
                    return (
                      <div key={stream} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className={`px-4 py-3 border-b border-slate-100 dark:border-slate-800 ${st.header} flex items-center gap-2`}>
                          <span className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
                          <p className={`text-sm font-bold ${st.label} uppercase tracking-wide`}>{stream} Stream</p>
                          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full ml-1">{streamSubs.length} subjects</span>
                        </div>
                        <div className="p-4 space-y-3">
                          {relSubs.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">Religion</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{relSubs.map(sub => SubjectCard(sub, idx++))}</div>
                            </div>
                          )}
                          {coreSubs.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{coreSubs.map(sub => SubjectCard(sub, idx++))}</div>
                          )}
                          {aesSubs.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-2">Aesthetic Studies</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{aesSubs.map(sub => SubjectCard(sub, idx++))}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            const coreSubjects      = subjects.filter(s => !s.group);
            const religionSubjects  = subjects.filter(s => s.group === 'Religion');
            const optionalSubjects  = subjects.filter(s => s.group === 'Optional');
            const aestheticsSubjects= subjects.filter(s => s.group === 'Aesthetics');
            const technicalSubjects = subjects.filter(s => s.group === 'Technical');

            return (
              <div className="space-y-5">
                {religionSubjects.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Religion</p>
                      <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Students take one based on faith</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{religionSubjects.map((sub, idx) => SubjectCard(sub, idx))}</div>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Core Subjects</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {coreSubjects.map((sub, idx) => SubjectCard(sub, religionSubjects.length + idx))}
                  </div>
                </div>
                {optionalSubjects.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide">Category I — Optional</p>
                      <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Students choose from this category</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {optionalSubjects.map((sub, idx) => SubjectCard(sub, religionSubjects.length + coreSubjects.length + idx))}
                    </div>
                  </div>
                )}
                {aestheticsSubjects.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Category II — Aesthetics</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {aestheticsSubjects.map((sub, idx) => SubjectCard(sub, religionSubjects.length + coreSubjects.length + optionalSubjects.length + idx))}
                    </div>
                  </div>
                )}
                {technicalSubjects.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Category III — Technical</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {technicalSubjects.map((sub, idx) => SubjectCard(sub, religionSubjects.length + coreSubjects.length + optionalSubjects.length + aestheticsSubjects.length + idx))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Timetable Tab ── */}
      {tab === 'timetable' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
              <Clock size={15} className="text-blue-600" /> Weekly Timetable
            </h3>
            <button onClick={() => navigate('/timetable')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              Edit in Timetable →
            </button>
          </div>
          {timetable.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No timetable set for this class.{' '}
              <button onClick={() => navigate('/timetable')} className="text-blue-600 dark:text-blue-400 hover:underline">Set up timetable →</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs font-semibold text-slate-500 min-w-[80px]">Period</th>
                    {DAYS.map(d => (
                      <th key={d} className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-200 min-w-[100px]">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1,2,3,4,5,6,7,8].map(period => (
                    <tr key={period}>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-800/50">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">P{period}</p>
                        <p className="text-xs text-slate-400">{PERIOD_TIMES[period]}</p>
                      </td>
                      {DAYS.map(day => {
                        const cell = timetable.find(t => t.day === day && t.period === period);
                        return (
                          <td key={day} className="border border-slate-200 dark:border-slate-700 p-1.5">
                            {cell ? (
                              <div className={`rounded-lg p-1.5 ${subjectColorMap[cell.subjectId] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>
                                <p className="text-xs font-semibold truncate">{getSubjectName(cell.subjectId)}</p>
                                <p className="text-xs opacity-70 truncate">{getTeacherName(cell.teacherId)}</p>
                                {cell.room && <p className="text-xs opacity-60">{cell.room}</p>}
                              </div>
                            ) : (
                              <div className="h-10 rounded-lg border-2 border-dashed border-slate-100 dark:border-slate-700" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Edit Student */}
      <Modal isOpen={editStudentModal} onClose={() => setEditStudentModal(false)} title="Edit Student" size="lg"
        footer={
          <>
            <button onClick={() => setEditStudentModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleSaveStudent} disabled={savingStudent} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
              <Save size={14} /> {savingStudent ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        {studentError && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{studentError}</p>}
        <StudentFormFields onSubmit={handleSaveStudent} />
      </Modal>

      {/* Assign Teacher to Subject */}
      <Modal isOpen={assignTeacherModal} onClose={() => setAssignTeacherModal(false)} title={`Assign Teacher — ${selectedSubject?.name}`} size="sm"
        footer={
          <>
            <button onClick={() => setAssignTeacherModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleAssignTeacher} disabled={savingTeacherAssign} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {savingTeacherAssign ? 'Assigning...' : 'Assign'}
            </button>
          </>
        }
      >
        {teacherAssignError && <p className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{teacherAssignError}</p>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Teacher *</label>
            <select value={teacherAssignForm.teacherId} onChange={e => setTeacherAssignForm(f => ({ ...f, teacherId: e.target.value }))}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              <option value="">— Select Teacher —</option>
              {allTeachers.filter(t => t.status === 'Active').map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Medium</label>
            <select value={teacherAssignForm.medium} onChange={e => setTeacherAssignForm(f => ({ ...f, medium: e.target.value }))}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              <option>Sinhala Medium</option><option>English Medium</option><option>Tamil Medium</option><option>Other</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Add Unassigned Students */}
      <Modal isOpen={assignModal} onClose={() => setAssignModal(false)} title="Add Unassigned Students to This Class" size="md">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Select students to assign to <strong className="text-slate-800 dark:text-slate-100">Grade {cls.grade} — {cls.parallel}</strong>.
        </p>
        {classlessStudents.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No unassigned students available.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {classlessStudents.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.admissionNo} · {s.gender}</p>
                  </div>
                </div>
                <button onClick={() => handleAssignStudent(s)} disabled={assigning}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-60">
                  <UserCheck size={13} /> Assign
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* View Student Profile */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title="Student Profile" size="md">
        {selectedStudent && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={selectedStudent.name} size="lg" />
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{selectedStudent.name}</h3>
                <p className="text-sm text-slate-500">{selectedStudent.admissionNo}</p>
              </div>
              <StatusBadge status={selectedStudent.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Grade', `${selectedStudent.grade} — ${selectedStudent.parallel}`],
                ['Section', selectedStudent.section],
                ['Gender', selectedStudent.gender],
                ['DOB', selectedStudent.dob],
                ['Religion', selectedStudent.religion],
                ...(cls.isEnglishMedium ? [['Medium', selectedStudent.medium || 'Not set']] : []),
                ['Parent', selectedStudent.parentName],
                ['Parent Phone', selectedStudent.parentPhone],
                ['Stream', selectedStudent.stream || 'N/A'],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">{k}</p>
                  <p className="font-medium text-slate-800 dark:text-slate-100 mt-0.5">{v || 'N/A'}</p>
                </div>
              ))}
              <div className="col-span-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Address</p>
                <p className="font-medium text-slate-800 dark:text-slate-100 mt-0.5">{selectedStudent.address || 'N/A'}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => { setViewModal(false); openEditStudent(selectedStudent); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20">
                <Edit size={13} /> Edit
              </button>
              <button onClick={() => { setViewModal(false); handleRemoveFromClass(selectedStudent); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20">
                <UserX size={13} /> Remove from Class
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ClassQRModal
        isOpen={qrOpen}
        onClose={() => setQrOpen(false)}
        classId={cls.id}
        classLabel={`Grade ${cls.grade}${cls.parallel}`}
        section={cls.section}
      />

      {/* ── Import Students from Excel Modal ─────────────────────────────── */}
      {(() => {
        const invalidCount = importRows.filter(r => r._errors.length > 0).length;
        const dupCount     = importRows.filter(r => !r._errors.length && r._dupType).length;
        const validCount   = importRows.filter(r => !r._errors.length && !r._dupType).length;
        return (
          <Modal
            isOpen={importModal}
            onClose={() => setImportModal(false)}
            title={`Import Students — Grade ${cls?.grade}${cls?.parallel}`}
            size="xl"
            footer={
              importStep === 'upload' ? (
                <button onClick={() => setImportModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Close</button>
              ) : importDone ? (
                <button onClick={() => setImportModal(false)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Done</button>
              ) : (
                <>
                  <button onClick={() => { setImportStep('upload'); setImportRows([]); setImportDone(null); }} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Back</button>
                  <button onClick={handleImport} disabled={importing || validCount === 0} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                    <Upload size={14} /> {importing ? 'Importing…' : `Import ${validCount} Student${validCount !== 1 ? 's' : ''}`}
                  </button>
                </>
              )
            }
          >
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-5">
              {['Upload File', 'Review & Import'].map((label, i) => {
                const stepIdx = importStep === 'upload' ? 0 : 1;
                const done    = i < stepIdx;
                const active  = i === stepIdx;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${active ? 'text-blue-600 dark:text-blue-400' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-blue-600 text-white' : done ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                        {done ? '✓' : i + 1}
                      </span>
                      {label}
                    </div>
                    {i < 1 && <StepArrow size={14} className="text-slate-300 dark:text-slate-600" />}
                  </div>
                );
              })}
            </div>

            {/* Step 1: Upload */}
            {importStep === 'upload' && (
              <div className="space-y-5">
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 p-4 space-y-2">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">How to import students</p>
                  <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                    <li>Download the template — <strong>Grade {cls?.grade} and Parallel {cls?.parallel}</strong> are pre-filled</li>
                    <li>Fill in one student per row — the sample row can be deleted</li>
                    <li>Leave <em>Admission No</em> blank to auto-generate, or enter your own</li>
                    <li>Save as <strong>.xlsx</strong> or <strong>.xls</strong> and upload below</li>
                    <li>Review the preview — duplicates are flagged automatically before import</li>
                  </ol>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={20} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Student Import Template</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">students_G{cls?.grade}{cls?.parallel}_template.xlsx · 12 columns</p>
                    </div>
                  </div>
                  <button onClick={() => downloadClassStudentTemplate(cls.grade, cls.parallel)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 font-medium shrink-0">
                    <Download size={14} /> Download Template
                  </button>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Template Columns</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {XL_HEADERS.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-mono shrink-0">{i + 1}</span>
                        {h}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Upload Spreadsheet</p>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                    <Upload size={22} className="text-slate-400 dark:text-slate-500 mb-2" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Click to select spreadsheet</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">.xlsx or .xls files only</p>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                  </label>
                  {fileError && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <AlertCircle size={14} /> {fileError}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Preview */}
            {importStep === 'preview' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm w-fit">
                  <span className="text-blue-500 dark:text-blue-400 font-medium text-xs uppercase tracking-wide">Importing into</span>
                  <span className="font-bold text-blue-800 dark:text-blue-200">Grade {cls?.grade} — {cls?.parallel}</span>
                  <span className="text-xs text-blue-500 dark:text-blue-400">· {cls?.section}</span>
                </div>

                {importDone ? (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10 p-4 flex items-center gap-3">
                    <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Import complete</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        {importDone.added} student{importDone.added !== 1 ? 's' : ''} added
                        {importDone.skipped > 0 && ` · ${importDone.skipped} skipped (duplicates / errors)`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                      <CheckCircle size={13} /> {validCount} ready to import
                    </span>
                    {dupCount > 0 && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
                        <AlertTriangle size={13} /> {dupCount} duplicate{dupCount !== 1 ? 's' : ''} — will be skipped
                      </span>
                    )}
                    {invalidCount > 0 && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium">
                        <AlertCircle size={13} /> {invalidCount} row{invalidCount !== 1 ? 's' : ''} with errors — will be skipped
                      </span>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                        <tr>
                          {['Row', 'Admission No', 'Full Name', 'Gender', 'DOB', 'Religion', 'Status', 'Result'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {importRows.map(r => {
                          const isDup  = !!r._dupType;
                          const isErr  = r._errors.length > 0;
                          const rowCls = isErr ? 'bg-red-50/50 dark:bg-red-900/5'
                                       : isDup ? 'bg-amber-50/50 dark:bg-amber-900/5'
                                       : 'hover:bg-slate-50 dark:hover:bg-slate-800/30';
                          return (
                            <tr key={r._row} className={rowCls}>
                              <td className="px-3 py-2 text-slate-400 dark:text-slate-500 font-mono">{r._row}</td>
                              <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">
                                {r.admissionNo || <span className="text-slate-400 italic">auto</span>}
                              </td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                {r.name || <span className="text-red-500">—</span>}
                              </td>
                              <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.gender}</td>
                              <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{r.dob || '—'}</td>
                              <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.religion}</td>
                              <td className="px-3 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {isErr ? (
                                  <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                    <AlertCircle size={12} /> {r._errors.join('; ')}
                                  </span>
                                ) : isDup ? (
                                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                    <AlertTriangle size={12} /> {r._dupType === 'db' ? 'Already in DB' : 'Duplicate in file'}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <CheckCircle size={12} /> OK
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </Modal>
        );
      })()}
    </div>
  );
}
