import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Search, Trash2, Eye, X, GraduationCap, User } from 'lucide-react';
import { db } from '../db/database';
import IDCardModal from '../components/IDCardModal';
import Modal from '../components/Modal';

export default function IDCards() {
  const [cards, setCards]       = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterType, setFilterType] = useState('');
  const [viewCard, setViewCard] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await db.idCards.toArray();
      all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setCards(all);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let res = [...cards];
    if (filterType) res = res.filter(c => c.personType === filterType);
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q) ||
        c.idNumber?.toLowerCase().includes(q)
      );
    }
    setFiltered(res);
  }, [cards, search, filterType]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await db.idCards.delete(deleteTarget.id);
    setDeleteTarget(null);
    load();
  };

  const fmt = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">ID Cards</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {cards.length} credential card{cards.length !== 1 ? 's' : ''} saved
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 flex-1">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, username or ID..."
            className="bg-transparent text-sm outline-none flex-1 text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
          />
          {search && <button onClick={() => setSearch('')}><X size={13} className="text-slate-400" /></button>}
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-200 outline-none"
        >
          <option value="">All Types</option>
          <option value="teacher">Teachers</option>
          <option value="student">Students</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-36 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <CreditCard size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No ID cards found</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
            Cards are created automatically when you add teachers or students
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(card => {
            const isTeacher = card.personType === 'teacher';
            const initials = card.name
              ? card.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              : '?';
            return (
              <div
                key={card.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Card top bar */}
                <div className={`h-1.5 w-full ${isTeacher ? 'bg-blue-500' : 'bg-purple-500'}`} />

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${isTeacher ? 'bg-blue-500' : 'bg-purple-500'}`}>
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{card.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{card.idNumber}</p>
                        </div>
                        <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full shrink-0 ${
                          isTeacher
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}>
                          {isTeacher ? 'TEACHER' : 'STUDENT'}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <User size={10} className="text-slate-400 shrink-0" />
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{card.username}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Created {fmt(card.createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => setViewCard(card)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <Eye size={13} /> View Card
                    </button>
                    <button
                      onClick={() => setDeleteTarget(card)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View ID Card Modal */}
      {viewCard && <IDCardModal card={viewCard} onClose={() => setViewCard(null)} />}

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete ID Card"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
              Delete
            </button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-300">
          Delete the ID card for <strong>"{deleteTarget?.name}"</strong>? The login account is not affected. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
