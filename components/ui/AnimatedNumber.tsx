"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";

const defaultFormat = (v: number) => String(Math.round(v * 100) / 100);

// 값이 바뀔 때 이전 숫자에서 새 숫자로 굴러가듯 올라가거나 내려간다.
export default function AnimatedNumber({
  value,
  format = defaultFormat,
  className,
}: {
  value: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, format);

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.45, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [mv, value]);

  return <motion.span className={`tabular-nums ${className ?? ""}`}>{text}</motion.span>;
}
