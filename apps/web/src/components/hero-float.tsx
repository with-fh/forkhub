"use client";

import { Boxes, FileText, GitFork, GitPullRequest, Package, SquareTerminal } from "lucide-react";
import { useEffect, useRef } from "react";

const MARKS = [
  { key: "fork", Icon: GitFork, cls: "hf-1", tag: "fork it" },
  { key: "intent", Icon: FileText, cls: "hf-2", tag: "INTENT.md" },
  { key: "build", Icon: Package, cls: "hf-3", tag: "patched builds" },
  { key: "pr", Icon: GitPullRequest, cls: "hf-4", tag: "one-button PR" },
  { key: "cli", Icon: SquareTerminal, cls: "hf-5", tag: "fh CLI" },
  { key: "trains", Icon: Boxes, cls: "hf-6", tag: "stable / nightly" },
] as const;

// Floating mark cards around the hero (t3.codes .hero-float):
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
      {MARKS.map(({ key, Icon, cls, tag }) => (
        <span key={key} className={`fh-float-mark ${cls}`}>
          <span className="fh-float-card">
            <Icon />
          </span>
          <span className="fh-float-tag">{tag}</span>
        </span>
      ))}
    </div>
  );
}
