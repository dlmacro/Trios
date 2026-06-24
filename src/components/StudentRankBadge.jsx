import { useState, useEffect } from 'react';
import { db } from '../db/database';
import { useAuth } from '../context/AuthContext';

const RANK_CONFIG = {
  1: {
    emoji: '🥇',
    title: 'Class Champion',
    subtitle: 'Top of the class!',
    from: '#F59E0B',
    to: '#B45309',
    pole: '#92400E',
    text: '#451A03',
    subtext: '#78350F',
    shimmer: 'rgba(255,240,180,0.55)',
    stars: ['✦', '★', '✦', '★', '✦'],
  },
  2: {
    emoji: '🥈',
    title: '2nd in Class',
    subtitle: 'Outstanding performance!',
    from: '#94A3B8',
    to: '#475569',
    pole: '#334155',
    text: '#0F172A',
    subtext: '#1E293B',
    shimmer: 'rgba(255,255,255,0.35)',
    stars: ['✦', '★', '✦'],
  },
  3: {
    emoji: '🥉',
    title: '3rd in Class',
    subtitle: 'Keep it up!',
    from: '#FB923C',
    to: '#C2410C',
    pole: '#9A3412',
    text: '#431407',
    subtext: '#7C2D12',
    shimmer: 'rgba(255,220,180,0.45)',
    stars: ['✦', '★', '✦'],
  },
};

const STYLES = `
  @keyframes srb-wave {
    0%   { transform: skewX(0deg)    scaleY(1);    }
    18%  { transform: skewX(-2.5deg) scaleY(0.965); }
    36%  { transform: skewX(3deg)    scaleY(1.025); }
    54%  { transform: skewX(-1.8deg) scaleY(0.978); }
    72%  { transform: skewX(1.5deg)  scaleY(1.012); }
    90%  { transform: skewX(-0.6deg) scaleY(0.994); }
    100% { transform: skewX(0deg)    scaleY(1);    }
  }
  @keyframes srb-shimmer {
    0%   { left: -70%; }
    100% { left: 130%; }
  }
  @keyframes srb-emoji {
    0%,100% { transform: scale(1)    rotate(-4deg); }
    50%      { transform: scale(1.18) rotate(4deg);  }
  }
  @keyframes srb-star-a {
    0%,100% { transform: translateY(0)   rotate(0deg);  opacity: 0.85; }
    50%     { transform: translateY(-7px) rotate(25deg); opacity: 0.45; }
  }
  @keyframes srb-star-b {
    0%,100% { transform: translateY(0)   rotate(0deg);   opacity: 0.6; }
    50%     { transform: translateY(-5px) rotate(-20deg); opacity: 0.3; }
  }
  @keyframes srb-pulse-bar {
    0%,100% { opacity: 1; }
    50%     { opacity: 0.55; }
  }
`;

export default function StudentRankBadge() {
  const { user } = useAuth();
  const [rank, setRank] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (user?.role !== 'student') { setLoaded(true); return; }

    async function compute() {
      try {
        const userRecord = await db.users.get(user.id);
        if (!userRecord?.studentId) { setLoaded(true); return; }

        const student = await db.students.get(userRecord.studentId);
        if (!student) { setLoaded(true); return; }

        // All students in same grade + parallel
        const allStudents = await db.students.toArray();
        const classmates = allStudents.filter(
          s => Number(s.grade) === Number(student.grade) && s.parallel === student.parallel,
        );
        if (classmates.length < 2) { setLoaded(true); return; }

        // Average score per classmate
        const avgs = await Promise.all(
          classmates.map(async s => {
            const marks = await db.marks.where('studentId').equals(s.id).toArray();
            const avg = marks.length
              ? marks.reduce((sum, m) => sum + (m.marks ?? m.score ?? 0), 0) / marks.length
              : 0;
            return { id: s.id, avg };
          }),
        );

        avgs.sort((a, b) => b.avg - a.avg);
        const pos = avgs.findIndex(s => s.id === userRecord.studentId);
        if (pos >= 0 && pos < 3 && avgs[pos].avg > 0) setRank(pos + 1);
      } catch {
        /* silently skip */
      }
      setLoaded(true);
    }

    compute();
  }, [user]);

  if (!loaded || !rank) return null;

  const cfg = RANK_CONFIG[rank];

  return (
    <>
      <style>{STYLES}</style>

      {/* Flag banner */}
      <div
        style={{
          background: `linear-gradient(135deg, ${cfg.from} 0%, ${cfg.to} 100%)`,
          animation: 'srb-wave 3.2s ease-in-out infinite',
          transformOrigin: 'left center',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
        className="w-full flex items-center justify-between px-4 py-2"
      >
        {/* Shimmer sweep */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '45%',
            background: `linear-gradient(90deg, transparent 0%, ${cfg.shimmer} 50%, transparent 100%)`,
            animation: 'srb-shimmer 2.6s linear infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Left: pole + emoji + text */}
        <div className="flex items-center gap-2.5 relative z-10">
          {/* Flag pole */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div
              style={{
                width: 4,
                height: 36,
                background: `linear-gradient(to bottom, ${cfg.pole}, ${cfg.from})`,
                borderRadius: 2,
                animation: 'srb-pulse-bar 2s ease-in-out infinite',
              }}
            />
            <div style={{ width: 8, height: 3, background: cfg.pole, borderRadius: 2 }} />
          </div>

          {/* Rank emoji */}
          <span
            style={{
              fontSize: 28,
              lineHeight: 1,
              display: 'inline-block',
              animation: 'srb-emoji 2.4s ease-in-out infinite',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
            }}
          >
            {cfg.emoji}
          </span>

          {/* Text */}
          <div style={{ lineHeight: 1.25 }}>
            <p style={{ color: cfg.text, fontWeight: 800, fontSize: 13, letterSpacing: '0.01em' }}>
              {cfg.title}
            </p>
            <p style={{ color: cfg.subtext, fontSize: 10.5, fontWeight: 500, opacity: 0.85 }}>
              {cfg.subtitle}
            </p>
          </div>
        </div>

        {/* Right: floating stars */}
        <div className="flex items-center gap-1 relative z-10" aria-hidden>
          {cfg.stars.map((star, i) => (
            <span
              key={i}
              style={{
                fontSize: i % 2 === 1 ? 16 : 10,
                color: cfg.text,
                display: 'inline-block',
                animation: i % 2 === 0 ? 'srb-star-a' : 'srb-star-b',
                animationDuration: `${1.4 + i * 0.35}s`,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                animationDelay: `${i * 0.18}s`,
              }}
            >
              {star}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
