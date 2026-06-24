import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Search, Edit, Trash2, Eye, Download, ChevronLeft, ChevronRight, X, UserX, ToggleLeft, ToggleRight, FileSpreadsheet, Upload, AlertCircle, CheckCircle, AlertTriangle, ChevronRight as StepArrow } from 'lucide-react';
import { db } from '../db/database';
import Modal from '../components/Modal';
import IDCardModal from '../components/IDCardModal';

// ── Excel import constants ────────────────────────────────────────────────────

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

function downloadStudentTemplate() {
  // Row 1 — class metadata cells
  const metaRow     = ['Grade', '', 'Parallel', ''];
  const blankRow    = [];
  const headersRow  = XL_HEADERS;
  const sampleRow   = [
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
  XLSX.writeFile(wb, 'students_import_template.xlsx');
}

function parseStudentXl(file, existingAdmNos) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

        // Row 0: ['Grade', <value>, 'Parallel', <value>]
        const grade    = String(rows[0]?.[1] ?? '').trim();
        const parallel = String(rows[0]?.[3] ?? '').trim().toUpperCase();

        // Row 1: blank separator  |  Row 2: column headers (skip both)
        // Data starts at row index 3
        const dataRows = rows.slice(3).filter(r => r.some(c => String(c).trim() !== ''));

        // Track admission numbers seen inside this file to catch file-level duplicates
        const seenInFile = new Set();

        const parsed = dataRows.map((r, i) => {
          const obj = { _row: i + 4, _errors: [], _dupType: null };

          XL_COLS.forEach((col, ci) => { obj[col] = String(r[ci] ?? '').trim(); });

          // Required field validation
          if (!obj.name) obj._errors.push('Full Name is required');

          // Normalise constrained fields with safe fallbacks
          if (!['Male', 'Female'].includes(obj.gender))                                          obj.gender      = 'Male';
          if (!['Active', 'Inactive', 'Transferred'].includes(obj.status))                       obj.status      = 'Active';
          if (!['Buddhism', 'Hinduism', 'Islam', 'Christianity', 'Other'].includes(obj.religion)) obj.religion   = 'Buddhism';
          if (!['Sinhala', 'English', 'Tamil', ''].includes(obj.medium))                         obj.medium      = '';
          if (!obj.academicYear) obj.academicYear = String(new Date().getFullYear());

          // Duplicate detection
          if (obj.admissionNo) {
            if (existingAdmNos.has(obj.admissionNo)) {
              obj._dupType = 'db';       // already in database
            } else if (seenInFile.has(obj.admissionNo)) {
              obj._dupType = 'file';     // appears twice inside this file
            }
            seenInFile.add(obj.admissionNo);
          }

          return obj;
        });

        resolve({ grade, parallel, rows: parsed });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

const SECTIONS = ['Primary', 'Secondary', 'Ordinary', 'Advanced'];
const SECTION_GRADES = { Primary: [1,2,3,4,5], Secondary: [6,7,8,9], Ordinary: [10,11], Advanced: [12,13] };
const PARALLELS = ['A', 'B', 'C', 'D', 'E'];
const STATUSES = ['Active', 'Inactive', 'Transferred'];
const PAGE_SIZE = 10;

function getSection(grade) {
  const g = Number(grade);
  if (g <= 5) return 'Primary';
  if (g <= 9) return 'Secondary';
  if (g <= 11) return 'Ordinary';
  return 'Advanced';
}

async function generateAdmissionNo() {
  const year = new Date().getFullYear();
  const all = await db.students.toArray();
  const pattern = new RegExp(`^ADM${year}(\\d+)$`);
  let max = 0;
  all.forEach(s => {
    const m = s.admissionNo?.match(pattern);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `ADM${year}${String(max + 1).padStart(3, '0')}`;
}

function Avatar({ name }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500'];
  const color = colors[name ? name.charCodeAt(0) % colors.length : 0];
  return (
    <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initials}
    </div>
  );
}

function StatusBadge({ status }) {
  const cls = {
    Active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Inactive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Transferred: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cls[status] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{status}</span>;
}

const EMPTY_FORM = { admissionNo: '', name: '', grade: '1', parallel: 'A', section: 'Primary', gender: 'Male', dob: '', address: '', parentName: '', parentPhone: '', parentEmail: '', religion: 'Buddhism', status: 'Active', academicYear: '2025', stream: '', medium: '' };

export default function Students() {
  const [students, setStudents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [classless, setClassless] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterParallel, setFilterParallel] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [hasClass, setHasClass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [idCard, setIdCard] = useState(null);

  // ── import state ───────────────────────────────────────────────────────────
  const [importModal, setImportModal] = useState(false);
  const [importStep,  setImportStep]  = useState('upload');   // 'upload' | 'preview'
  const [importGrade,    setImportGrade]    = useState('');
  const [importParallel, setImportParallel] = useState('');
  const [importRows,  setImportRows]  = useState([]);
  const [importing,   setImporting]   = useState(false);
  const [importDone,  setImportDone]  = useState(null);       // { added, skipped }
  const [fileError,   setFileError]   = useState('');
  const fileRef = useRef(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const all = await db.students.toArray();
      all.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const enrolled = all.filter(s => s.grade && s.parallel);
      const unassigned = all.filter(s => !s.grade || !s.parallel);
      setStudents(enrolled);
      setClassless(unassigned);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  useEffect(() => {
    let res = [...students];
    if (filterSection) res = res.filter(s => s.section === filterSection);
    if (filterGrade) res = res.filter(s => String(s.grade) === filterGrade);
    if (filterParallel) res = res.filter(s => s.parallel === filterParallel);
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(s => s.name?.toLowerCase().includes(q) || s.admissionNo?.toLowerCase().includes(q));
    }
    setFiltered(res);
    setPage(1);
  }, [students, search, filterSection, filterGrade, filterParallel]);

  const availableGrades = filterSection ? SECTION_GRADES[filterSection] : Array.from({ length: 13 }, (_, i) => i + 1);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openAdd = async () => {
    setSelected(null);
    const admNo = await generateAdmissionNo();
    setForm({ ...EMPTY_FORM, admissionNo: admNo });
    setHasClass(false);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setSelected(s);
    setForm({ ...EMPTY_FORM, ...s, grade: s.grade ? String(s.grade) : '1', parallel: s.parallel || 'A' });
    setHasClass(!!(s.grade && s.parallel));
    setError('');
    setModalOpen(true);
  };

  const openView = (s) => { setSelected(s); setViewModal(true); };
  const openDelete = (s) => { setSelected(s); setDeleteModal(true); };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(f => {
      const updated = { ...f, [name]: value };
      if (name === 'grade') updated.section = getSection(value);
      return updated;
    });
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Student name is required.'); return; }
    setSaving(true);
    try {
      let data = { ...form };
      if (hasClass && form.grade) {
        data.grade = Number(form.grade);
        data.parallel = form.parallel;
        data.section = getSection(form.grade);
      } else {
        data.grade = null;
        data.parallel = null;
        data.section = null;
      }
      if (selected) {
        await db.students.update(selected.id, data);
        const linked = await db.users.where('studentId').equals(selected.id).first();
        if (linked) await db.users.update(linked.id, { name: data.name });
      } else {
        const newId = await db.students.add(data);
        const username = data.admissionNo.toLowerCase().replace(/\s+/g, '');
        const password = 'student@123';
        await db.users.add({
          username,
          password,
          role: 'student',
          name: data.name,
          email: data.parentEmail || '',
          studentId: newId,
        });
        // Fetch school name for the card
        const schoolSetting = await db.settings.where('key').equals('schoolName').first();
        const cardData = {
          personId: newId,
          personType: 'student',
          name: data.name,
          idNumber: data.admissionNo,
          username,
          password,
          schoolName: schoolSetting?.value || 'School Portal',
          createdAt: new Date().toISOString(),
        };
        const cardId = await db.idCards.add(cardData);
        setModalOpen(false);
        loadStudents();
        setIdCard({ ...cardData, id: cardId });
        return;
      }
      setModalOpen(false);
      loadStudents();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    // Cascade: remove linked user account, marks, fees, attendance, and ID card
    const linked = await db.users.where('studentId').equals(selected.id).first();
    if (linked) await db.users.delete(linked.id);
    await db.marks.where('studentId').equals(selected.id).delete();
    await db.fees.where('studentId').equals(selected.id).delete();
    await db.attendance.where('studentId').equals(selected.id).delete();
    await db.idCards.where('personId').equals(selected.id).and(c => c.personType === 'student').delete();
    await db.students.delete(selected.id);
    setDeleteModal(false);
    loadStudents();
  };


  // ── Import handlers ────────────────────────────────────────────────────────
  const openImport = () => {
    setImportStep('upload');
    setImportRows([]);
    setImportGrade('');
    setImportParallel('');
    setImportDone(null);
    setFileError('');
    setImportModal(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileError('');
    try {
      const allStudents   = await db.students.toArray();
      const existingAdmNos = new Set(allStudents.map(s => s.admissionNo).filter(Boolean));
      const result = await parseStudentXl(file, existingAdmNos);
      if (result.rows.length === 0) {
        setFileError('No data rows found. Fill in student records below the header row and try again.');
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
      setImportGrade(result.grade);
      setImportParallel(result.parallel);
      setImportRows(result.rows);
      setImportStep('preview');
    } catch {
      setFileError('Could not read the file. Make sure it is a valid .xlsx or .xls spreadsheet.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = async () => {
    // Only import rows that have no validation errors and are not duplicates
    const toImport = importRows.filter(r => r._errors.length === 0 && !r._dupType);
    if (toImport.length === 0) return;

    setImporting(true);
    let added = 0;

    try {
      const schoolSetting  = await db.settings.where('key').equals('schoolName').first();
      const schoolName     = schoolSetting?.value || 'School Portal';

      // Re-fetch to guard against race conditions
      const allStudents    = await db.students.toArray();
      const existingAdmNos = new Set(allStudents.map(s => s.admissionNo).filter(Boolean));

      const grade    = importGrade    ? Number(importGrade)       : null;
      const parallel = importParallel ? importParallel.toUpperCase() : null;
      const section  = grade          ? getSection(grade)         : null;

      for (const row of toImport) {
        let admNo = row.admissionNo;

        // Auto-generate if blank or race-condition duplicate
        if (!admNo || existingAdmNos.has(admNo)) {
          admNo = await generateAdmissionNo();
        }

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
          grade, parallel, section,
          stream: '',
        };

        const newId    = await db.students.add(studentData);
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
      loadStudents();
    } finally {
      setImporting(false);
    }
  };

  const exportCSV = () => {
    const all = [...students, ...classless];
    const headers = ['Admission No', 'Name', 'Grade', 'Parallel', 'Section', 'Gender', 'DOB', 'Status', 'Parent', 'Phone'];
    const rows = all.map(s => [s.admissionNo, s.name, s.grade || 'Unassigned', s.parallel || 'Unassigned', s.section || 'Unassigned', s.gender, s.dob, s.status, s.parentName, s.parentPhone]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'students.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Students</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {students.length} enrolled · {classless.length} unassigned
          </p>
        </div>
        <div className="flex gap-2 self-start flex-wrap">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            <Download size={15} /> <span className="hidden sm:inline">Export</span>
          </button>
          <button onClick={openImport} className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            <FileSpreadsheet size={15} /> <span className="hidden sm:inline">Import Excel</span>
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            <Plus size={15} /> <span className="hidden sm:inline">Add Student</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-2">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 flex-1 min-w-[180px]">
          <Search size={15} className="text-slate-400 dark:text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or admission no..." className="bg-transparent text-sm outline-none flex-1 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
          {search && <button onClick={() => setSearch('')}><X size={14} className="text-slate-400 dark:text-slate-500" /></button>}
        </div>
        <select value={filterSection} onChange={e => { setFilterSection(e.target.value); setFilterGrade(''); }} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 dark:bg-slate-800 outline-none w-full sm:w-auto">
          <option value="">All Sections</option>
          {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 dark:bg-slate-800 outline-none w-full sm:w-auto">
          <option value="">All Grades</option>
          {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
        </select>
        <select value={filterParallel} onChange={e => setFilterParallel(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 dark:bg-slate-800 outline-none w-full sm:w-auto">
          <option value="">All Parallels</option>
          {PARALLELS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Enrolled Students Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-slate-400">Showing {pageData.length} of {filtered.length} enrolled students</span>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-3/4" />
                </div>
              </div>
            ))
          ) : pageData.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">No enrolled students found</div>
          ) : pageData.map(s => (
            <div key={s.id} className="p-4 flex items-start gap-3">
              <Avatar name={s.name} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => openView(s)} className="font-medium text-slate-800 dark:text-slate-100 text-sm text-left leading-tight">{s.name}</button>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.admissionNo} · Grade {s.grade}{s.parallel} · {s.section}</p>
                <div className="flex items-center gap-1 mt-2">
                  <button onClick={() => openView(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Eye size={14} /></button>
                  <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"><Edit size={14} /></button>
                  <button onClick={() => openDelete(s)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={14} /></button>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Admission No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Grade & Class</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Section</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Gender</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : pageData.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">No enrolled students found</td></tr>
              ) : pageData.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} />
                      <button onClick={() => openView(s)} className="font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left">{s.name}</button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">{s.admissionNo}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">Grade {s.grade} - {s.parallel}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.section}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.gender}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openView(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="View"><Eye size={15} /></button>
                      <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Edit"><Edit size={15} /></button>
                      <button onClick={() => openDelete(s)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
                <ChevronLeft size={15} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Unassigned / Classless Students */}
      {(classless.length > 0 || loading) && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800/50 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-100 dark:border-amber-800/30 bg-amber-50 dark:bg-amber-900/10 flex items-center gap-2">
            <UserX size={16} className="text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Unassigned Students</span>
            <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">{classless.length}</span>
          </div>
          <p className="px-5 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">These students have no class assigned. A class supervisor can assign them from the class detail page.</p>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
            {loading ? (
              [1,2].map(i => (
                <div key={i} className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))
            ) : classless.map(s => (
              <div key={s.id} className="p-4 flex items-start gap-3">
                <Avatar name={s.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => openView(s)} className="font-medium text-slate-800 dark:text-slate-100 text-sm text-left">{s.name}</button>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.admissionNo} · No class assigned</p>
                  <div className="flex items-center gap-1 mt-2">
                    <button onClick={() => openView(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Eye size={14} /></button>
                    <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"><Edit size={14} /></button>
                    <button onClick={() => openDelete(s)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={14} /></button>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Admission No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Gender</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {loading ? (
                  [1,2].map(i => (
                    <tr key={i}>{Array.from({length:5}).map((_,j)=><td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/></td>)}</tr>
                  ))
                ) : classless.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">No unassigned students</td></tr>
                ) : classless.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} />
                        <button onClick={() => openView(s)} className="font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 text-left">{s.name}</button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">{s.admissionNo}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.gender}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openView(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="View"><Eye size={15} /></button>
                        <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg" title="Edit"><Edit size={15} /></button>
                        <button onClick={() => openDelete(s)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? 'Edit Student' : 'Add New Student'}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Saving...' : selected ? 'Save Changes' : 'Add Student'}
            </button>
          </>
        }
      >
        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">{error}</p>}
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Admission No <span className="text-xs text-slate-400 dark:text-slate-500">(auto-generated)</span>
            </label>
            <input
              name="admissionNo"
              value={form.admissionNo}
              onChange={handleFormChange}
              readOnly={!selected}
              className={`w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 font-mono ${!selected ? 'bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400' : ''}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Full Name *</label>
            <input name="name" value={form.name} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>

          {/* Class assignment toggle */}
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => setHasClass(h => !h)}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              {hasClass
                ? <ToggleRight size={22} className="text-blue-600 dark:text-blue-400" />
                : <ToggleLeft size={22} className="text-slate-400 dark:text-slate-500" />}
              Assign to a Class
              {!hasClass && <span className="text-xs text-amber-600 dark:text-amber-400 font-normal ml-1">(optional — can assign later from class page)</span>}
            </button>
          </div>

          {hasClass && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Grade</label>
                <select name="grade" value={form.grade} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
                  {Array.from({ length: 13 }, (_, i) => i + 1).map(g => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Parallel Class</label>
                <select name="parallel" value={form.parallel} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
                  {PARALLELS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Section (auto)</label>
                <input value={getSection(form.grade)} readOnly className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400" />
              </div>
              {getSection(form.grade) === 'Advanced' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Stream</label>
                  <select name="stream" value={form.stream} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
                    <option value="">Select Stream</option>
                    <option>Science</option><option>Commerce</option><option>Arts</option><option>Technology</option>
                  </select>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Medium</label>
            <select name="medium" value={form.medium} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              <option value="">— Not specified —</option>
              <option>Sinhala</option><option>English</option><option>Tamil</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Gender</label>
            <select name="gender" value={form.gender} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              <option>Male</option><option>Female</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Date of Birth</label>
            <input type="date" name="dob" value={form.dob} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Religion</label>
            <select name="religion" value={form.religion} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              {['Buddhism', 'Hinduism', 'Islam', 'Christianity', 'Other'].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Address</label>
            <input name="address" value={form.address} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Parent/Guardian Name</label>
            <input name="parentName" value={form.parentName} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Parent Phone</label>
            <input name="parentPhone" value={form.parentPhone} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Parent Email</label>
            <input type="email" name="parentEmail" value={form.parentEmail} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Status</label>
            <select name="status" value={form.status} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Academic Year</label>
            <input name="academicYear" value={form.academicYear} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title="Student Profile" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={selected.name} />
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{selected.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selected.admissionNo}</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Grade', selected.grade ? `${selected.grade} - ${selected.parallel}` : 'Unassigned'],
                ['Section', selected.section || 'Unassigned'],
                ['Gender', selected.gender],
                ['DOB', selected.dob],
                ['Religion', selected.religion],
                ['Academic Year', selected.academicYear],
                ['Stream', selected.stream || 'N/A'],
                ['Medium', selected.medium || 'N/A'],
                ['Parent', selected.parentName],
                ['Parent Phone', selected.parentPhone],
                ['Parent Email', selected.parentEmail],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{k}</p>
                  <p className="font-medium text-slate-800 dark:text-slate-100 mt-0.5">{v || 'N/A'}</p>
                </div>
              ))}
              <div className="col-span-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">Address</p>
                <p className="font-medium text-slate-800 dark:text-slate-100 mt-0.5">{selected.address || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Student" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-300">Are you sure you want to delete <strong>{selected?.name}</strong>? Their login account, marks, fees, and attendance records will also be removed. This cannot be undone.</p>
      </Modal>

      {/* ── Import Excel Modal ───────────────────────────────────────────────── */}
      {(() => {
        const invalidCount   = importRows.filter(r => r._errors.length > 0).length;
        const dupCount       = importRows.filter(r => !r._errors.length && r._dupType).length;
        const validCount     = importRows.filter(r => !r._errors.length && !r._dupType).length;
        return (
          <Modal
            isOpen={importModal}
            onClose={() => setImportModal(false)}
            title="Import Students from Excel"
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

            {/* ── Step 1: Upload ── */}
            {importStep === 'upload' && (
              <div className="space-y-5">
                {/* Instructions */}
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 p-4 space-y-2">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">How to import students</p>
                  <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                    <li>Download the template and enter the <strong>Grade</strong> and <strong>Parallel</strong> in the highlighted cells at the top</li>
                    <li>Fill in one student per row — the sample row can be deleted</li>
                    <li>Leave <em>Admission No</em> blank to auto-generate, or enter your own</li>
                    <li>Save as <strong>.xlsx</strong> or <strong>.xls</strong> and upload below</li>
                    <li>Review the preview — duplicates are flagged automatically before import</li>
                  </ol>
                </div>

                {/* Download template */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={20} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Student Import Template</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">students_import_template.xlsx · Grade + Parallel header · 12 columns</p>
                    </div>
                  </div>
                  <button onClick={downloadStudentTemplate} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 font-medium shrink-0">
                    <Download size={14} /> Download Template
                  </button>
                </div>

                {/* Column reference */}
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

                {/* File upload */}
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

            {/* ── Step 2: Preview ── */}
            {importStep === 'preview' && (
              <div className="space-y-4">
                {/* Class info detected from file */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm">
                    <span className="text-blue-500 dark:text-blue-400 font-medium text-xs uppercase tracking-wide">Grade</span>
                    <span className="font-bold text-blue-800 dark:text-blue-200">{importGrade || '—'}</span>
                    <span className="text-blue-300 dark:text-blue-600 mx-1">·</span>
                    <span className="text-blue-500 dark:text-blue-400 font-medium text-xs uppercase tracking-wide">Parallel</span>
                    <span className="font-bold text-blue-800 dark:text-blue-200">{importParallel || '—'}</span>
                    {importGrade && <span className="text-xs text-blue-500 dark:text-blue-400">· {getSection(importGrade)}</span>}
                  </div>
                  {!importGrade && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle size={13} /> Grade/Parallel cells are empty — students will be added without a class assignment
                    </p>
                  )}
                </div>

                {/* Summary badges */}
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
                        <AlertTriangle size={13} /> {dupCount} duplicate admission no{dupCount !== 1 ? 's' : ''} — will be skipped
                      </span>
                    )}
                    {invalidCount > 0 && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium">
                        <AlertCircle size={13} /> {invalidCount} row{invalidCount !== 1 ? 's' : ''} with errors — will be skipped
                      </span>
                    )}
                  </div>
                )}

                {/* Preview table */}
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
                          const rowCls = isErr  ? 'bg-red-50/50 dark:bg-red-900/5'
                                       : isDup  ? 'bg-amber-50/50 dark:bg-amber-900/5'
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
                                    <AlertTriangle size={12} />
                                    {r._dupType === 'db' ? 'Already in database' : 'Duplicate in file'}
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

      {/* ID Card Modal */}
      {idCard && <IDCardModal card={idCard} onClose={() => setIdCard(null)} />}
    </div>
  );
}
