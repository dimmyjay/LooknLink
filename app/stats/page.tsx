"use client";
import { useState, useEffect } from "react";
import { getDatabase, ref, update, onValue, off, set, remove, runTransaction } from "firebase/database";
import { User } from "firebase/auth";
import {
  FaHeart,
  FaEye,
  FaShareAlt,
  FaBookmark,
  FaCommentDots,
  FaShoppingCart,
  FaWhatsapp,
  FaFacebookF,
  FaLinkedinIn,
  FaInstagram,
  FaTiktok,
  FaCopy
} from "react-icons/fa";
import { WhatsappShareButton, FacebookShareButton, LinkedinShareButton } from "react-share";
import CommentModal from "../comments/page";

type Stats = {
  likes: number;
  views: number;
  shares: number;
  saves: number;
  comments: number;
  purchases: number;
};

export function StatMessage({
  msgKey,
  stats,
  url,
  user,
}: {
  msgKey: string;
  stats: Stats;
  url: string;
  user: User | null;
}) {
  const db = getDatabase();
  const [showCommentModal, setShowCommentModal] = useState(false);

  // Likes (only one like per user, toggleable)
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(stats.likes || 0);
  useEffect(() => {
    if (!user) return;
    const likerRef = ref(db, `messages/${msgKey}/likers/${user.uid}`);
    const unsub = onValue(likerRef, (snap) => setLiked(!!snap.val()));
    return () => off(likerRef);
  }, [user, msgKey]);
  useEffect(() => {
    const likesRef = ref(db, `messages/${msgKey}/stats/likes`);
    const unsub = onValue(likesRef, (snap) => setLikes(snap.val() || 0));
    return () => off(likesRef, "value", unsub);
  }, [msgKey]);
  const handleLike = async () => {
    if (!user) return;
    const likerRef = ref(db, `messages/${msgKey}/likers/${user.uid}`);
    const likesRef = ref(db, `messages/${msgKey}/stats/likes`);
    if (liked) {
      await remove(likerRef);
      runTransaction(likesRef, (curr) => Math.max((curr || 1) - 1, 0));
    } else {
      await set(likerRef, true);
      runTransaction(likesRef, (curr) => (curr || 0) + 1);
    }
  };

  // Views
  const [views, setViews] = useState(stats.views || 0);
  useEffect(() => {
    if (!user) return;
    const viewerRef = ref(db, `messages/${msgKey}/viewers/${user.uid}`);
    const statsRef = ref(db, `messages/${msgKey}/stats/views`);
    const viewCountListener = onValue(statsRef, (snap) => {
      setViews(snap.val() || 0);
    });
    onValue(
      viewerRef,
      (snap) => {
        if (!snap.exists()) {
          set(viewerRef, true);
          runTransaction(statsRef, (currentViews) => (currentViews || 0) + 1);
        }
      },
      { onlyOnce: true }
    );
    return () => {
      off(viewerRef);
      off(statsRef);
    };
  }, [user, msgKey]);

  // Shares
  const [shares, setShares] = useState(stats.shares || 0);
  useEffect(() => {
    const sharesRef = ref(db, `messages/${msgKey}/stats/shares`);
    const unsub = onValue(sharesRef, (snap) => setShares(snap.val() || 0));
    return () => off(sharesRef, "value", unsub);
  }, [msgKey]);

  // Share Modal
  const [showShareMenu, setShowShareMenu] = useState(false);

  const handleShare = async () => {
    const sharesRef = ref(db, `messages/${msgKey}/stats/shares`);
    runTransaction(sharesRef, (curr) => (curr || 0) + 1);
    setShowShareMenu(true);
  };

  // Saves
  const [saved, setSaved] = useState(false);
  const [saves, setSaves] = useState(stats.saves || 0);
  useEffect(() => {
    if (!user) return;
    const saverRef = ref(db, `messages/${msgKey}/savers/${user.uid}`);
    const unsub = onValue(saverRef, (snap) => setSaved(!!snap.val()));
    return () => off(saverRef);
  }, [user, msgKey]);
  useEffect(() => {
    const savesRef = ref(db, `messages/${msgKey}/stats/saves`);
    const unsub = onValue(savesRef, (snap) => setSaves(snap.val() || 0));
    return () => off(savesRef, "value", unsub);
  }, [msgKey]);
  const handleSave = async () => {
    if (!user) return;
    const saverRef = ref(db, `messages/${msgKey}/savers/${user.uid}`);
    const savesRef = ref(db, `messages/${msgKey}/stats/saves`);
    await set(saverRef, true);
    runTransaction(savesRef, (curr) => (curr || 0) + 1);
  };

  // Comments
  const [comments, setComments] = useState(stats.comments || 0);
  useEffect(() => {
    const commentsRef = ref(db, `messages/${msgKey}/stats/comments`);
    const unsub = onValue(commentsRef, (snap) => setComments(snap.val() || 0));
    return () => off(commentsRef, "value", unsub);
  }, [msgKey]);
  const handleComment = () => setShowCommentModal(true);

  // Purchases
  const [purchased, setPurchased] = useState(false);
  const [purchases, setPurchases] = useState(stats.purchases || 0);
  useEffect(() => {
    if (!user) return;
    const buyerRef = ref(db, `messages/${msgKey}/buyers/${user.uid}`);
    const unsub = onValue(buyerRef, (snap) => setPurchased(!!snap.val()));
    return () => off(buyerRef);
  }, [user, msgKey]);
  useEffect(() => {
    const purchasesRef = ref(db, `messages/${msgKey}/stats/purchases`);
    const unsub = onValue(purchasesRef, (snap) => setPurchases(snap.val() || 0));
    return () => off(purchasesRef, "value", unsub);
  }, [msgKey]);
  const handlePurchase = async () => {
    if (!user) return;
    const buyerRef = ref(db, `messages/${msgKey}/buyers/${user.uid}`);
    const purchasesRef = ref(db, `messages/${msgKey}/stats/purchases`);
    await set(buyerRef, true);
    runTransaction(purchasesRef, (curr) => (curr || 0) + 1);
  };

  // --- UI Colors ---
  const labelClass = "text-xs text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white";
  const numberClass = "font-bold";
  const iconSize = "text-lg mb-1";

  // --- Share Modal ---
  const shareMenu = showShareMenu && (
    <div className="absolute z-30 mt-2 bg-white dark:bg-[#232136] border border-gray-200 dark:border-[#393053] rounded-lg shadow-lg p-2 flex flex-col gap-2 min-w-[180px]">
      <WhatsappShareButton url={url} title="Check this out!" onShareWindowClose={() => setShowShareMenu(false)}>
        <div className="flex items-center gap-2 hover:bg-green-100 p-2 rounded cursor-pointer">
          <FaWhatsapp className="text-green-500" /> WhatsApp
        </div>
      </WhatsappShareButton>
      <FacebookShareButton url={url} quote="Check this out!" onShareWindowClose={() => setShowShareMenu(false)}>
        <div className="flex items-center gap-2 hover:bg-blue-100 p-2 rounded cursor-pointer">
          <FaFacebookF className="text-blue-600" /> Facebook
        </div>
      </FacebookShareButton>
      <LinkedinShareButton url={url} title="Check this out!" onShareWindowClose={() => setShowShareMenu(false)}>
        <div className="flex items-center gap-2 hover:bg-blue-50 p-2 rounded cursor-pointer">
          <FaLinkedinIn className="text-blue-700" /> LinkedIn
        </div>
      </LinkedinShareButton>
      <button
        className="flex items-center gap-2 hover:bg-pink-100 p-2 rounded cursor-pointer"
        onClick={() => {
          window.navigator.clipboard.writeText(url);
          alert("Link copied! Open Instagram and paste it.");
          setShowShareMenu(false);
        }}
      >
        <FaInstagram className="text-pink-500" /> Instagram (Copy link)
      </button>
      <button
        className="flex items-center gap-2 hover:bg-black/10 p-2 rounded cursor-pointer"
        onClick={() => {
          window.navigator.clipboard.writeText(url);
          alert("Link copied! Open TikTok and paste it.");
          setShowShareMenu(false);
        }}
      >
        <FaTiktok className="text-black" /> TikTok (Copy link)
      </button>
      <button
        className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded cursor-pointer"
        onClick={() => {
          window.navigator.clipboard.writeText(url);
          alert("Link copied to clipboard!");
          setShowShareMenu(false);
        }}
      >
        <FaCopy className="text-gray-700" /> Copy Link
      </button>
      <button
        className="w-full mt-1 text-xs underline text-blue-400 hover:text-pink-500"
        onClick={() => setShowShareMenu(false)}
      >
        Close
      </button>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap justify-between items-center gap-2 relative">
        <button
          type="button"
          className={`flex flex-col items-center px-2 py-1 hover:scale-110 transition cursor-pointer group ${liked ? "text-red-500" : "text-gray-700"}`}
          onClick={handleLike}
          title="Likes"
          disabled={!user}
        >
          <div className={iconSize}><FaHeart /></div>
          <span className={numberClass}>{likes}</span>
          <span className={labelClass}>Likes</span>
        </button>

        <div
          className="flex flex-col items-center px-2 py-1 cursor-default group text-blue-500"
          title="Views"
        >
          <div className={iconSize}><FaEye /></div>
          <span className={numberClass}>{views}</span>
          <span className={labelClass}>Views</span>
        </div>

        <div className="relative flex flex-col items-center px-2 py-1 group">
          <button
            type="button"
            className="flex flex-col items-center group-hover:scale-110 transition cursor-pointer text-green-600"
            onClick={handleShare}
            title="Share"
          >
            <div className={iconSize}><FaShareAlt /></div>
            <span className={numberClass}>{shares}</span>
            <span className={labelClass}>Share</span>
          </button>
          {shareMenu}
        </div>

        <button
          type="button"
          className={`flex flex-col items-center px-2 py-1 hover:scale-110 transition cursor-pointer group ${saved ? "text-blue-600" : "text-gray-700"}`}
          onClick={handleSave}
          title="Saves"
          disabled={!user}
        >
          <div className={iconSize}><FaBookmark /></div>
          <span className={numberClass}>{saves}</span>
          <span className={labelClass}>Saves</span>
        </button>

        <button
          type="button"
          className="flex flex-col items-center px-2 py-1 hover:scale-110 transition cursor-pointer group text-pink-600"
          onClick={handleComment}
          title="Comments"
        >
          <div className={iconSize}><FaCommentDots /></div>
          <span className={numberClass}>{comments}</span>
          <span className={labelClass}>Comments</span>
        </button>

        <button
          type="button"
          className={`flex flex-col items-center px-2 py-1 hover:scale-110 transition cursor-pointer group ${purchased ? "text-green-600" : "text-gray-700"}`}
          onClick={handlePurchase}
          title="Buys"
          disabled={!user}
        >
          <div className={iconSize}><FaShoppingCart /></div>
          <span className={numberClass}>{purchases}</span>
          <span className={labelClass}>Buys</span>
        </button>
      </div>
      {showCommentModal && (
        <CommentModal
          msgKey={msgKey}
          user={user}
          onClose={() => setShowCommentModal(false)}
        />
      )}
    </>
  );
}