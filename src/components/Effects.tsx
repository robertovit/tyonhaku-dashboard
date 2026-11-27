import { useEffect, useRef } from "react";
import type { ToastMsg, Unlock } from "../hooks/useToast";
import { PostIcon } from "./Post";
import { ShieldIcon } from "./Shield";

/** Bottom message. A newly unlocked shield or post item comes with its picture and "Ota käyttöön". */
export function Toast({ toast, onEquip }: { toast: ToastMsg | null; onEquip: (unlock: Unlock) => void }) {
  const unlock = toast?.unlock;
  return (
    <div className={`toast${unlock ? " with-unlock" : ""}`} hidden={!toast}>
      {unlock && (
        <span className={unlock.slot === "shield" ? "shield-icon" : "shield-icon post-icon"}>
          {unlock.slot === "shield" ? <ShieldIcon id={unlock.item.id} /> : <PostIcon id={unlock.item.id} />}
        </span>
      )}
      <div className="toast-msg" role="status" aria-live="polite">
        {toast && (
          <>
            <b>{toast.title}</b>
            {toast.text && <span>{toast.text}</span>}
          </>
        )}
      </div>
      {unlock && (
        <button type="button" className="btn sel" onClick={() => onEquip(unlock)}>
          Ota käyttöön
        </button>
      )}
    </div>
  );
}

/** Canvas confetti burst; `burst` changes to fire again. Skipped with reduced motion. */
export function Confetti({ burst, count }: { burst: number; count: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!burst || !count || !c || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = (c.width = innerWidth);
    const H = (c.height = innerHeight);
    c.hidden = false;
    const css = getComputedStyle(document.documentElement);
    const cols = ["--accent", "--accent-2", "--st-int", "--st-wait", "--warm"].map(
      (v) => css.getPropertyValue(v).trim() || "#c8f169",
    );
    const ps = Array.from({ length: count }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3,
      y: H * 0.35,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 12 - 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 3 + Math.random() * 4,
      c: cols[Math.floor(Math.random() * cols.length)],
    }));
    const t0 = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      ps.forEach((p) => {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t - t0 < 2600) raf = requestAnimationFrame(frame);
      else c.hidden = true;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, W, H);
      c.hidden = true;
    };
  }, [burst, count]);
  return <canvas id="confetti" ref={ref} hidden />;
}
