import { useEffect, useRef, useState } from 'react';

/**
 * Friendly mascot for the sign-in pages. Pure SVG + CSS (see the "avatar" block in index.css).
 * mood: idle | cover (eyes covered, for password fields) | peek | happy | sad
 * look: optional {x, y} in -1..1 to aim the eyes (e.g. while typing); otherwise they follow the pointer.
 */
export default function Avatar({ mood = 'idle', look = null, size = 132, className = '' }) {
  const ref = useRef(null);
  const [eye, setEye] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let raf = 0;
    const onMove = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 260);
        setEye({ x: (dx / d) * k, y: (dy / d) * k });
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const v = look || eye;
  const pupil = { transform: `translate(${(v.x * 5.5).toFixed(2)}px, ${(v.y * 4.5).toFixed(2)}px)` };
  const face = { transform: `translate(${(v.x * 2).toFixed(2)}px, ${(v.y * 1.4).toFixed(2)}px)` };

  return (
    <svg
      ref={ref}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      data-mood={mood}
      className={`av ${className}`}
      role="img"
      aria-label={
        mood === 'cover' || mood === 'peek' ? 'Mascot covering its eyes while you type your password'
          : mood === 'happy' ? 'Mascot smiling' : mood === 'sad' ? 'Mascot looking worried' : 'Friendly mascot'
      }
    >
      <defs>
        <linearGradient id="av-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b07ca4" />
          <stop offset="0.55" stopColor="#8d5e81" />
          <stop offset="1" stopColor="#5b3c53" />
        </linearGradient>
        <radialGradient id="av-shine" cx="0.3" cy="0.2" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="av-hand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbeaf6" />
          <stop offset="1" stopColor="#ecc9e1" />
        </linearGradient>
      </defs>

      <ellipse className="av-shadow" cx="100" cy="184" rx="52" ry="8" fill="#000" opacity="0.12" />

      <g className="av-body">
        {/* tuft */}
        <g className="av-tuft">
          <path d="M100 52 C100 40 98 34 94 28" stroke="#5b3c53" strokeWidth="4" strokeLinecap="round" fill="none" />
          <ellipse cx="90" cy="26" rx="9" ry="6" transform="rotate(-30 90 26)" fill="#c59dbb" />
          <ellipse cx="106" cy="30" rx="8" ry="5.5" transform="rotate(25 106 30)" fill="#dcc3d6" />
        </g>

        <rect x="38" y="48" width="124" height="128" rx="60" fill="url(#av-body)" />
        <rect x="38" y="48" width="124" height="128" rx="60" fill="url(#av-shine)" />

        <g className="av-face" style={face}>
          {/* cheeks */}
          <circle cx="62" cy="126" r="9" fill="#ff9fc2" opacity="0.45" />
          <circle cx="138" cy="126" r="9" fill="#ff9fc2" opacity="0.45" />

          {/* eyebrows */}
          <path className="av-brow av-brow-l" d="M66 78 Q80 71 94 78" stroke="#3b2535" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path className="av-brow av-brow-r" d="M106 78 Q120 71 134 78" stroke="#3b2535" strokeWidth="4" strokeLinecap="round" fill="none" />

          {/* eyes */}
          <g className="av-eye">
            <ellipse cx="80" cy="100" rx="15" ry="17" fill="#fff" />
            <circle cx="80" cy="100" r="8" fill="#2a1a27" style={pupil} className="av-pupil" />
            <circle cx="83" cy="96" r="2.6" fill="#fff" style={pupil} className="av-pupil" />
          </g>
          <g className="av-eye">
            <ellipse cx="120" cy="100" rx="15" ry="17" fill="#fff" />
            <circle cx="120" cy="100" r="8" fill="#2a1a27" style={pupil} className="av-pupil" />
            <circle cx="123" cy="96" r="2.6" fill="#fff" style={pupil} className="av-pupil" />
          </g>

          {/* mouths: only the one for the current mood is visible */}
          <path className="av-mouth m-idle" d="M88 138 Q100 148 112 138" stroke="#3b2535" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <ellipse className="av-mouth m-o" cx="100" cy="141" rx="6" ry="7" fill="#3b2535" />
          <g className="av-mouth m-happy">
            <path d="M82 134 Q100 164 118 134 Z" fill="#3b2535" />
            <path d="M92 150 Q100 156 108 150 Q100 146 92 150 Z" fill="#ff8fb4" />
          </g>
          <path className="av-mouth m-sad" d="M88 148 Q100 134 112 148" stroke="#3b2535" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        </g>

        {/* hands: rest at the sides, rise over the eyes for the password field */}
        <g className="av-hand av-hand-l">
          <ellipse cx="60" cy="164" rx="22" ry="17" fill="url(#av-hand)" stroke="#d6a9cb" strokeWidth="2" />
          <path d="M50 158 v-8 M60 156 v-10 M70 158 v-8" stroke="#d6a9cb" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="av-hand av-hand-r">
          <ellipse cx="140" cy="164" rx="22" ry="17" fill="url(#av-hand)" stroke="#d6a9cb" strokeWidth="2" />
          <path d="M130 158 v-8 M140 156 v-10 M150 158 v-8" stroke="#d6a9cb" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
