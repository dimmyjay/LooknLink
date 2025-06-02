import React, { useEffect, useState } from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "../../firebase";
import { FaCrown, FaGift } from "react-icons/fa";

/**
 * Leaderboard of Top Selling Videos (by sales count).
 * For each video in /messages, uses stats.purchases for "sales".
 * 
 * Firebase structure:
 * - /messages/{videoId}: { url, owner, stats: { purchases }, ... }
 */
export const Leaderboard = () => {
  const [leaders, setLeaders] = useState<
    { id: string; url: string; owner: string; sales: number; previewImg?: string }[]
  >([]);

  useEffect(() => {
    const messagesRef = ref(db, "messages");
    const handleValue = (snap: any) => {
      const data = snap.val();
      if (!data) {
        setLeaders([]);
        return;
      }
      // For each video, get sales (purchases)
      const arr = Object.entries(data)
        .map(([id, value]: [string, any]) => ({
          id,
          url: value.url || "",
          owner: value.owner || "",
          sales: (value.stats && value.stats.purchases) || 0,
          previewImg: value.previewImg || undefined, // If you store a preview image
        }))
        .filter(v => v.url && v.sales > 0)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);
      setLeaders(arr);
    };
    onValue(messagesRef, handleValue);
    return () => off(messagesRef, "value", handleValue);
  }, []);

  return (
    <div className="mt-8">
      <h3 className="font-bold text-lg mb-3 text-pink-600 dark:text-blue-200 flex items-center gap-2">
        <FaCrown className="text-yellow-500" /> Top Selling Videos
      </h3>
      <ol className="space-y-4">
        {leaders.map((v, i) => (
          <li key={v.id} className="flex items-center gap-3">
            <span className="text-xl font-bold">{i + 1}.</span>
            {v.previewImg ? (
              <img src={v.previewImg} alt="Video preview" className="w-12 h-12 rounded-xl border-2 border-pink-400 object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-pink-100 border-2 border-pink-400 flex items-center justify-center">
                <FaCrown className="text-pink-400 text-2xl" />
              </div>
            )}
            <span className="flex-1">
              <span className="block font-semibold text-pink-700 dark:text-blue-100">{v.owner}</span>
              <span className="block text-xs text-gray-500">Video</span>
            </span>
            <span className="text-sm text-gray-500 dark:text-blue-100">{v.sales} sales</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

// --- Viral Referral System Popup ---
export const ReferralPopup = ({ open, onClose, user }) => {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  // Unique referral link per user
  const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${user?.uid}`;

  return (
    <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center">
      <div className="bg-white dark:bg-[#231b3a] rounded-3xl p-8 max-w-sm w-full shadow-2xl border-2 border-pink-200 dark:border-blue-600 animate-fadeIn">
        <div className="flex items-center gap-3 mb-4">
          <FaGift className="text-4xl text-pink-400" />
          <h2 className="text-2xl font-extrabold text-pink-700 dark:text-blue-200">Invite friends, earn rewards!</h2>
        </div>
        <p className="mb-4 text-gray-700 dark:text-blue-100">
          Share your referral link below. When a friend joins, you both get a bonus!
        </p>
        <div className="flex">
          <input
            className="flex-1 px-3 py-2 rounded-l-xl border-2 border-pink-300 focus:outline-none"
            value={referralLink}
            readOnly
          />
          <button
            className="px-4 py-2 bg-pink-400 hover:bg-pink-600 text-white rounded-r-xl font-bold"
            onClick={() => {
              navigator.clipboard.writeText(referralLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="mt-5 flex justify-center">
          <button
            onClick={onClose}
            className="text-sm underline text-pink-600 hover:text-blue-600 mt-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};