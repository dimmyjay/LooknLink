import React from "react";

export default function SkeletonLoader() {
  return (
    <div className="w-full h-[480px] rounded-3xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-neutral-900 dark:to-neutral-700 animate-pulse flex flex-col items-center justify-center">
      <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-neutral-800 mb-6" />
      <div className="w-2/3 h-10 rounded-lg bg-gray-200 dark:bg-neutral-700 mb-4" />
      <div className="w-full h-64 rounded-2xl bg-gray-100 dark:bg-neutral-800 mb-4" />
      <div className="w-1/2 h-8 rounded-full bg-gray-200 dark:bg-neutral-700" />
    </div>
  );
}