import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Save, CheckCircle, RotateCcw } from 'lucide-react';
import { db } from '../db/database';

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTIONS = ['Primary', 'Secondary', 'Ordinary', 'Advanced'];

const SECTION_GRADES = {
  Primary:   [1, 2, 3, 4, 5],
  Secondary: [6, 7, 8, 9],
  Ordinary:  [10, 11],
  Advanced:  [12, 13],
};

const SECTION_STYLE = {
  Primary:   { dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       bar: 'from-blue-500 to-blue-600' },
  Secondary: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', bar: 'from-emerald-500 to-emerald-600' },
  Ordinary:  { dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',     bar: 'from-amber-500 to-amber-600' },
  Advanced:  { dot: 'bg-purple-500',  badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', bar: 'from-purple-500 to-purple-600' },
};

// ── National Curriculum Data ──────────────────────────────────────────────────
// Each entry: { code, name, num }
// code = base subject code  |  num = official subject number

const CURRICULUM = {
  // ── Grades 1–5 ──────────────────────────────────────────────────────────────
  Primary: [
    {
      label: 'Core Subjects',
      group: null,
      color: { header: 'bg-slate-50 dark:bg-slate-800/30', label: 'text-slate-500 dark:text-slate-400' },
      subjects: [
        { code: 'SIN',  name: 'Sinhala',                 num: '01' },
        { code: 'FL',   name: 'Tamil (First Language)',  num: '02' },
        { code: 'ENG',  name: 'English',                 num: '03' },
        { code: 'MATH', name: 'Mathematics',             num: '04' },
        { code: 'ERA',  name: 'Environmental Education', num: '10' },
        { code: 'PEH',  name: 'Health',                  num: '11' },
        { code: 'ICT',  name: 'Computing',               num: '12' },
      ],
    },
    {
      label: 'Religion — Students take one based on faith',
      group: 'Religion',
      color: { header: 'bg-amber-50/70 dark:bg-amber-900/10', label: 'text-amber-600 dark:text-amber-400' },
      subjects: [
        { code: 'BUD', name: 'Buddhism',     num: '05' },
        { code: 'HIN', name: 'Hinduism',     num: '06' },
        { code: 'ISL', name: 'Islam',        num: '07' },
        { code: 'CHR', name: 'Christianity', num: '08' },
        { code: 'CTH', name: 'Catholicism',  num: '09' },
      ],
    },
    {
      label: 'Aesthetic Subjects',
      group: 'Aesthetics',
      color: { header: 'bg-purple-50/70 dark:bg-purple-900/10', label: 'text-purple-600 dark:text-purple-400' },
      subjects: [
        { code: 'ART', name: 'Art',     num: '13' },
        { code: 'MUS', name: 'Music',   num: '14' },
        { code: 'DAN', name: 'Dancing', num: '15' },
        { code: 'DRA', name: 'Drama',   num: '16' },
      ],
    },
  ],

  // ── Grades 6–9 ──────────────────────────────────────────────────────────────
  Secondary: [
    {
      label: 'Religion — Students take one based on faith',
      group: 'Religion',
      color: { header: 'bg-amber-50/70 dark:bg-amber-900/10', label: 'text-amber-600 dark:text-amber-400' },
      subjects: [
        { code: 'BUD', name: 'Buddhism',     num: '01' },
        { code: 'HIN', name: 'Hinduism',     num: '02' },
        { code: 'ISL', name: 'Islam',        num: '03' },
        { code: 'CTH', name: 'Catholicism',  num: '04' },
        { code: 'CHR', name: 'Christianity', num: '05' },
      ],
    },
    {
      label: 'Core Subjects',
      group: null,
      color: { header: 'bg-slate-50 dark:bg-slate-800/30', label: 'text-slate-500 dark:text-slate-400' },
      subjects: [
        { code: 'SIN', name: 'Sinhala',        num: '06' },
        { code: 'TAM', name: 'Tamil',           num: '07' },
        { code: 'ENG', name: 'English',         num: '08' },
        { code: 'MTH', name: 'Mathematics',     num: '09' },
        { code: 'SCI', name: 'Science',         num: '10' },
        { code: 'HIS', name: 'History',         num: '11' },
        { code: 'GEO', name: 'Geography',       num: '12' },
        { code: 'CVC', name: 'Civic Education', num: '13' },
        { code: 'HLT', name: 'Health',          num: '14' },
        { code: 'PTS', name: 'P.T.S',           num: '15' },
      ],
    },
    {
      label: 'Aesthetic Subjects',
      group: 'Aesthetics',
      color: { header: 'bg-purple-50/70 dark:bg-purple-900/10', label: 'text-purple-600 dark:text-purple-400' },
      subjects: [
        { code: 'ART', name: 'Art',           num: '16' },
        { code: 'DAN', name: 'Dancing',       num: '17' },
        { code: 'EMU', name: 'Eastern Music', num: '18' },
        { code: 'WMU', name: 'Western Music', num: '19' },
        { code: 'DRA', name: 'Drama',         num: '20' },
      ],
    },
  ],

  // ── Grades 10–11 (GCE O/L) ──────────────────────────────────────────────────
  Ordinary: [
    {
      label: 'Religion — Students take one based on faith',
      group: 'Religion',
      color: { header: 'bg-amber-50/70 dark:bg-amber-900/10', label: 'text-amber-600 dark:text-amber-400' },
      subjects: [
        { code: 'BUD', name: 'Buddhism',     num: '11' },
        { code: 'HIN', name: 'Hinduism',     num: '12' },
        { code: 'CTH', name: 'Catholicism',  num: '14' },
        { code: 'CHR', name: 'Christianity', num: '15' },
        { code: 'ISL', name: 'Islam',        num: '16' },
      ],
    },
    {
      label: 'Core / Compulsory Subjects',
      group: null,
      color: { header: 'bg-slate-50 dark:bg-slate-800/30', label: 'text-slate-500 dark:text-slate-400' },
      subjects: [
        { code: 'SLL', name: 'Sinhala Language & Literature', num: '21' },
        { code: 'TLL', name: 'Tamil Language & Literature',   num: '22' },
        { code: 'ENG', name: 'English Language',              num: '31' },
        { code: 'MTH', name: 'Mathematics',                   num: '32' },
        { code: 'HIS', name: 'History',                       num: '33' },
        { code: 'SCI', name: 'Science',                       num: '34' },
      ],
    },
    {
      label: 'Optional I — Additional Subjects',
      group: 'Optional',
      color: { header: 'bg-teal-50/70 dark:bg-teal-900/10', label: 'text-teal-600 dark:text-teal-400' },
      subjects: [
        { code: 'BAS',   name: 'Business & Accounting Studies',             num: '60' },
        { code: 'GEO',   name: 'Geography',                                 num: '61' },
        { code: 'CVC',   name: 'Civic Education',                           num: '62' },
        { code: 'ENT',   name: 'Entrepreneurship Studies',                  num: '63' },
        { code: 'SLS',   name: 'Second Language (Sinhala)',                 num: '64' },
        { code: 'SLT',   name: 'Second Language (Tamil)',                   num: '65' },
        { code: 'PALL',  name: 'Pali',                                      num: '66' },
        { code: 'SANL',  name: 'Sanskrit',                                  num: '67' },
        { code: 'FREL',  name: 'French',                                    num: '68' },
        { code: 'GERL',  name: 'German',                                    num: '69' },
        { code: 'HINL',  name: 'Hindi',                                     num: '70' },
        { code: 'JAPL',  name: 'Japanese',                                  num: '71' },
        { code: 'ARBL',  name: 'Arabic',                                    num: '72' },
        { code: 'KORL',  name: 'Korean',                                    num: '73' },
        { code: 'CHIL',  name: 'Chinese',                                   num: '74' },
        { code: 'RUSL',  name: 'Russian',                                   num: '75' },
      ],
    },
    {
      label: 'Optional II — Aesthetic Subjects',
      group: 'Aesthetics',
      color: { header: 'bg-purple-50/70 dark:bg-purple-900/10', label: 'text-purple-600 dark:text-purple-400' },
      subjects: [
        { code: 'OMU',  name: 'Music (Oriental)',                num: '40' },
        { code: 'WMU',  name: 'Music (Western)',                 num: '41' },
        { code: 'CMU',  name: 'Music (Carnatic)',                num: '42' },
        { code: 'ART',  name: 'Art',                             num: '43' },
        { code: 'ODN',  name: 'Dancing (Oriental)',              num: '44' },
        { code: 'BDN',  name: 'Dancing (Bharata)',               num: '45' },
        { code: 'AELT', name: 'English Literary Texts',          num: '46' },
        { code: 'ASLT', name: 'Sinhala Literary Texts',          num: '47' },
        { code: 'ATLT', name: 'Tamil Literary Texts',            num: '48' },
        { code: 'AALT', name: 'Arabic Literary Texts',           num: '49' },
        { code: 'DTS',  name: 'Drama & Theatre (Sinhala)',       num: '50' },
        { code: 'DTT',  name: 'Drama & Theatre (Tamil)',         num: '51' },
        { code: 'DTE',  name: 'Drama & Theatre (English)',       num: '52' },
      ],
    },
    {
      label: 'Optional III — Technical Subjects',
      group: 'Technical',
      color: { header: 'bg-orange-50/70 dark:bg-orange-900/10', label: 'text-orange-600 dark:text-orange-400' },
      subjects: [
        { code: 'ICT',  name: 'ICT',                                        num: '80' },
        { code: 'AFT',  name: 'Agri & Food Technology',                     num: '81' },
        { code: 'ABT',  name: 'Aqua Bio Technology',                        num: '82' },
        { code: 'ACR',  name: 'Art & Crafts',                               num: '84' },
        { code: 'HE',   name: 'Home Economics',                             num: '85' },
        { code: 'HPE',  name: 'Physical Education',                         num: '86' },
        { code: 'CMS',  name: 'Media Studies',                              num: '87' },
        { code: 'DCT',  name: 'Construction Technology',                    num: '88' },
        { code: 'DMT',  name: 'Mechanical Technology',                      num: '89' },
        { code: 'DEET', name: 'Electronic Technology',                      num: '90' },
        { code: 'EWSS', name: 'Electronic Writing & Shorthand (Sinhala)',   num: '92' },
        { code: 'EWST', name: 'Electronic Writing & Shorthand (Tamil)',     num: '93' },
        { code: 'EWSE', name: 'Electronic Writing & Shorthand (English)',   num: '94' },
      ],
    },
  ],

  // ── Grades 12–13 (GCE A/L) ──────────────────────────────────────────────────
  Advanced: [
    {
      label: 'Common / General',
      group: 'Common',
      color: { header: 'bg-slate-50 dark:bg-slate-800/30', label: 'text-slate-500 dark:text-slate-400' },
      subjects: [
        { code: 'CGT', name: 'Common General Test', num: '12' },
        { code: 'GEN', name: 'General English',     num: '13' },
      ],
    },
    {
      label: 'Science & Mathematics',
      group: 'Science',
      color: { header: 'bg-emerald-50/70 dark:bg-emerald-900/10', label: 'text-emerald-600 dark:text-emerald-400' },
      subjects: [
        { code: 'PHY', name: 'Physics',              num: '01' },
        { code: 'CHE', name: 'Chemistry',            num: '02' },
        { code: 'MTH', name: 'Mathematics',          num: '07' },
        { code: 'AGR', name: 'Agricultural Science', num: '08' },
        { code: 'BIO', name: 'Biology',              num: '09' },
        { code: 'CMB', name: 'Combined Mathematics', num: '10' },
        { code: 'HMT', name: 'Higher Mathematics',   num: '11' },
      ],
    },
    {
      label: 'Technology',
      group: 'Technology',
      color: { header: 'bg-blue-50/70 dark:bg-blue-900/10', label: 'text-blue-600 dark:text-blue-400' },
      subjects: [
        { code: 'CTE', name: 'Civil Technology',                        num: '14' },
        { code: 'MTE', name: 'Mechanical Technology',                   num: '15' },
        { code: 'ETE', name: 'Electrical, Electronic Technology',       num: '16' },
        { code: 'FTE', name: 'Food Technology',                         num: '17' },
        { code: 'ATE', name: 'Agri Technology',                         num: '18' },
        { code: 'BRT', name: 'Bio-Resource Technology',                 num: '19' },
        { code: 'ICT', name: 'Information and Communication Technology', num: '20' },
        { code: 'ENT', name: 'Engineering Technology',                  num: '65' },
        { code: 'BST', name: 'Bio systems Technology',                  num: '66' },
        { code: 'SFT', name: 'Science for Technology',                  num: '67' },
      ],
    },
    {
      label: 'Commerce & Business',
      group: 'Commerce',
      color: { header: 'bg-amber-50/70 dark:bg-amber-900/10', label: 'text-amber-600 dark:text-amber-400' },
      subjects: [
        { code: 'ECN',  name: 'Economics',           num: '21' },
        { code: 'BUST', name: 'Business Statistics', num: '31' },
        { code: 'BUS',  name: 'Business Studies',    num: '32' },
        { code: 'ACC',  name: 'Accounting',          num: '33' },
      ],
    },
    {
      label: 'Arts & Social Sciences',
      group: 'Arts',
      color: { header: 'bg-pink-50/70 dark:bg-pink-900/10', label: 'text-pink-600 dark:text-pink-400' },
      subjects: [
        { code: 'GEO', name: 'Geography',                   num: '22' },
        { code: 'PSC', name: 'Political Science',           num: '23' },
        { code: 'LGC', name: 'Logic & Scientific Method',  num: '24' },
        { code: 'IHI', name: 'Indian History',             num: '25A' },
        { code: 'EHI', name: 'European History',           num: '25B' },
        { code: 'MHI', name: 'History of the Modern World',num: '25C' },
        { code: 'HEC', name: 'Home Economics',             num: '28' },
        { code: 'MED', name: 'Communication & Media Studies',num: '29' },
      ],
    },
    {
      label: 'Languages',
      group: 'Languages',
      color: { header: 'bg-indigo-50/70 dark:bg-indigo-900/10', label: 'text-indigo-600 dark:text-indigo-400' },
      subjects: [
        { code: 'SIN', name: 'Sinhala',  num: '71' },
        { code: 'TAM', name: 'Tamil',    num: '72' },
        { code: 'ENG', name: 'English',  num: '73' },
        { code: 'PAL', name: 'Pali',     num: '74' },
        { code: 'SAN', name: 'Sanskrit', num: '75' },
        { code: 'ARA', name: 'Arabic',   num: '78' },
        { code: 'MAL', name: 'Malay',    num: '79' },
        { code: 'FRE', name: 'French',   num: '81' },
        { code: 'GER', name: 'German',   num: '82' },
        { code: 'RUS', name: 'Russian',  num: '83' },
        { code: 'HIN', name: 'Hindi',    num: '84' },
        { code: 'CHI', name: 'Chinese',  num: '86' },
        { code: 'JAP', name: 'Japanese', num: '87' },
      ],
    },
    {
      label: 'Religion & Civilization',
      group: 'Religion',
      color: { header: 'bg-amber-50/70 dark:bg-amber-900/10', label: 'text-amber-600 dark:text-amber-400' },
      subjects: [
        { code: 'BUD', name: 'Buddhism',                   num: '41' },
        { code: 'SVN', name: 'Hinduism',                   num: '42' },
        { code: 'CHR', name: 'Christianity',               num: '43' },
        { code: 'ISL', name: 'Islam',                      num: '44' },
        { code: 'BCS', name: 'Buddhist Civilization',      num: '45' },
        { code: 'HCS', name: 'Hindu Civilization',         num: '46' },
        { code: 'ICS', name: 'Islam Civilization',         num: '47' },
        { code: 'GCS', name: 'Greek & Roman Civilization', num: '48' },
        { code: 'CCS', name: 'Christian Civilization',     num: '49' },
      ],
    },
    {
      label: 'Aesthetic Subjects',
      group: 'Aesthetics',
      color: { header: 'bg-purple-50/70 dark:bg-purple-900/10', label: 'text-purple-600 dark:text-purple-400' },
      subjects: [
        { code: 'ART', name: 'Art',                           num: '51' },
        { code: 'DAK', name: 'Dancing (Indigenous-Kandyan)',  num: '52A' },
        { code: 'DAL', name: 'Dancing (Indigenous-Low country)', num: '52B' },
        { code: 'DAS', name: 'Dancing (Indigenous-Sabaragamu)', num: '52C' },
        { code: 'DAB', name: 'Dancing (Bharatha)',            num: '53' },
        { code: 'OMU', name: 'Oriental Music',               num: '54' },
        { code: 'CMU', name: 'Carnatic Music',               num: '55' },
        { code: 'WMU', name: 'Western Music',                num: '56' },
        { code: 'DTS', name: 'Drama & Theatre (Sinhala)',    num: '57' },
        { code: 'DTT', name: 'Drama & Theatre (Tamil)',      num: '58' },
        { code: 'DTE', name: 'Drama & Theatre (English)',    num: '59' },
      ],
    },
  ],
};

// ── Helper to build a regex that matches a code prefix followed by a digit/letter ─
function codePattern(code) {
  return new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w`);
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onChange(); }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
      }`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Subjects() {
  const [activeTab, setActiveTab]     = useState('Primary');
  const [dbActive,    setDbActive]    = useState(new Set());   // what's saved in DB
  const [localActive, setLocalActive] = useState(new Set());   // current UI selection
  const [loading,  setLoading]        = useState(true);
  const [saving,   setSaving]         = useState(false);
  const [saved,    setSaved]          = useState(false);

  // ── Load saved selection from settings ──────────────────────────────────────
  const loadSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const active = new Set();

      // Try reading from settings first
      const row = await db.settings.where('key').equals('enabledSubjects').first();
      if (row) {
        const stored = JSON.parse(row.value);
        for (const [section, codes] of Object.entries(stored)) {
          for (const code of codes) {
            active.add(`${section}|${code}`);
          }
        }
      } else {
        // Derive from existing db.subjects (backwards-compat for existing installs)
        const allSubs = await db.subjects.toArray();
        for (const section of SECTIONS) {
          const sectionSubs = allSubs.filter(s => s.section === section);
          for (const cat of CURRICULUM[section]) {
            for (const sub of cat.subjects) {
              const pat = codePattern(sub.code);
              if (sectionSubs.some(s => pat.test(s.code))) {
                active.add(`${section}|${sub.code}`);
              }
            }
          }
        }
      }

      setDbActive(active);
      setLocalActive(new Set(active));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  // ── Toggle a single subject ─────────────────────────────────────────────────
  const toggle = (section, code) => {
    const key = `${section}|${code}`;
    setLocalActive(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setSaved(false);
  };

  // ── Save: persist to settings + sync db.subjects ────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      // Build JSON to store in settings
      const selection = {};
      for (const section of SECTIONS) {
        selection[section] = [];
        for (const cat of CURRICULUM[section]) {
          for (const sub of cat.subjects) {
            if (localActive.has(`${section}|${sub.code}`)) {
              selection[section].push(sub.code);
            }
          }
        }
      }

      // Upsert into db.settings
      const existing = await db.settings.where('key').equals('enabledSubjects').first();
      if (existing) {
        await db.settings.update(existing.id, { value: JSON.stringify(selection) });
      } else {
        await db.settings.add({ key: 'enabledSubjects', value: JSON.stringify(selection) });
      }

      // Sync db.subjects for all sections
      const allSubs = await db.subjects.toArray();
      for (const section of SECTIONS) {
        const grades      = SECTION_GRADES[section];
        const sectionSubs = allSubs.filter(s => s.section === section);

        // Grade code suffix format differs by section
        const suffix = section === 'Primary'
          ? (g) => `0${g}`
          : (g) => String(g);

        for (const cat of CURRICULUM[section]) {
          for (const sub of cat.subjects) {
            const key       = `${section}|${sub.code}`;
            const isEnabled = localActive.has(key);
            const pat       = codePattern(sub.code);
            const existing  = sectionSubs.filter(s => pat.test(s.code));

            if (isEnabled && existing.length === 0) {
              const type = (!cat.group || cat.group === 'Religion') ? 'Core' : 'Elective';
              await db.subjects.bulkAdd(
                grades.map(g => ({
                  code:      `${sub.code}${suffix(g)}`,
                  name:      sub.name,
                  type,
                  grade:     g,
                  section,
                  group:     cat.group || null,
                  teacherId: null,
                }))
              );
            } else if (!isEnabled && existing.length > 0) {
              await Promise.all(existing.map(r => db.subjects.delete(r.id)));
            }
          }
        }
      }

      setDbActive(new Set(localActive));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Subject save error:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Derived state ────────────────────────────────────────────────────────────
  const hasChanges = [...localActive].some(k => !dbActive.has(k)) ||
                     [...dbActive].some(k => !localActive.has(k));

  const tabCurriculum = CURRICULUM[activeTab];
  const grades        = SECTION_GRADES[activeTab];
  const style         = SECTION_STYLE[activeTab];

  const countEnabled = (cats) =>
    cats.reduce((n, cat) => n + cat.subjects.filter(s => localActive.has(`${activeTab}|${s.code}`)).length, 0);
  const countTotal = (cats) =>
    cats.reduce((n, cat) => n + cat.subjects.length, 0);

  const enabledCount = countEnabled(tabCurriculum);
  const totalCount   = countTotal(tabCurriculum);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Subjects</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            National curriculum — toggle to enable subjects offered by this school
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={(!hasChanges && !saved) || saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            saved
              ? 'bg-emerald-600 text-white'
              : hasChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
          }`}
        >
          {saved
            ? <><CheckCircle size={15} /> Saved</>
            : <><Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}</>
          }
        </button>
      </div>

      {/* Section tabs */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1 w-max min-w-full">
          {SECTIONS.map(s => (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === s
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Color bar */}
          <div className={`h-1.5 bg-gradient-to-r ${style.bar}`} />

          {/* Section header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${style.dot}`} />
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">{activeTab} Section</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Grades {grades[0]}–{grades[grades.length - 1]}
                  {' · '}{enabledCount} of {totalCount} subjects enabled
                </p>
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${style.badge}`}>
              {enabledCount}/{totalCount}
            </span>
          </div>

          {/* Subject groups */}
          <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {tabCurriculum.map((cat, ci) => {
              const catEnabled = cat.subjects.filter(s => localActive.has(`${activeTab}|${s.code}`)).length;
              return (
                <div key={ci}>
                  {/* Group header */}
                  <div className={`px-5 py-2.5 flex items-center justify-between ${cat.color.header}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide ${cat.color.label}`}>
                      {cat.label}
                    </p>
                    <span className="text-xs text-slate-400 dark:text-slate-500 bg-white/60 dark:bg-slate-800/60 px-2 py-0.5 rounded-full">
                      {catEnabled}/{cat.subjects.length}
                    </span>
                  </div>

                  {/* Subject rows */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/20">
                    {cat.subjects.map(sub => {
                      const key     = `${activeTab}|${sub.code}`;
                      const isOn    = localActive.has(key);
                      const wasOn   = dbActive.has(key);
                      const changed = isOn !== wasOn;

                      return (
                        <div
                          key={`${sub.code}-${sub.num}`}
                          onClick={() => toggle(activeTab, sub.code)}
                          className={`px-5 py-3 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                            changed
                              ? isOn
                                ? 'bg-blue-50/60 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                : 'bg-red-50/40 dark:bg-red-900/5 hover:bg-red-50/60 dark:hover:bg-red-900/10'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          {/* Code + name */}
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded shrink-0 min-w-[3.5rem] text-center">
                              {sub.code}
                            </span>
                            <div className="min-w-0">
                              <p className={`text-sm font-medium truncate ${
                                isOn
                                  ? 'text-slate-800 dark:text-slate-100'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}>
                                {sub.name}
                              </p>
                              {changed && (
                                <p className={`text-xs ${
                                  isOn
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-red-500 dark:text-red-400'
                                }`}>
                                  {isOn ? '+ Will be added' : '− Will be removed'}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Subject number + toggle */}
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="hidden sm:inline text-xs text-slate-300 dark:text-slate-600 font-mono">
                              {sub.num}
                            </span>
                            <Toggle checked={isOn} onChange={() => toggle(activeTab, sub.code)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {tabCurriculum.length === 0 && (
            <div className="py-14 text-center">
              <BookOpen size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 dark:text-slate-500 text-sm">No subjects defined for this section</p>
            </div>
          )}
        </div>
      )}

      {/* Sticky save bar */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-5 py-3 flex items-center gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">You have unsaved changes</p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 font-medium"
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={() => { setLocalActive(new Set(dbActive)); setSaved(false); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
