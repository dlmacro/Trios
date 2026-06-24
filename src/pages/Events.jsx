import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Calendar, MapPin, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const CATEGORIES = ['Academic', 'Sports', 'Cultural', 'Administrative', 'Other'];
const AUDIENCES  = ['All', 'Students', 'Teachers', 'Parents'];

const CAT_STYLE = {
  Academic:       'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400',
  Sports:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Cultural:       'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Administrative: 'bg-slate-100  text-slate-700  dark:bg-slate-700     dark:text-slate-300',
  Other:          'bg-pink-100   text-pink-700   dark:bg-pink-900/30   dark:text-pink-400',
};
const CAT_COLOR = {
  Academic: '#3B82F6', Sports: '#10B981', Cultural: '#8B5CF6',
  Administrative: '#64748B', Other: '#EC4899',
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const EMPTY_FORM = { title: '', description: '', date: '', endDate: '', category: 'Academic', audience: 'All', venue: '' };
const inputCls = 'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors';

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

/* ── Mini calendar component ── */
function MiniCalendar({ events, year, month, onPrev, onNext, onDayClick, selectedDate }) {
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map event dates
  const evtMap = {};
  events.forEach(e => {
    if (!e.date) return;
    const start = new Date(e.date);
    const end = e.endDate ? new Date(e.endDate) : start;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = d.toISOString().split('T')[0];
      if (!evtMap[k]) evtMap[k] = [];
      evtMap[k].push(e);
    }
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"><ChevronLeft size={16} /></button>
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{MONTHS[month]} {year}</h3>
        <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"><ChevronRight size={16} /></button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map(d => <div key={d} className="text-center text-[10px] font-semibold text-slate-400 dark:text-slate-600 py-1">{d}</div>)}
      </div>
      {/* Date grid */}
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, di) => {
          const day = di + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEvts = evtMap[dateStr] || [];
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const hasEvt = dayEvts.length > 0;
          const catColor = hasEvt ? CAT_COLOR[dayEvts[0].category] || '#64748B' : null;

          return (
            <button
              key={day}
              onClick={() => onDayClick(dateStr, dayEvts)}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all ${
                isSelected ? 'ring-2 ring-blue-500' :
                isToday    ? 'bg-blue-600 text-white font-bold' :
                hasEvt     ? 'font-semibold' :
                'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              style={hasEvt && !isToday ? { background: catColor + '18', color: catColor } : {}}
              title={dayEvts.map(e => e.title).join(', ') || undefined}
            >
              {day}
              {hasEvt && <span className="w-1 h-1 rounded-full mt-0.5" style={{ background: catColor }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Events() {
  const { user } = useAuth();
  const canEdit = ['admin', 'principal'].includes(user?.role);

  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [view, setView]           = useState('list'); // 'list' | 'calendar'
  const [calYear, setCalYear]     = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]   = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate]   = useState(null);
  const [selectedDayEvts, setSelectedDayEvts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await db.events.toArray();
      all.sort((a, b) => new Date(a.date) - new Date(b.date));
      setEvents(all);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = events.filter(e => {
    if (filterCat && e.category !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.title?.toLowerCase().includes(q) && !e.description?.toLowerCase().includes(q) && !e.venue?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const today = new Date().toISOString().split('T')[0];
  const upcoming = filtered.filter(e => !e.endDate ? e.date >= today : e.endDate >= today);
  const past     = filtered.filter(e => !e.endDate ? e.date < today : e.endDate < today).reverse();

  const openAdd  = (prefillDate) => {
    setSelected(null);
    setForm({ ...EMPTY_FORM, date: prefillDate || new Date().toISOString().split('T')[0] });
    setError('');
    setModalOpen(true);
  };
  const openEdit = (e) => { setSelected(e); setForm({ ...EMPTY_FORM, ...e }); setError(''); setModalOpen(true); };
  const openDel  = (e) => { setSelected(e); setDeleteModal(true); };

  const handleSave = async (ev) => {
    ev.preventDefault();
    if (!form.title.trim() || !form.date) { setError('Title and start date are required.'); return; }
    setSaving(true);
    try {
      if (selected) await db.events.update(selected.id, form);
      else          await db.events.add(form);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    await db.events.delete(selected.id);
    setDeleteModal(false);
    load();
  };

  const handleDayClick = (dateStr, dayEvts) => {
    setSelectedDate(dateStr);
    setSelectedDayEvts(dayEvts);
  };

  const calPrev = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
  const calNext = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };

  const fmt = (d) => {
    if (!d) return '';
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-LK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  const EventCard = ({ e, faded }) => (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex gap-4 ${faded ? 'opacity-60' : ''}`}>
      {/* Date badge */}
      <div className="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl text-center" style={{ background: (CAT_COLOR[e.category] || '#64748B') + '18' }}>
        <span className="text-lg font-black leading-none" style={{ color: CAT_COLOR[e.category] || '#64748B' }}>
          {new Date((e.date || '') + 'T00:00:00').getDate() || '?'}
        </span>
        <span className="text-[9px] font-semibold uppercase" style={{ color: CAT_COLOR[e.category] || '#64748B' }}>
          {MONTHS[new Date((e.date || '') + 'T00:00:00').getMonth()]?.slice(0, 3) || '—'}
        </span>
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{e.title}</h3>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CAT_STYLE[e.category] || 'bg-slate-100 text-slate-600'}`}>{e.category}</span>
          </div>
        </div>
        {e.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{e.description}</p>}
        <div className="flex items-center flex-wrap gap-3 mt-2">
          <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            <Calendar size={11} />
            <span>{fmt(e.date)}{e.endDate && e.endDate !== e.date ? ` → ${fmt(e.endDate)}` : ''}</span>
          </div>
          {e.venue && (
            <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
              <MapPin size={11} /><span>{e.venue}</span>
            </div>
          )}
        </div>
      </div>
      {/* Actions */}
      {canEdit && (
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={() => openEdit(e)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Edit size={14} /></button>
          <button onClick={() => openDel(e)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">School Events</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{upcoming.length} upcoming · {past.length} past</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          {/* View toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            {[{k:'list',l:'List'},{k:'calendar',l:'Calendar'}].map(v => (
              <button key={v.k} onClick={() => setView(v.k)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === v.k ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>{v.l}</button>
            ))}
          </div>
          {canEdit && (
            <button onClick={() => openAdd()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
              <Plus size={15} /> Add Event
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 flex-1">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events..." className="bg-transparent text-sm outline-none flex-1 text-slate-700 dark:text-slate-200 placeholder:text-slate-400" />
          {search && <button onClick={() => setSearch('')}><X size={13} className="text-slate-400" /></button>}
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-200 outline-none">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Calendar view */}
      {view === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div>
            <MiniCalendar events={events} year={calYear} month={calMonth} onPrev={calPrev} onNext={calNext} onDayClick={handleDayClick} selectedDate={selectedDate} />
            {/* Category legend */}
            <div className="mt-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {CATEGORIES.map(c => (
                <div key={c} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CAT_COLOR[c] }} />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{c}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 space-y-3">
            {selectedDate ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-LK', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  {canEdit && <button onClick={() => openAdd(selectedDate)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"><Plus size={12} /> Add event on this day</button>}
                </div>
                {selectedDayEvts.length === 0
                  ? <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700"><p className="text-slate-400 text-sm">No events on this day</p></div>
                  : selectedDayEvts.map(e => <EventCard key={e.id} e={e} />)}
              </>
            ) : (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <Calendar size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-slate-400 dark:text-slate-500 text-sm">Click a day on the calendar to see events</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <Calendar size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">No events found</p>
            {canEdit && <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Click <strong>Add Event</strong> to schedule one</p>}
          </div>
        ) : (
          <div className="space-y-5">
            {upcoming.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Upcoming</h3>
                  <span className="text-xs text-slate-400">({upcoming.length})</span>
                </div>
                <div className="space-y-3">{upcoming.map(e => <EventCard key={e.id} e={e} />)}</div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400">Past Events</h3>
                  <span className="text-xs text-slate-400">({past.length})</span>
                </div>
                <div className="space-y-3">{past.map(e => <EventCard key={e.id} e={e} faded />)}</div>
              </div>
            )}
          </div>
        )
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Edit Event' : 'Add Event'} size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Saving...' : selected ? 'Save Changes' : 'Add Event'}
            </button>
          </>
        }
      >
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">{error}</p>}
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Event Title" required>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="e.g. Annual Sports Meet" />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className={inputCls + ' resize-none'} placeholder="Event details..." />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Start Date" required>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="End Date">
              <input type="date" value={form.endDate || ''} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inputCls} min={form.date} />
            </Field>
            <Field label="Category">
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Audience">
              <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} className={inputCls}>
                {AUDIENCES.map(a => <option key={a}>{a}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Venue / Location">
            <input value={form.venue || ''} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} className={inputCls} placeholder="e.g. School Grounds, Main Hall" />
          </Field>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Event" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteModal(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-300">Delete event <strong>"{selected?.title}"</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
