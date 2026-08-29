"use client";

// Wraps route content so every navigation eases in instead of snapping into
// place. Lives inside Next `template.tsx` files, which re-mount on each
// navigation, so the animation replays every time you move between pages.
// Plain CSS transition (no animation library) — toggles a class one tick
// after mount so the browser has something to transition from.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode; slide?: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {children}
    </div>
  );
}
