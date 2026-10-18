import { AlertCircle, ArrowDown, Check, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PageSkeleton } from "./ui";

const PULL_THRESHOLD = 64;
const MAX_PULL_DISTANCE = 96;
const REFRESH_OFFSET = 56;
const DIRECTION_LOCK_DISTANCE = 6;
const SETTLE_DURATION = 180;

type PullState = "idle" | "pulling" | "ready" | "refreshing" | "success" | "error";
type PullTarget = "content" | "page" | "panel" | "segmented";

interface GestureState {
  startX: number;
  startY: number;
  direction: "vertical" | "horizontal" | null;
  tracking: boolean;
}

function pullDistance(deltaY: number) {
  return Math.min(MAX_PULL_DISTANCE, deltaY * 0.58);
}

function statusText(state: PullState) {
  switch (state) {
    case "pulling":
      return "继续下拉以刷新";
    case "ready":
      return "松开即可刷新";
    case "refreshing":
      return "正在刷新当前页面";
    case "success":
      return "刷新完成";
    case "error":
      return "刷新失败";
    default:
      return "";
  }
}

function PullIcon({ state }: { state: PullState }) {
  if (state === "refreshing") {
    return <LoaderCircle className="is-spinning" aria-hidden="true" />;
  }
  if (state === "success") return <Check aria-hidden="true" />;
  if (state === "error") return <AlertCircle aria-hidden="true" />;
  return <ArrowDown aria-hidden="true" />;
}

export function PullToRefresh({
  children,
  enabled,
  onRefresh,
}: {
  children: ReactNode;
  enabled: boolean;
  onRefresh: () => Promise<unknown>;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement>(null);
  const gestureRef = useRef<GestureState>({
    startX: 0,
    startY: 0,
    direction: null,
    tracking: false,
  });
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const refreshRunRef = useRef(0);
  const mountedRef = useRef(true);
  const timersRef = useRef<number[]>([]);
  const [distance, setDistance] = useState(0);
  const [state, setState] = useState<PullState>("idle");
  const [target, setTarget] = useState<PullTarget | null>(null);
  const [anchorTop, setAnchorTop] = useState(0);

  useEffect(() => {
    const timers = timersRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      refreshRunRef.current += 1;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (enabled) return;
    refreshRunRef.current += 1;
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.length = 0;
    gestureRef.current.tracking = false;
    gestureRef.current.direction = null;
    distanceRef.current = 0;
    refreshingRef.current = false;
    targetRef.current?.classList.remove("pull-to-refresh__target");
    targetRef.current = null;
    setDistance(0);
    setState("idle");
    setTarget(null);
  }, [enabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const clearTarget = () => {
      targetRef.current?.classList.remove("pull-to-refresh__target");
      targetRef.current = null;
      setTarget(null);
    };

    const resetGesture = () => {
      gestureRef.current.tracking = false;
      gestureRef.current.direction = null;
      distanceRef.current = 0;
      setDistance(0);
      setState("idle");
      clearTarget();
    };

    const finishRefresh = async () => {
      const refreshRun = refreshRunRef.current + 1;
      refreshRunRef.current = refreshRun;
      refreshingRef.current = true;
      distanceRef.current = REFRESH_OFFSET;
      setDistance(REFRESH_OFFSET);
      setState("refreshing");

      let result: "success" | "error" = "success";
      try {
        await onRefresh();
      } catch {
        result = "error";
      }
      if (!mountedRef.current || refreshRunRef.current !== refreshRun) return;

      setState(result);
      const feedbackTimer = window.setTimeout(
        () => {
          if (!mountedRef.current || refreshRunRef.current !== refreshRun) return;
          distanceRef.current = 0;
          setDistance(0);
          const settleTimer = window.setTimeout(() => {
            if (!mountedRef.current || refreshRunRef.current !== refreshRun) return;
            refreshingRef.current = false;
            setState("idle");
            clearTarget();
          }, SETTLE_DURATION);
          timersRef.current.push(settleTimer);
        },
        result === "success" ? 500 : 900,
      );
      timersRef.current.push(feedbackTimer);
    };

    const onTouchStart = (event: TouchEvent) => {
      const target = event.target;
      const shouldIgnore =
        target instanceof Element &&
        target.closest(
          "button, input, textarea, select, [contenteditable='true'], dialog, [data-pull-to-refresh-ignore]",
        );
      if (
        refreshingRef.current ||
        container.scrollTop > 0 ||
        event.touches.length !== 1 ||
        shouldIgnore
      ) {
        return;
      }

      const content = contentRef.current;
      const targetElement = event.target instanceof Element ? event.target : null;
      if (!content || !targetElement || !content.contains(targetElement)) return;

      const mainBounds = container.getBoundingClientRect();
      const page = targetElement.closest<HTMLElement>(".page");
      const panel = targetElement.closest<HTMLElement>(
        '[role="tabpanel"], [data-pull-to-refresh-panel]',
      );
      const pagePanel = page?.querySelector<HTMLElement>(
        ':scope > [role="tabpanel"], :scope > [data-pull-to-refresh-panel]',
      );
      const segmented = page?.querySelector<HTMLElement>(":scope > .segmented");
      let nextTarget: PullTarget = "content";
      let nextTargetElement: HTMLElement = content;
      let anchorElement: HTMLElement = content;
      let anchorEdge: "top" | "bottom" = "top";

      if (page) {
        if (targetElement.closest(".page-header")) return;
        if (panel && page.contains(panel)) {
          nextTarget = "panel";
          nextTargetElement = panel;
          anchorElement = panel;
        } else if (pagePanel) {
          return;
        } else if (segmented) {
          if (segmented.contains(targetElement)) return;
          nextTarget = "segmented";
          nextTargetElement = page;
          anchorElement = segmented;
          anchorEdge = "bottom";
        } else {
          nextTarget = "page";
          nextTargetElement = page;
          anchorElement = page.querySelector<HTMLElement>(".page-header") ?? page;
          anchorEdge = page.querySelector(".page-header") ? "bottom" : "top";
        }
      }

      targetRef.current?.classList.remove("pull-to-refresh__target");
      targetRef.current = nextTargetElement;
      nextTargetElement.classList.add("pull-to-refresh__target");
      const anchorBounds = anchorElement.getBoundingClientRect();
      setTarget(nextTarget);
      setAnchorTop(
        Math.max(
          0,
          Math.round(
            (anchorEdge === "bottom" ? anchorBounds.bottom : anchorBounds.top) - mainBounds.top,
          ),
        ),
      );

      const touch = event.touches[0];
      gestureRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        direction: null,
        tracking: true,
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      if (!gesture.tracking) return;
      if (event.touches.length !== 1) {
        resetGesture();
        return;
      }
      if (container.scrollTop > 0) {
        resetGesture();
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;
      if (
        gesture.direction === null &&
        Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= DIRECTION_LOCK_DISTANCE
      ) {
        gesture.direction =
          deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX) * 1.15 ? "vertical" : "horizontal";
      }
      if (gesture.direction !== "vertical") return;
      if (deltaY <= 0) {
        distanceRef.current = 0;
        setDistance(0);
        setState("pulling");
        return;
      }

      event.preventDefault();
      const nextDistance = pullDistance(deltaY);
      distanceRef.current = nextDistance;
      setDistance(nextDistance);
      setState(nextDistance >= PULL_THRESHOLD ? "ready" : "pulling");
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!gestureRef.current.tracking) return;
      if (event.touches.length > 0) {
        resetGesture();
        return;
      }
      const shouldRefresh =
        gestureRef.current.direction === "vertical" && distanceRef.current >= PULL_THRESHOLD;
      gestureRef.current.tracking = false;
      gestureRef.current.direction = null;
      if (shouldRefresh) {
        void finishRefresh();
      } else {
        resetGesture();
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", resetGesture, { passive: true });
    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", resetGesture);
      targetRef.current?.classList.remove("pull-to-refresh__target");
    };
  }, [enabled, onRefresh]);

  const style = {
    "--pull-anchor-top": `${anchorTop}px`,
    "--pull-offset": `${distance}px`,
    "--pull-skeleton-gap": "40px",
  } as CSSProperties;
  const active = state !== "idle";

  return (
    <main
      className="app-main"
      id="main-content"
      ref={containerRef}
      data-pull-target={target ?? undefined}
      data-pull-state={state}
      style={style}
    >
      <div
        className={`pull-to-refresh${active ? " is-active" : ""} is-${state}`}
        aria-hidden={!active}
      >
        <span className="pull-to-refresh__indicator">
          <PullIcon state={state} />
        </span>
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusText(state)}
      </p>
      {state === "refreshing" ? (
        <div className="pull-to-refresh__skeleton" aria-hidden="true">
          <PageSkeleton rows={target === "panel" ? 5 : 7} />
        </div>
      ) : null}
      <div className="pull-to-refresh__content" ref={contentRef}>
        {children}
      </div>
    </main>
  );
}
