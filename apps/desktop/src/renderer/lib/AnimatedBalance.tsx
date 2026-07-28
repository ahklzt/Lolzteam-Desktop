import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  currency: string;
  locale?: string;
  className?: string;
  durationMs?: number;
}

const format = (value: number, currency: string, locale: string): string => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
};

export const AnimatedBalance = ({
  value,
  currency,
  locale = "ru-RU",
  className,
  durationMs = 900,
}: Props) => {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setShown(to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setShown(Math.round(current * 100) / 100);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, durationMs]);

  return <span className={className}>{format(shown, currency, locale)}</span>;
};

export default AnimatedBalance;
