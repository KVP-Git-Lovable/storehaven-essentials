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

    const update = () => setWidth(target.scrollWidth);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(target);
    Array.from(target.children).forEach((c) => ro.observe(c as Element));

    const onTopScroll = () => {
      if (syncing.current === "bottom") { syncing.current = null; return; }
      syncing.current = "top";
      target.scrollLeft = top.scrollLeft;
    };
    const onBottomScroll = () => {
      if (syncing.current === "top") { syncing.current = null; return; }
      syncing.current = "bottom";
      top.scrollLeft = target.scrollLeft;
    };
    top.addEventListener("scroll", onTopScroll);
    target.addEventListener("scroll", onBottomScroll);

    return () => {
      ro.disconnect();
      top.removeEventListener("scroll", onTopScroll);
      target.removeEventListener("scroll", onBottomScroll);
    };
  }, [targetRef]);

  return (
    <div ref={topRef} className="overflow-x-auto w-full border-b" style={{ height: 14 }}>
      <div style={{ width, height: 1 }} />
    </div>
  );
}