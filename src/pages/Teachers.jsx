import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Search, Edit, Trash2, Eye, X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { db } from '../db/database';
import Modal from '../components/Modal';
import IDCardModal from '../components/IDCardModal';

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'];
  const color = colors[name ? name.charCodeAt(0) % colors.length : 0];
  return (
    <div className={`w-9 h-9 ${color} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initials}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  employeeId: '', name: '', email: '', phone: '', gender: 'Female',
  dob: '', nic: '', address: '', qualifications: '', subjects: '', status: 'Active',
};

// Excel column order (matches template headers)
const XL_COLS = [
  'employeeId', 'name', 'email', 'phone', 'nic',
  'dob', 'gender', 'status', 'address', 'qualifications', 'subjects',
];

const XL_HEADERS = [
  'Employee ID *', 'Full Name *', 'Email', 'Phone', 'NIC',
  'Date of Birth (YYYY-MM-DD)', 'Gender (Male / Female)',
  'Status (Active / Inactive / On Leave)',
  'Address', 'Qualifications', 'Subjects (comma-separated)',
];

// ── Excel helpers ─────────────────────────────────────────────────────────────

function downloadTemplate() {
  const sample = [
    'T001', 'Kamal Perera', 'kamal@school.edu.lk', '0711234567', '123456789V',
    '1985-03-15', 'Male', 'Active', '45 Galle Road, Colombo',
    'B.Sc. (Hons) Mathematics', 'Mathematics, Science',
  ];

  const ws = XLSX.utils.aoa_to_sheet([XL_HEADERS, sample]);

  // Column widths
  ws['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
    { wch: 24 }, { wch: 20 }, { wch: 30 }, { wch: 32 }, { wch: 32 }, { wch: 32 },
  ];

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Teachers');
  XLSX.writeFile(wb, 'teachers_import_template.xlsx');
}

function parseXlFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // raw:false converts numbers/dates to strings; defval keeps empty cells as ''
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

        // Skip header row; filter blank rows
        const data = rows
          .slice(1)
          .filter(r => r.some(c => String(c).trim() !== ''))
          .map((r, i) => {
            const obj = { _row: i + 2, _errors: [] };
            XL_COLS.forEach((col, ci) => {
              obj[col] = String(r[ci] ?? '').trim();
            });

            // Validate required fields
            if (!obj.employeeId) obj._errors.push('Employee ID is required');
            if (!obj.name)       obj._errors.push('Full Name is required');

            // Normalise gender / status with fallback
            if (!['Male', 'Female'].includes(obj.gender))          obj.gender = 'Female';
            if (!['Active', 'Inactive', 'On Leave'].includes(obj.status)) obj.status = 'Active';

            return obj;
          });

        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Teachers() {
  // ── existing state ─────────────────────────────────────────────────────────
  const [teachers, setTeachers] = useState([]);
  const [filtered,  setFiltered]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selected,  setSelected]  = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [idCard,    setIdCard]    = useState(null);

  // ── sort state ─────────────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  // ── import state ───────────────────────────────────────────────────────────
  const [importModal, setImportModal] = useState(false);
  const [importStep,  setImportStep]  = useState('upload'); // 'upload' | 'preview'
  const [importRows,  setImportRows]  = useState([]);       // parsed rows
  const [importing,   setImporting]   = useState(false);
  const [importDone,  setImportDone]  = useState(null);     // { added, skipped }
  const [fileError,   setFileError]   = useState('');
  const fileRef = useRef(null);

  // ── data loading ───────────────────────────────────────────────────────────
  const loadTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const all = await db.teachers.toArray();
      // raw order; sorting is applied in the filter effect
      setTeachers(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  useEffect(() => {
    let res = [...teachers];
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(t =>
        t.name?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.employeeId?.toLowerCase().includes(q)
      );
    }
    res.sort((a, b) => {
      const av = (a[sortCol] ?? '').toString().toLowerCase();
      const bv = (b[sortCol] ?? '').toString().toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    setFiltered(res);
  }, [teachers, search, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronsUpDown size={13} className="opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-blue-500" />
      : <ChevronDown size={13} className="text-blue-500" />;
  };

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const openAdd    = () => { setSelected(null); setForm(EMPTY_FORM); setError(''); setModalOpen(true); };
  const openEdit   = (t) => { setSelected(t); setForm({ ...EMPTY_FORM, ...t }); setError(''); setModalOpen(true); };
  const openView   = (t) => { setSelected(t); setViewModal(true); };
  const openDelete = (t) => { setSelected(t); setDeleteModal(true); };

  const handleFormChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.employeeId.trim()) {
      setError('Employee ID and Name are required.');
      return;
    }
    setSaving(true);
    try {
      if (selected) {
        await db.teachers.update(selected.id, form);
        const linked = await db.users.where('teacherId').equals(selected.id).first();
        if (linked) {
          await db.users.update(linked.id, { name: form.name, email: form.email || linked.email });
        }
        // Update in-place so the page doesn't scroll back to the top
        const updated = { ...selected, ...form };
        setTeachers(prev => prev.map(t => t.id === selected.id ? updated : t));
        setModalOpen(false);
        return;
      } else {
        const newId = await db.teachers.add(form);
        const username = form.employeeId.toLowerCase().replace(/\s+/g, '');
        const password = 'teacher@123';
        await db.users.add({
          username, password, role: 'teacher',
          name: form.name, email: form.email || '', teacherId: newId,
        });
        const schoolSetting = await db.settings.where('key').equals('schoolName').first();
        const cardData = {
          personId: newId, personType: 'teacher',
          name: form.name, idNumber: form.employeeId, username, password,
          schoolName: schoolSetting?.value || 'School Portal',
          createdAt: new Date().toISOString(),
        };
        const cardId = await db.idCards.add(cardData);
        setModalOpen(false);
        loadTeachers();
        setIdCard({ ...cardData, id: cardId });
        return;
      }
      setModalOpen(false);
      loadTeachers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const linked = await db.users.where('teacherId').equals(selected.id).first();
    if (linked) await db.users.delete(linked.id);
    await db.timetable.where('teacherId').equals(selected.id).delete();
    await db.idCards.where('personId').equals(selected.id).and(c => c.personType === 'teacher').delete();
    await db.teachers.delete(selected.id);
    setDeleteModal(false);
    loadTeachers();
  };

  // ── Import handlers ────────────────────────────────────────────────────────
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
      const rows = await parseXlFile(file);
      if (rows.length === 0) {
        setFileError('The spreadsheet has no data rows. Please fill in teacher records and try again.');
        return;
      }
      setImportRows(rows);
      setImportStep('preview');
    } catch {
      setFileError('Could not read the file. Make sure it is a valid .xlsx or .xls spreadsheet.');
    }
    // Reset file input so same file can be re-selected if needed
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = async () => {
    const validRows = importRows.filter(r => r._errors.length === 0);
    if (validRows.length === 0) return;

    setImporting(true);
    let added = 0;
    let skipped = 0;
    const schoolSetting = await db.settings.where('key').equals('schoolName').first();
    const schoolName = schoolSetting?.value || 'School Portal';

    for (const row of validRows) {
      // Skip duplicate Employee IDs
      const exists = await db.teachers.where('employeeId').equals(row.employeeId).first();
      if (exists) { skipped++; continue; }

      const teacherData = {
        employeeId:     row.employeeId,
        name:           row.name,
        email:          row.email,
        phone:          row.phone,
        nic:            row.nic,
        dob:            row.dob,
        gender:         row.gender,
        status:         row.status,
        address:        row.address,
        qualifications: row.qualifications,
        subjects:       row.subjects,
      };

      const newId   = await db.teachers.add(teacherData);
      const username = row.employeeId.toLowerCase().replace(/\s+/g, '');
      const password = 'teacher@123';

      await db.users.add({
        username, password, role: 'teacher',
        name: row.name, email: row.email || '', teacherId: newId,
      });

      await db.idCards.add({
        personId: newId, personType: 'teacher',
        name: row.name, idNumber: row.employeeId, username, password,
        schoolName, createdAt: new Date().toISOString(),
      });

      added++;
    }

    setImporting(false);
    setImportDone({ added, skipped });
    loadTeachers();
  };

  const invalidCount = importRows.filter(r => r._errors.length > 0).length;
  const validCount   = importRows.length - invalidCount;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Teachers</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage teaching staff records</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={openImport}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <FileSpreadsheet size={15} />
            <span className="hidden sm:inline">Import Excel</span>
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Add Teacher</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 max-w-md">
          <Search size={15} className="text-slate-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or employee ID..."
            className="bg-transparent text-sm outline-none flex-1 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X size={14} className="text-slate-400 dark:text-slate-500" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 flex items-start gap-3">
                <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-3/4" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">No teachers found</div>
          ) : filtered.map(t => (
            <div key={t.id} className="p-4 flex items-start gap-3">
              <Avatar name={t.name} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => openView(t)} className="font-medium text-slate-800 dark:text-slate-100 text-sm">{t.name}</button>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${t.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{t.status}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.employeeId} · {t.phone}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{t.subjects}</p>
                <div className="flex items-center gap-1 mt-2">
                  <button onClick={() => openView(t)}   className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Eye size={14} /></button>
                  <button onClick={() => openEdit(t)}   className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"><Edit size={14} /></button>
                  <button onClick={() => openDelete(t)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={14} /></button>
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
                {[
                  { label: 'Teacher',      col: 'name' },
                  { label: 'Employee ID',  col: 'employeeId' },
                  { label: 'Email',        col: 'email' },
                  { label: 'Phone',        col: 'phone' },
                  { label: 'Subjects',     col: 'subjects' },
                  { label: 'Status',       col: 'status' },
                  { label: 'Actions',      col: null },
                ].map(({ label, col }) =>
                  col ? (
                    <th
                      key={label}
                      onClick={() => handleSort(col)}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        {label} <SortIcon col={col} />
                      </span>
                    </th>
                  ) : (
                    <th key={label} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">No teachers found</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={t.name} />
                      <div>
                        <button onClick={() => openView(t)} className="font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t.name}</button>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.gender}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{t.employeeId}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{t.email}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{t.phone}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[160px] truncate" title={t.subjects}>{t.subjects}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openView(t)}   className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="View"><Eye size={15} /></button>
                      <button onClick={() => openEdit(t)}   className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg" title="Edit"><Edit size={15} /></button>
                      <button onClick={() => openDelete(t)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? 'Edit Teacher' : 'Add New Teacher'}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Saving...' : selected ? 'Save Changes' : 'Add Teacher'}
            </button>
          </>
        }
      >
        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">{error}</p>}
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'Employee ID *', name: 'employeeId' },
            { label: 'Full Name *',   name: 'name' },
            { label: 'Email',         name: 'email',  type: 'email' },
            { label: 'Phone',         name: 'phone' },
            { label: 'NIC',           name: 'nic' },
            { label: 'Date of Birth', name: 'dob',   type: 'date' },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{f.label}</label>
              <input type={f.type || 'text'} name={f.name} value={form[f.name] || ''} onChange={handleFormChange}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Gender</label>
            <select name="gender" value={form.gender} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              <option>Male</option><option>Female</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Status</label>
            <select name="status" value={form.status} onChange={handleFormChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500">
              <option>Active</option><option>Inactive</option><option>On Leave</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Address</label>
            <input name="address" value={form.address || ''} onChange={handleFormChange}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Qualifications</label>
            <input name="qualifications" value={form.qualifications || ''} onChange={handleFormChange}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Subjects (comma-separated)</label>
            <input name="subjects" value={form.subjects || ''} onChange={handleFormChange} placeholder="e.g. Mathematics, Science"
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500" />
          </div>
        </form>
      </Modal>

      {/* ── View Modal ───────────────────────────────────────────────────────── */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title="Teacher Profile" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={selected.name} />
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{selected.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selected.employeeId}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-auto ${selected.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{selected.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Email', selected.email], ['Phone', selected.phone],
                ['Gender', selected.gender], ['DOB', selected.dob],
                ['NIC', selected.nic],      ['Subjects', selected.subjects],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{k}</p>
                  <p className="font-medium text-slate-800 dark:text-slate-100 mt-0.5">{v || 'N/A'}</p>
                </div>
              ))}
              <div className="col-span-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">Qualifications</p>
                <p className="font-medium text-slate-800 dark:text-slate-100 mt-0.5">{selected.qualifications || 'N/A'}</p>
              </div>
              <div className="col-span-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">Address</p>
                <p className="font-medium text-slate-800 dark:text-slate-100 mt-0.5">{selected.address || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Modal ─────────────────────────────────────────────────────── */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Teacher" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-300 text-sm">
          Are you sure you want to delete <strong>{selected?.name}</strong>?
          Their login account and timetable assignments will also be removed. This cannot be undone.
        </p>
      </Modal>

      {/* ── Import Excel Modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={importModal}
        onClose={() => { setImportModal(false); }}
        title="Import Teachers from Excel"
        size="xl"
        footer={
          importStep === 'upload' ? (
            <button onClick={() => setImportModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
              Close
            </button>
          ) : importDone ? (
            <button onClick={() => setImportModal(false)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Done
            </button>
          ) : (
            <>
              <button
                onClick={() => { setImportStep('upload'); setImportRows([]); setImportDone(null); }}
                className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                <Upload size={14} />
                {importing ? 'Importing…' : `Import ${validCount} Teacher${validCount !== 1 ? 's' : ''}`}
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
                {i < 1 && <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Upload ── */}
        {importStep === 'upload' && (
          <div className="space-y-5">
            {/* Instructions */}
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 p-4 space-y-3">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">How to import teachers</p>
              <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1.5 list-decimal list-inside">
                <li>Download the template spreadsheet below</li>
                <li>Fill in teacher details — one teacher per row</li>
                <li>Keep the header row intact — do not rename or remove columns</li>
                <li>Save the file as <strong>.xlsx</strong> or <strong>.xls</strong></li>
                <li>Upload it here and review before importing</li>
              </ol>
            </div>

            {/* Download template */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Teacher Import Template</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">teachers_import_template.xlsx · 11 columns</p>
                </div>
              </div>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 font-medium shrink-0"
              >
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
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
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
            {/* Summary */}
            {importDone ? (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10 p-4 flex items-center gap-3">
                <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Import complete</p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    {importDone.added} teacher{importDone.added !== 1 ? 's' : ''} added
                    {importDone.skipped > 0 && ` · ${importDone.skipped} skipped (duplicate Employee ID)`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                  <CheckCircle size={14} /> {validCount} valid
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium">
                    <AlertCircle size={14} /> {invalidCount} with errors (will be skipped)
                  </div>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                  Duplicate Employee IDs are also skipped automatically
                </p>
              </div>
            )}

            {/* Preview table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Row</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Employee ID</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Full Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Phone</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Gender</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {importRows.map(r => (
                      <tr key={r._row} className={r._errors.length > 0 ? 'bg-red-50/50 dark:bg-red-900/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}>
                        <td className="px-3 py-2 text-slate-400 dark:text-slate-500 font-mono">{r._row}</td>
                        <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">{r.employeeId || <span className="text-red-500">—</span>}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap">{r.name || <span className="text-red-500">—</span>}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.email || '—'}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.phone || '—'}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{r.gender}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {r._errors.length > 0 ? (
                            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                              <AlertCircle size={12} /> {r._errors.join('; ')}
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle size={12} /> OK
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ID Card Modal */}
      {idCard && <IDCardModal card={idCard} onClose={() => setIdCard(null)} />}
    </div>
  );
}
