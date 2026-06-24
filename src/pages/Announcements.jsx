import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Megaphone, Pin, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const PRIORITIES = ['High', 'Medium', 'Low'];
const AUDIENCES  = ['All', 'Students', 'Teachers', 'Parents'];

const PRIORITY_STYLE = {
  High:   'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
  Medium: 'bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-400',
  Low:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};
const PRIORITY_DOT = { High: 'bg-red-500', Medium: 'bg-amber-500', Low: 'bg-emerald-500' };
const AUDIENCE_STYLE = {
  All:      'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400',
  Students: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Teachers: 'bg-teal-100   text-teal-700   dark:bg-teal-900/30   dark:text-teal-400',
  Parents:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const EMPTY_FORM = { title: '', content: '', priority: 'Medium', audience: 'All', date: new Date().toISOString().split('T')[0], pinned: false };

function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors';

export default function Announcements() {
  const { user } = useAuth();
  const canEdit = ['admin', 'principal'].includes(user?.role);

  const [items, setItems]         = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterPri, setFilterPri] = useState('');
  const [filterAud, setFilterAud] = useState('');
  const [expanded, setExpanded]   = useState(null); // id of expanded card
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await db.announcements.toArray();
      all.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.date) - new Date(a.date);
      });
      setItems(all);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let res = [...items];
    if (filterPri) res = res.filter(a => a.priority === filterPri);
    if (filterAud) res = res.filter(a => a.audience === filterAud);
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(a => a.title?.toLowerCase().includes(q) || a.content?.toLowerCase().includes(q));
    }
    setFiltered(res);
  }, [items, search, filterPri, filterAud]);

  const openAdd  = () => { setSelected(null); setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] }); setError(''); setModalOpen(true); };
  const openEdit = (a) => { setSelected(a); setForm({ ...EMPTY_FORM, ...a }); setError(''); setModalOpen(true); };
  const openDel  = (a) => { setSelected(a); setDeleteModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    try {
      const data = { ...form, authorId: user?.id };
      if (selected) await db.announcements.update(selected.id, data);
      else          await db.announcements.add(data);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    await db.announcements.delete(selected.id);
    setDeleteModal(false);
    load();
  };

  const togglePin = async (a) => {
    await db.announcements.update(a.id, { pinned: !a.pinned });
    load();
  };

  const fmt = (d) => {
    if (!d) return '';
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Announcements</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{items.length} announcement{items.length !== 1 ? 's' : ''} — visible to staff and students</p>
        </div>
        {canEdit && (
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors self-start shadow-sm">
            <Plus size={15} /> New Announcement
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 flex-1">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search announcements..." className="bg-transparent text-sm outline-none flex-1 text-slate-700 dark:text-slate-200 placeholder:text-slate-400" />
          {search && <button onClick={() => setSearch('')}><X size={13} className="text-slate-400" /></button>}
        </div>
        <select value={filterPri} onChange={e => setFilterPri(e.target.value)} className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-200 outline-none">
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={filterAud} onChange={e => setFilterAud(e.target.value)} className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-200 outline-none">
          <option value="">All Audiences</option>
          {AUDIENCES.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <Megaphone size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No announcements yet</p>
          {canEdit && <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Click <strong>New Announcement</strong> to post one</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const isOpen = expanded === a.id;
            return (
              <div key={a.id} className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden transition-all ${a.pinned ? 'border-amber-200 dark:border-amber-800' : 'border-slate-200 dark:border-slate-700'}`}>
                {/* Priority accent bar */}
                <div className={`h-1 w-full ${PRIORITY_DOT[a.priority] || 'bg-slate-300'}`} />

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Dot */}
                    <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[a.priority]}`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {a.pinned && <Pin size={12} className="text-amber-500 shrink-0" />}
                          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.title}</h3>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_STYLE[a.priority]}`}>{a.priority}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${AUDIENCE_STYLE[a.audience] || 'bg-slate-100 text-slate-600'}`}>{a.audience}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">{fmt(a.date)}</span>
                        </div>
                      </div>

                      {/* Body — expandable */}
                      {a.content && (
                        <>
                          <p className={`text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed ${isOpen ? '' : 'line-clamp-2'}`}>{a.content}</p>
                          {a.content.length > 120 && (
                            <button onClick={() => setExpanded(isOpen ? null : a.id)} className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-0.5 hover:underline">
                              {isOpen ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Read more</>}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => togglePin(a)} title={a.pinned ? 'Unpin' : 'Pin'} className={`p-1.5 rounded-lg transition-colors ${a.pinned ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}>
                          <Pin size={14} />
                        </button>
                        <button onClick={() => openEdit(a)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Edit size={14} /></button>
                        <button onClick={() => openDel(a)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Edit Announcement' : 'New Announcement'} size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Saving...' : selected ? 'Save Changes' : 'Post Announcement'}
            </button>
          </>
        }
      >
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">{error}</p>}
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Title" required>
            <input name="title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Announcement title" />
          </Field>
          <Field label="Content">
            <textarea name="content" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={4} className={inputCls + ' resize-none'} placeholder="Write your announcement here..." />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Priority">
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inputCls}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Audience">
              <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} className={inputCls}>
                {AUDIENCES.map(a => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
            </Field>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={!!form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} className="w-4 h-4 rounded text-blue-600" />
            <span className="text-sm text-slate-700 dark:text-slate-200">Pin this announcement to the top</span>
          </label>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Announcement" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-300">Delete <strong>"{selected?.title}"</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
