import { useEffect, useRef, useState } from 'react';

/** Animates a number from its previous value to `value` (easing out). Skipped for reduced motion. */
export default function CountUp({ value, format = (v) => Math.round(v).toLocaleString('en-IN'), ms = 1100 }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(target);
      from.current = target;
      return undefined;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const next = start + (target - start) * (1 - (1 - p) ** 3);
      setShown(next);
      from.current = next;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);

  return <span className="tabular">{format(shown)}</span>;
}
