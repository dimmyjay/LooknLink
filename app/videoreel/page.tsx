"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  FaShareAlt,
  FaWhatsapp,
  FaFacebookF,
  FaLinkedinIn,
  FaInstagram,
  FaCommentDots,
  FaHeart,
  FaEye,
  FaBookmark,
  FaShoppingCart,
  FaTiktok,
  FaCopy,
} from "react-icons/fa";
import { app as firebaseApp } from "../../firebase";
import { ref, onValue, off } from "firebase/database";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from "firebase/auth";
import { db } from "../../firebase";
import CommentModal from "../comments/page";
import NavBar from "../nav/page";
import { Leaderboard, ReferralPopup } from "../viralfeature/page";
import { FeaturedSeller } from "../featureseller/page";

// --- Interesting Content for Left and Right Sides ---
const InterestingLeft = () => (
  <aside
    className="hidden lg:flex flex-col gap-10 fixed top-32 left-0 w-64 h-[75vh] z-20 px-6 py-6
      bg-gradient-to-br from-blue-100 via-pink-50 to-white dark:from-[#231b3a]/90 dark:via-[#29143e]/70 dark:to-[#211a37]/80
      rounded-e-2xl shadow-2xl border-r-2 border-pink-200 dark:border-blue-600 overflow-y-auto animate-fadeIn"
    style={{ minWidth: 240 }}
  >
    <h2 className="text-2xl font-bold text-pink-700 dark:text-blue-200 mb-2">Tips for Sellers</h2>
    <ul className="list-disc pl-4 space-y-2 text-base text-gray-700 dark:text-blue-100">
      <li>Upload high-quality product videos for best impressions.</li>
      <li>Share your reel on social media to get more views!</li>
      <li>Respond to comments to engage with buyers.</li>
      <li>
        <span className="font-semibold">Hot tip:</span> Use trending music in your product videos.
      </li>
    </ul>
    <div className="mt-8">
      <h3 className="font-bold text-lg text-pink-600 dark:text-blue-200">Featured Seller</h3>
      <FeaturedSeller />
    </div>
  </aside>
);

const InterestingRight = () => (
  <aside
    className="hidden lg:flex flex-col gap-8 fixed top-32 right-0 w-64 h-[75vh] z-20 px-6 py-6
      bg-gradient-to-bl from-pink-50 via-blue-50 to-white dark:from-[#232144]/90 dark:via-[#3d2367]/70 dark:to-[#2c1330]/80
      rounded-s-2xl shadow-2xl border-l-2 border-blue-200 dark:border-pink-500 overflow-y-auto animate-fadeIn"
    style={{ minWidth: 240 }}
  >
    <h2 className="text-2xl font-bold text-blue-700 dark:text-pink-200 mb-2">Discover</h2>
    <div>
      <h3 className="font-bold text-lg text-blue-600 dark:text-pink-200">Trending Tags</h3>
      <div className="flex flex-wrap gap-2 mt-2">
        <span className="bg-pink-200/60 px-3 py-1 rounded-full text-pink-800 font-bold text-xs">#handmade</span>
        <span className="bg-blue-200/70 px-3 py-1 rounded-full text-blue-800 font-bold text-xs">#fashion</span>
        <span className="bg-pink-100/80 px-3 py-1 rounded-full text-pink-600 font-bold text-xs">#tech</span>
        <span className="bg-blue-100/80 px-3 py-1 rounded-full text-blue-600 font-bold text-xs">#gadgets</span>
        <span className="bg-pink-100/70 px-3 py-1 rounded-full text-pink-700 font-bold text-xs">#home</span>
      </div>
    </div>
    <div className="mt-8">
      <h3 className="font-bold text-lg text-blue-600 dark:text-pink-200">Did you know?</h3>
      <p className="text-base text-gray-700 dark:text-blue-100 mt-2">
        Products with videos get up to <span className="font-bold">80% more engagement</span> compared to photos!
      </p>
    </div>
    <Leaderboard />
  </aside>
);

type VideoMessage = {
  id: string;
  url: string;
  owner: string;
  createdAt: string;
  stats: {
    likes: number;
    views: number;
    shares: number;
    saves: number;
    comments: number;
    purchases: number;
  };
  key: string;
  ownerPhotoURL?: string;
};

type Preview = {
  video?: string;
  ogImage?: { url: string } | { url: string }[];
};

function getYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1);
    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtube-nocookie.com")
    ) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      const match = parsed.pathname.match(/\/(embed|v)\/([^/?]+)/);
      if (match) return match[2];
    }
  } catch (e) {}
  const regExp =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regExp);
  return match ? match[1] : null;
}
function isVideoLink(url: string) {
  return !!getYouTubeId(url) || /\.(mp4|webm|ogg)$/i.test(url);
}
function getPreviewImage(preview: Preview | undefined) {
  if (!preview) return undefined;
  if (Array.isArray(preview.ogImage)) return preview.ogImage[0]?.url;
  if (typeof preview.ogImage === "object" && preview.ogImage?.url) return preview.ogImage.url;
  return undefined;
}
function formatTimeAgo(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  const minutesAgo = Math.floor(secondsAgo / 60);
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  const daysAgo = Math.floor(hoursAgo / 24);
  if (daysAgo < 7) return `${daysAgo}d ago`;
  return date.toLocaleString();
}

export default function VideoReel() {
  const [videoMessages, setVideoMessages] = useState<VideoMessage[]>([]);
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentMsgKey, setCommentMsgKey] = useState<string | null>(null);
  const closeCommentModal = () => setShowCommentModal(false);

  const [showReferral, setShowReferral] = useState(false);

  const [dark, setDark] = useState(false);
  const [signupPrompt, setSignupPrompt] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  const [videoCount, setVideoCount] = useState(0);

  const prevFirebaseUser = useRef<User | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const messagesRef = ref(db, "messages");
    const handleValue = (snapshot: any) => {
      const data = snapshot.val();
      if (!data) {
        setVideoMessages([]);
        return;
      }
      const allMsgs = Object.entries(data).map(([key, value]: [string, any]) => ({
        ...(value as VideoMessage),
        id: key,
        key,
      }));
      const videoMsgs = allMsgs.filter((msg) => msg.url && isVideoLink(msg.url));
      setVideoMessages(videoMsgs.reverse());
    };
    onValue(messagesRef, handleValue);
    return () => off(messagesRef, "value", handleValue);
  }, [firebaseUser]);

  useEffect(() => {
    async function fetchAllPreviews() {
      const entries = await Promise.all(
        videoMessages.map(async (msg) => {
          try {
            const res = await fetch(`/api/preview?url=${encodeURIComponent(msg.url)}`);
            const data = await res.json();
            return [msg.url, data];
          } catch {
            return [msg.url, {}];
          }
        })
      );
      setPreviews(Object.fromEntries(entries));
    }
    if (videoMessages.length > 0) fetchAllPreviews();
  }, [videoMessages]);

  useEffect(() => {
    if (!firebaseUser) return;
    const viewsKey = "local_video_views";
    const currentViews = parseInt(localStorage.getItem(viewsKey) || "0", 10) + 1;
    localStorage.setItem(viewsKey, currentViews.toString());
    if (currentViews === 10) setShowReferral(true);
  }, [videoMessages.length, firebaseUser]);

  // --- VIDEO COUNT BADGE LOGIC (NEW) ---
  useEffect(() => {
    if (!firebaseUser) {
      setVideoCount(0);
      return;
    }
    const unseenKey = `unseen_videos_${firebaseUser.uid}`;
    const seenIds: string[] = JSON.parse(localStorage.getItem(unseenKey) || "[]");
    const unseen = videoMessages
      .map((msg) => msg.id)
      .filter((id) => !seenIds.includes(id));
    setVideoCount(unseen.length);

    // When visiting, mark all as seen
    if (unseen.length > 0) {
      localStorage.setItem(
        unseenKey,
        JSON.stringify(videoMessages.map((msg) => msg.id))
      );
      setVideoCount(0); // Clear badge
    }
  }, [firebaseUser, videoMessages]);

  const handleLogout = () => {
    const auth = getAuth();
    auth.signOut();
  };

  const handleLogin = async () => {
    const auth = getAuth(firebaseApp);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      alert("Login failed.");
    }
  };

  const ringColor = "ring-4 ring-pink-400/70 dark:ring-blue-400/60";
  const glow = "shadow-2xl shadow-pink-300/60 dark:shadow-blue-900/60";
  const cardBg =
    "bg-gradient-to-r from-[#dbeafe]/90 via-[#f3e8ff]/80 to-[#ffe4e6]/90 dark:from-[#39147b]/80 dark:via-[#222251]/90 dark:to-[#52143e]/80";
  const popBtn =
    "hover:scale-105 hover:shadow-pink-400/50 hover:z-10 transition-transform transition-shadow duration-200";

  // === ENLARGE VIDEO SECTION: use max-w-6xl and h-[430px] for videos ===
  return (
    <div className={dark ? "dark" : ""}>
      <NavBar
        dark={dark}
        setDark={setDark}
        firebaseUser={firebaseUser}
        handleLogout={handleLogout}
        handleLogin={handleLogin}
        setSignupPrompt={setSignupPrompt}
        unreadCount={unreadCount}
        videoCount={videoCount}
      />
      {/* --- Interesting Content Sides --- */}
      <InterestingLeft />
      <InterestingRight />
      {/* --- Main Content --- */}
      <main className="w-full min-h-screen bg-gradient-to-br from-[#a5d8fa] via-pink-100/70 to-[#fff] dark:from-[#232144] dark:via-[#3d2367] dark:to-[#2c1330] pt-24 pb-24 flex justify-center relative">
        {/* Add paddings to avoid overlap with side asides */}
        <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col items-center px-2 lg:px-0" style={{ minWidth: 0 }}>
          <section className="max-w-2xl mx-auto pt-10 px-2">
            <h1 className="font-extrabold text-6xl md:text-7xl text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-pink-400 to-pink-600 dark:from-pink-200 dark:via-blue-400 dark:to-blue-200 text-center tracking-widest drop-shadow-2xl mb-4 uppercase animate-pulse">
              <span className="hover:animate-bounce transition">🔥 Top Reels 🔥</span>
            </h1>
            <p className="text-gray-700 dark:text-pink-100 text-center mb-10 text-xl font-medium">
              <span className="font-bold text-pink-700 dark:text-pink-200">Watch, React, Share</span>
              <span className="ml-2 text-blue-700 dark:text-blue-200">and Connect with trends!</span>
            </p>
            {firebaseUser ? (
              <div className="flex items-center justify-center mb-8 gap-4">
                <img
                  src={firebaseUser.photoURL || `https://api.dicebear.com/7.x/thumbs/svg?seed=${firebaseUser.displayName || firebaseUser.email}`}
                  alt={firebaseUser.displayName || firebaseUser.email || "user"}
                  className={`w-14 h-14 rounded-full border-4 border-pink-400 dark:border-blue-400 ${ringColor} ${glow}`}
                />
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-pink-400 to-pink-700 bg-clip-text text-transparent dark:from-pink-200 dark:via-blue-300 dark:to-blue-100 animate-gradient-x">
                  Welcome, {firebaseUser.displayName || firebaseUser.email || "User"}!
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center mb-8">
                <span className="text-lg text-gray-400 dark:text-gray-300 italic bg-white/60 dark:bg-[#232144]/60 px-6 py-2 rounded-2xl shadow">
                  You are not signed in. Sign in to comment and like reels!
                </span>
              </div>
            )}
          </section>
          <div
            className={`
              w-full max-w-6xl mx-auto grid grid-cols-1 gap-12
              ${cardBg}
              rounded-3xl p-8 shadow-2xl border-2 border-pink-200 dark:border-blue-500
              ${glow}
              scrollbar-thin scrollbar-thumb-pink-300 dark:scrollbar-thumb-blue-400
              backdrop-blur-[4px]
            `}
          >
            {videoMessages.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center rounded-xl bg-white/80 dark:bg-neutral-900/80 text-center shadow-inner ring-4 ring-pink-200 dark:ring-blue-500 animate-fadeIn">
                <p className="text-gray-400 dark:text-pink-100 italic text-xl animate-pulse">No videos yet</p>
              </div>
            ) : (
              videoMessages.map(
                ({
                  id,
                  url,
                  owner,
                  createdAt,
                  stats,
                  key,
                  ownerPhotoURL,
                }) => {
                  const preview = previews[url];
                  const videoSrc = preview?.video || url;
                  const youtubeId = getYouTubeId(url);
                  return (
                    <div
                      key={id}
                      className={`
                        ${cardBg} ${ringColor} ${glow}
                        rounded-[2rem] shadow-2xl border-2 border-pink-200 dark:border-blue-600
                        p-6 group relative overflow-hidden animate-fadeIn
                        hover:scale-[1.025] hover:z-50 transition-transform duration-300
                        w-full
                      `}
                    >
                      <div className="absolute -top-12 -left-12 w-48 h-48 bg-pink-200 dark:bg-blue-950 rounded-full blur-3xl opacity-70 pointer-events-none z-0"></div>
                      <div className="rounded-2xl overflow-hidden shadow-xl border-4 border-white dark:border-blue-900 bg-black/40 group-hover:scale-105 transition-transform duration-200 relative z-20 w-full">
                        {youtubeId ? (
                          <iframe
                            width="100%"
                            height="430"
                            src={`https://www.youtube.com/embed/${youtubeId}`}
                            title="YouTube video"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-[430px] object-cover rounded-2xl"
                          />
                        ) : (
                          <video
                            src={videoSrc}
                            controls
                            poster={getPreviewImage(preview)}
                            className="w-full h-[430px] object-cover rounded-2xl"
                            preload="metadata"
                          />
                        )}
                        <span className="absolute top-4 left-4 bg-gradient-to-br from-blue-600 to-pink-600 text-white text-sm font-extrabold px-4 py-1.5 rounded-full shadow-lg border border-white/40 animate-pulse">
                          {formatTimeAgo(createdAt)}
                        </span>
                        <span className="absolute top-4 right-4 bg-gradient-to-br from-pink-400 to-blue-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow border-2 border-white/30 animate-bounce">
                          <FaEye className="inline mr-1" /> {stats.views}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-6 mb-4 z-30 relative">
                        <img
                          src={
                            ownerPhotoURL && ownerPhotoURL.length > 0
                              ? ownerPhotoURL
                              : `https://api.dicebear.com/7.x/thumbs/svg?seed=${owner}`
                          }
                          alt={owner}
                          className="w-14 h-14 rounded-full border-4 border-pink-400 dark:border-blue-400 shadow-lg"
                        />
                        <span className="font-extrabold text-2xl text-pink-700 dark:text-blue-100 drop-shadow bg-gradient-to-r from-pink-600 via-blue-500 to-blue-300 bg-clip-text text-transparent animate-gradient-x">
                          {owner}
                        </span>
                        <div className="flex-1" />
                        <button
                          className={`rounded-full px-3 py-2 text-lg bg-gradient-to-r from-pink-400 via-blue-400 to-pink-400 text-white shadow-lg border-2 border-white/30 hover:scale-110 ${popBtn}`}
                          onClick={() => {
                            setShareUrl(url);
                            setShowShare(true);
                            setTimeout(() => setShowShare(false), 7000);
                          }}
                          title="Share"
                        >
                          <FaShareAlt />
                        </button>
                      </div>
                      <button
                        type="button"
                        className={`w-full mt-6 py-4 bg-gradient-to-tr from-pink-600 via-blue-500 to-pink-400 text-white font-extrabold text-xl rounded-2xl shadow-lg flex items-center justify-center gap-4 border-4 border-white/30 hover:from-pink-700 hover:to-blue-600 hover:scale-105 ring-2 ring-blue-300 dark:ring-pink-500 ${popBtn}`}
                        onClick={() => {
                          setCommentMsgKey(id);
                          setShowCommentModal(true);
                        }}
                      >
                        <FaCommentDots className="text-2xl" />
                        View Comment &amp; Stats
                      </button>
                      <div className="flex flex-wrap gap-6 justify-between mt-8 px-2 text-xl font-bold">
                        <div className="flex items-center gap-2 text-pink-600 drop-shadow-sm animate-bounce">
                          <FaHeart /> {stats.likes}
                        </div>
                        <div className="flex items-center gap-2 text-green-600 drop-shadow-sm animate-spin-slow">
                          <FaShareAlt /> {stats.shares}
                        </div>
                        <div className="flex items-center gap-2 text-blue-600 drop-shadow-sm">
                          <FaBookmark /> {stats.saves}
                        </div>
                        <div className="flex items-center gap-2 text-pink-700 drop-shadow-sm animate-pulse">
                          <FaCommentDots /> {stats.comments}
                        </div>
                        <div className="flex items-center gap-2 text-green-700 drop-shadow-sm">
                          <FaShoppingCart /> {stats.purchases}
                        </div>
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>
        </div>
        {showShare && shareUrl && (
          <div
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] px-8 pt-7 pb-6 rounded-3xl shadow-2xl font-extrabold text-white bg-gradient-to-br from-blue-600 via-pink-500 to-pink-600 transition-all duration-500 pointer-events-auto opacity-100 scale-100 border-2 border-white/20 animate-fadeIn"
            role="status"
            aria-live="polite"
          >
            <div className="mb-4 text-center text-2xl font-bold tracking-wide uppercase">Share on social media</div>
            <div className="flex flex-wrap gap-5 justify-center mb-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 px-3 py-2 text-white hover:text-green-200 transition"
                title="Share on WhatsApp"
              >
                <FaWhatsapp className="text-2xl text-green-400" />
                <span className="text-xs font-bold">WhatsApp</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 px-3 py-2 text-white hover:text-blue-200 transition"
                title="Share on Facebook"
              >
                <FaFacebookF className="text-2xl text-blue-600" />
                <span className="text-xs font-bold">Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 px-3 py-2 text-white hover:text-blue-300 transition"
                title="Share on LinkedIn"
              >
                <FaLinkedinIn className="text-2xl text-blue-400" />
                <span className="text-xs font-bold">LinkedIn</span>
              </a>
              <button
                className="flex flex-col items-center gap-1 px-3 py-2 text-white hover:text-pink-200 transition"
                title="Copy link to share on Instagram"
                onClick={() => navigator.clipboard.writeText(shareUrl)}
              >
                <FaInstagram className="text-2xl text-pink-400" />
                <span className="text-xs font-bold">Instagram</span>
              </button>
              <button
                className="flex flex-col items-center gap-1 px-3 py-2 text-white hover:text-black transition"
                title="Copy link to share on TikTok"
                onClick={() => navigator.clipboard.writeText(shareUrl)}
              >
                <FaTiktok className="text-2xl text-black" />
                <span className="text-xs font-bold">TikTok</span>
              </button>
              <button
                className="flex flex-col items-center gap-1 px-3 py-2 text-white hover:text-gray-300 transition"
                title="Copy link"
                onClick={() => navigator.clipboard.writeText(shareUrl)}
              >
                <FaCopy className="text-2xl" />
                <span className="text-xs font-bold">Copy Link</span>
              </button>
            </div>
            <button
              className="block mx-auto mt-3 text-sm underline text-blue-100 hover:text-pink-100"
              onClick={() => setShowShare(false)}
            >
              Close
            </button>
          </div>
        )}
        {showCommentModal && commentMsgKey && (
          <CommentModal
            msgKey={commentMsgKey}
            user={firebaseUser}
            onClose={closeCommentModal}
          />
        )}
        <ReferralPopup open={showReferral} onClose={() => setShowReferral(false)} user={firebaseUser} />
      </main>
      <style jsx global>{`
        .animate-fadeIn {
          animation: fadeIn 1s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: none; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradientMoveX 3s ease-in-out infinite;
        }
        @keyframes gradientMoveX {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-spin-slow {
          animation: spin 3.5s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}