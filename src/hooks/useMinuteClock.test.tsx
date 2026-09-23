import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMinuteClock } from "./useMinuteClock";

afterEach(() => {
  vi.useRealTimers();
});

describe("useMinuteClock", () => {
  it("updates on the next minute boundary and every minute after that", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 23, 14, 15, 30));
    const { result } = renderHook(() => useMinuteClock());

    expect(result.current.getMinutes()).toBe(15);
    act(() => vi.advanceTimersByTime(29_999));
    expect(result.current.getMinutes()).toBe(15);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.getMinutes()).toBe(16);
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.getMinutes()).toBe(17);
  });
});
