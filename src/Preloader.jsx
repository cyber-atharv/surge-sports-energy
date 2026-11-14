import { useEffect, useState, useRef } from 'react';
import { useProgress } from '@react-three/drei';

// Circular wheel-outline loader: an SVG ring shaped like a bicycle wheel
// (rim + spokes) draws itself in as an actual 0-100% counter ticks up,
// tracking real page load instead of a canned animation. Sits above
// everything until the 3D assets finish loading, then fades out and unmounts.
export default function Preloader() {
  const [percent, setPercent] = useState(0);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const targetRef = useRef(0);
  const { active, progress } = useProgress();

  useEffect(() => {
    let raf;
    const tick = () => {
      setPercent((p) => {
        const target = targetRef.current;
        const next = p + (target - p) * 0.08 + 0.25;
        return Math.min(next, target);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (active) {
      targetRef.current = Math.max(targetRef.current, Math.min(progress, 95));
    } else {
      targetRef.current = 100;
    }
  }, [active, progress]);

  // Safety fallback if progress is already complete or doesn't trigger active
  useEffect(() => {
    const timer = setTimeout(() => {
      targetRef.current = 100;
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (percent >= 100 && !done) {
      setDone(true);
      const t = setTimeout(() => setHidden(true), 600);
      return () => clearTimeout(t);
    }
  }, [percent, done]);

  if (hidden) return null;

  const shown = Math.floor(percent);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-600 ease-out ${
        done ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="relative w-[180px] h-[180px] flex items-center justify-center">
        <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
          <circle cx="90" cy="90" r={radius} fill="none" stroke="#ffffff14" strokeWidth="2" />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * Math.PI) / 6;
            const x1 = 90 + Math.cos(angle) * 14;
            const y1 = 90 + Math.sin(angle) * 14;
            const x2 = 90 + Math.cos(angle) * (radius - 4);
            const y2 = 90 + Math.sin(angle) * (radius - 4);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#ffffff10"
                strokeWidth="1"
              />
            );
          })}
          <circle cx="90" cy="90" r="14" fill="none" stroke="#ffffff1a" strokeWidth="2" />
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#ef4444"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-75"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-white text-3xl font-bold leading-none tracking-tight">
            {shown}
          </span>
          <span className="text-[10px] text-gray-500 uppercase tracking-[0.25em] mt-1 font-semibold">
            {shown >= 100 ? 'READY' : 'LOADING'}
          </span>
        </div>
      </div>
    </div>
  );
}
