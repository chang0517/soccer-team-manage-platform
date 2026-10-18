"use client";

import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";

// reducedMotion="user": 기기에서 "동작 줄이기"를 켠 사용자에게는 애니메이션을 끈다.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton={false}
        toastOptions={{
          duration: 2200,
          style: { fontFamily: "var(--font-sans)", borderRadius: "1rem" },
        }}
      />
    </MotionConfig>
  );
}
