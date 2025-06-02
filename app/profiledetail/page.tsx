import React from "react";
import { motion } from "framer-motion";

export function ProfileBanner({ user }: { user: any }) {
  if (!user) return null;
  return (
    <motion.div
      className="hidden lg:flex flex-col items-center gap-2 fixed top-32 left-0 z-40 px-5 py-4 w-64 bg-white/70 dark:bg-[#231b3a]/90 border-r-2 border-pink-200 dark:border-blue-600 rounded-e-2xl shadow-2xl backdrop-blur-xl"
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <motion.img
        src={
          user.photoURL ||
          `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.displayName || user.email}`
        }
        alt={user.displayName || user.email || "user"}
        className="w-16 h-16 rounded-full border-4 border-pink-400 dark:border-blue-400 shadow-lg mb-2"
        animate={{ boxShadow: ["0 0 0 0 #f472b6", "0 0 0 10px #e879f9", "0 0 0 0 #f472b6"] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className="text-lg font-bold text-pink-700 dark:text-blue-100 bg-gradient-to-r from-pink-400 via-blue-600 to-pink-600 bg-clip-text text-transparent text-center animate-gradient-x">
        {user.displayName || user.email || "User"}
      </span>
    </motion.div>
  );
}