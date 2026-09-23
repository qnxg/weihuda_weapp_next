import { useEffect, useState } from "react";

const MINUTE_MS = 60_000;

export function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let intervalId: number | undefined;
    const delayToNextMinute = MINUTE_MS - (Date.now() % MINUTE_MS);
    const timeoutId = window.setTimeout(() => {
      setNow(new Date());
      intervalId = window.setInterval(() => setNow(new Date()), MINUTE_MS);
    }, delayToNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  return now;
}
