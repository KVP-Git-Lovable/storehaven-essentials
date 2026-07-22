import { useEffect, useRef, useState } from "react";

/**
 * Renders a horizontal scrollbar above a scrollable target element and keeps
 * them in sync in both directions. Useful for wide tables so the user does
 * not have to scroll to the bottom to reach the scrollbar.
 */
export function TopScrollbar({ targetRef }: { targetRef: React.RefObject<HTMLElement | null> }) {
  const topRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const syncing = useRef<"top" | "bottom" | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    const top = topRef.current;
    if (!target || !top) return;

    const update = () => setWidth((prev) => (prev === target.scrollWidth ? prev : target.scrollWidth));
    update();

    const ro = new ResizeObserver(update);
    ro.observe(target);
    // Observe all descendants so late-rendered tables update the width
    target.querySelectorAll("*").forEach((el) => ro.observe(el as Element));

    const mo = new MutationObserver(() => {
      update();
      target.querySelectorAll("*").forEach((el) => ro.observe(el as Element));
    });
    mo.observe(target, { childList: true, subtree: true });

    // Fallback polling for the first couple of seconds in case async data
    // changes the table width without triggering observers.
    let ticks = 0;
    const interval = window.setInterval(() => {
      update();
      if (++ticks > 20) window.clearInterval(interval);
    }, 150);

    const onTopScroll = () => {
      if (syncing.current === "bottom") { syncing.current = null; return; }
      syncing.current = "top";
      target.scrollLeft = top.scrollLeft;
    };
    const onBottomScroll = () => {
      if (syncing.current === "top") { syncing.current = null; return; }
      syncing.current = "bottom";
      top.scrollLeft = target.scrollLeft;
      update();
    };
    top.addEventListener("scroll", onTopScroll);
    target.addEventListener("scroll", onBottomScroll);

    return () => {
      ro.disconnect();
      mo.disconnect();
      window.clearInterval(interval);
      top.removeEventListener("scroll", onTopScroll);
      target.removeEventListener("scroll", onBottomScroll);
    };
  }, [targetRef]);

  return (
    <div ref={topRef} className="overflow-x-scroll w-full border-b" style={{ height: 16 }}>
      <div style={{ width: Math.max(width, 1), height: 1 }} />
    </div>
  );
}