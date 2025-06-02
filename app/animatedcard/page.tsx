import React from "react";
import { FaHeart, FaShareAlt, FaEye } from "react-icons/fa";
import { motion } from "framer-motion";

export default function AnimatedVideoCard({
  videoUrl,
  owner,
  ownerPhotoURL,
  createdAt,
  stats,
  onShare,
  onComment,
}) {
  return (
    <motion.div
      className="bg-white/60 dark:bg-neutral-900/80 rounded-3xl shadow-2xl border-2 border-pink-200 dark:border-blue-600 p-6 group relative overflow-hidden
                hover:scale-[1.025] hover:z-50 transition-transform duration-300 backdrop-blur-xl"
      whileHover={{ scale: 1.03, boxShadow: "0 8px 40px #e879f9aa" }}
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-gradient-to-tr from-pink-200 to-blue-200 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
      <div className="rounded-2xl overflow-hidden shadow-xl border-4 border-white dark:border-blue-900 bg-black/40 relative z-20 w-full">
        <video
          src={videoUrl}
          controls
          className="w-full h-[420px] object-cover rounded-2xl"
          preload="metadata"
        />
        <span className="absolute top-4 left-4 bg-gradient-to-br from-blue-600 to-pink-600 text-white text-sm font-extrabold px-4 py-1.5 rounded-full shadow-lg border border-white/40 animate-pulse">
          {createdAt}
        </span>
        <span className="absolute top-4 right-4 bg-gradient-to-br from-pink-400 to-blue-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow border-2 border-white/30 animate-bounce">
          <FaEye className="inline mr-1" /> {stats.views}
        </span>
      </div>
      <div className="flex items-center gap-4 mt-6 mb-4 z-30 relative">
        <motion.img
          src={ownerPhotoURL}
          alt={owner}
          className="w-14 h-14 rounded-full border-4 border-pink-400 dark:border-blue-400 shadow-lg"
          animate={{ boxShadow: ["0 0 0 0 #f472b6", "0 0 0 8px #e879f9", "0 0 0 0 #f472b6"] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
        <span className="font-extrabold text-2xl text-pink-700 dark:text-blue-100 bg-gradient-to-r from-pink-600 via-blue-500 to-blue-300 bg-clip-text text-transparent animate-gradient-x">
          {owner}
        </span>
        <div className="flex-1" />
        <button
          className="rounded-full px-3 py-2 text-lg bg-gradient-to-r from-pink-400 via-blue-400 to-pink-400 text-white shadow-lg border-2 border-white/30 hover:scale-110 transition"
          onClick={onShare}
          title="Share"
        >
          <FaShareAlt />
        </button>
      </div>
      <motion.button
        type="button"
        className="w-full mt-6 py-4 bg-gradient-to-tr from-pink-600 via-blue-500 to-pink-400 text-white font-extrabold text-xl rounded-2xl shadow-lg flex items-center justify-center gap-4 border-4 border-white/30 hover:from-pink-700 hover:to-blue-600 hover:scale-105 transition"
        whileHover={{ scale: 1.04, backgroundPosition: "100% 50%" }}
        onClick={onComment}
      >
        <FaHeart className="text-2xl" />
        View Comments &amp; Stats
      </motion.button>
      <div className="flex flex-wrap gap-6 justify-between mt-8 px-2 text-xl font-bold">
        <div className="flex items-center gap-2 text-pink-600 drop-shadow-sm animate-bounce">
          <FaHeart /> {stats.likes}
        </div>
        <div className="flex items-center gap-2 text-green-600 drop-shadow-sm animate-spin-slow">
          <FaShareAlt /> {stats.shares}
        </div>
      </div>
    </motion.div>
  );
}