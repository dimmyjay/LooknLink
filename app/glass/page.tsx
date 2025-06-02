import React from "react";

export function GlassSidebar({ children, position = "left" }: { children: React.ReactNode; position?: "left" | "right" }) {
  return (
    <aside
      className={`
        hidden lg:flex flex-col gap-8 fixed top-32 ${position === "left" ? "left-0 rounded-e-2xl border-r-2 border-pink-200 dark:border-blue-600" : "right-0 rounded-s-2xl border-l-2 border-blue-200 dark:border-pink-500"}
        w-64 h-[75vh] z-30 px-6 py-8
        bg-gradient-to-br from-white/80 via-pink-50 to-blue-50 dark:from-[#232144]/90 dark:via-[#3d2367]/70 dark:to-[#2c1330]/80
        shadow-2xl overflow-y-auto animate-fadeIn backdrop-blur-xl
      `}
      style={{ minWidth: 240 }}
    >
      {children}
    </aside>
  );
}