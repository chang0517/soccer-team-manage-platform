"use client";

import { motion } from "motion/react";

// template.tsx는 페이지를 이동할 때마다 다시 마운트되므로, 여기서 등장
// 애니메이션을 걸면 모든 화면 전환에 같은 부드러운 진입 효과가 붙는다.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
