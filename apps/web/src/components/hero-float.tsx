"use client";

import { useEffect, useRef } from "react";

const MARKS = [
  { key: "t3code", src: "/marks/t3code.webp", alt: "T3 Code", cls: "hf-1" },
  { key: "natively", src: "/marks/natively.png", alt: "Natively", cls: "hf-3" },
] as const;

// Floating app-icon cards around the hero (t3.codes .hero-float):
// idle drift via CSS + pointer parallax via --mx/--my custom props.
export default function HeroFloat() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = ref.current?.closest("section");
    if (!hero || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        const my = ((e.clientY - r.top) / r.height - 0.5) * 2;
        ref.current?.style.setProperty("--mx", mx.toFixed(3));
        ref.current?.style.setProperty("--my", my.toFixed(3));
      });
    };
    hero.addEventListener("pointermove", onMove);
    return () => {
      hero.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fh-hero-float" aria-hidden="true" ref={ref}>
      {MARKS.map(({ key, src, alt, cls }) => (
        <span key={key} className={`fh-float-mark ${cls}`}>
          <span className="fh-float-card fh-float-app">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" aria-hidden="true" />
          </span>
          <span className="fh-float-tag">{alt}</span>
        </span>
      ))}
    </div>
  );
}
