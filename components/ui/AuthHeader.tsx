"use client";

import { motion } from "motion/react";

// 로그인·가입·팀 만들기 같은 인증 화면 상단의 브랜드 헤더
export default function AuthHeader({ title, icon = "⚽" }: { title: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 pb-1 pt-2">
      <motion.div
        initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-3xl shadow-xl shadow-blue-800/25"
      >
        {icon}
      </motion.div>
      <h1 className="text-center text-2xl font-extrabold tracking-tight">{title}</h1>
    </div>
  );
}
