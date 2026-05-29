import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export type DeviceMode = "desktop" | "mobile";

const DIMS = {
  desktop: { w: 1920, h: 1080, label: "Desktop 1920×1080" },
  mobile: { w: 932, h: 430, label: "Mobile 932×430" },
};

export function DevicePreviewFrame({
  mode,
  children,
}: {
  mode: DeviceMode;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const dim = DIMS[mode];

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 16;
      const h = el.clientHeight - 16;
      if (w <= 0 || h <= 0) return;
      const s = Math.min(w / dim.w, h / dim.h);
      setScale(s);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [dim.w, dim.h]);

  return (
    <div ref={wrapRef} className="relative w-full h-full flex items-center justify-center p-2 bg-surface-elevated rounded-xl overflow-hidden">
      <div
        style={{
          width: dim.w,
          height: dim.h,
          transform: `scale(${scale})`,
          transformOrigin: "center",
          position: "relative",
          borderRadius: mode === "mobile" ? 32 : 8,
          overflow: "hidden",
          background: "#0f1419",
          boxShadow: "0 20px 60px -10px rgba(0,0,0,0.6)",
        }}
      >
        {children}
      </div>
      <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground bg-background/70 backdrop-blur px-2 py-0.5 rounded">
        {dim.label}
      </div>
    </div>
  );
}
