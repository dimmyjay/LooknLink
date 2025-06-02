import React, { useEffect, useState } from "react";
import { ref, onValue, set, off } from "firebase/database";
import { db } from "../../firebase";

/**
 * Automatically finds the "top" user (by total likes+comments+purchases+shares+saves)
 * among all users in the database and assigns them as the featured seller.
 * 
 * - Scans all /users for name/email (optional, for display)
 * - Scans all /messages for stats per owner
 * - Tallies likes, comments, purchases (buyers), shares, saves per user (owner)
 * - Assigns the owner with the highest total as /featuredSeller in DB
 * - Displays that user (name, avatar, total engagement)
 */
export const FeaturedSeller = () => {
  const [seller, setSeller] = useState<{
    displayName: string;
    photoURL: string;
    email?: string;
    total: number;
    likes: number;
    comments: number;
    purchases: number;
    shares: number;
    saves: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let usersOff = () => {};
    let messagesOff = () => {};

    // 1. Get all users and messages
    const usersRef = ref(db, "users");
    const messagesRef = ref(db, "messages");

    let usersData: Record<string, any> = {};
    let statsByUser: Record<
      string,
      { likes: number; comments: number; purchases: number; shares: number; saves: number }
    > = {};

    // When both loaded, compute featured seller
    function computeAndSetFeatured() {
      // 2. Aggregate stats for each user (owner)
      let entries = Object.entries(statsByUser);
      if (entries.length === 0) {
        setSeller(null);
        setLoading(false);
        return;
      }

      // 3. Score: likes + comments + purchases + shares + saves
      entries = entries.map(([owner, stats]) => ({
        owner,
        ...stats,
        total: stats.likes + stats.comments + stats.purchases + stats.shares + stats.saves,
      }));

      // 4. Find userId with max score
      entries.sort((a, b) => b.total - a.total);
      const top = entries[0];

      // 5. Get user info from usersData
      const user = usersData[top.owner] || {};
      // 6. Optionally set as /featuredSeller in DB
      set(ref(db, "featuredSeller"), top.owner);

      setSeller({
        displayName: user.displayName || top.owner,
        photoURL: user.photoURL || `https://api.dicebear.com/7.x/thumbs/svg?seed=${top.owner}`,
        email: user.email,
        total: top.total,
        likes: top.likes,
        comments: top.comments,
        purchases: top.purchases,
        shares: top.shares,
        saves: top.saves,
      });
      setLoading(false);
    }

    // Listen for users
    onValue(usersRef, (snap) => {
      usersData = snap.val() || {};
      // Only compute if we have loaded both
      if (Object.keys(statsByUser).length > 0) computeAndSetFeatured();
    });
    usersOff = () => off(usersRef, "value");

    // Listen for messages
    onValue(messagesRef, (snap) => {
      statsByUser = {};
      const messages = snap.val() || {};
      Object.values(messages).forEach((msg: any) => {
        if (!msg.owner || !msg.stats) return;
        if (!statsByUser[msg.owner]) {
          statsByUser[msg.owner] = {
            likes: 0,
            comments: 0,
            purchases: 0,
            shares: 0,
            saves: 0,
          };
        }
        statsByUser[msg.owner].likes += Number(msg.stats.likes || 0);
        statsByUser[msg.owner].comments += Number(msg.stats.comments || 0);
        statsByUser[msg.owner].purchases += Number(msg.stats.purchases || 0);
        statsByUser[msg.owner].shares += Number(msg.stats.shares || 0);
        statsByUser[msg.owner].saves += Number(msg.stats.saves || 0);
      });
      // Only compute if we have loaded both
      if (usersData && Object.keys(usersData).length > 0) computeAndSetFeatured();
    });
    messagesOff = () => off(messagesRef, "value");

    return () => {
      usersOff();
      messagesOff();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 mt-2 animate-pulse">
        <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-blue-900 border-2 border-pink-400 shadow" />
        <span>
          <span className="block font-semibold text-gray-400 dark:text-gray-300">Loading...</span>
          <span className="block text-xs text-gray-300 dark:text-gray-500">Loading featured seller</span>
        </span>
      </div>
    );
  }
  if (!seller) {
    return (
      <div className="flex items-center gap-3 mt-2">
        <span className="block font-semibold text-gray-400 dark:text-gray-300">No featured seller found</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mt-2">
      <img
        src={seller.photoURL}
        alt={seller.displayName}
        className="w-12 h-12 rounded-full border-2 border-pink-400 shadow"
      />
      <span>
        <span className="block font-semibold">{seller.displayName}</span>
        {seller.email && (
          <span className="block text-xs text-gray-400 dark:text-gray-300">{seller.email}</span>
        )}
        <span className="block text-xs text-gray-400 dark:text-gray-300">
          +{seller.total} total engagement ({seller.likes} likes, {seller.comments} comments, {seller.purchases} buyers, {seller.shares} shares, {seller.saves} saves)
        </span>
      </span>
    </div>
  );
};