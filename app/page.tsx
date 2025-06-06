"use client";

import { useEffect, useState, useRef } from "react";
import {
  FaHeart,
  FaEye,
  FaShareAlt,
  FaFacebook,
  FaBookmark,
  FaShoppingCart,
  FaCommentDots,
  
  FaUserPlus,
  
  FaCheck,
  
  FaGithub,
  FaTwitter,
  FaInstagram,
  FaGlobe,
  FaLinkedin,
  FaEnvelope,
  FaSignOutAlt,
  
  FaGoogle,
  FaWhatsapp,
  FaTiktok,
  FaCopy,
  FaFacebookF,
  FaLinkedinIn,
} from "react-icons/fa";
import {
  getAuth,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  User,
} from "firebase/auth";
import { app as firebaseApp } from "../firebase";
import {
  getDatabase,
  ref,
  push,
  onValue,
  off,
  DataSnapshot,
  update,
  get,
  set,
  remove,
} from "firebase/database";
import { AddFriends } from "./addfriend/page";
import { saveUserProfile } from "./addfriend/page";
import { useUserProfile } from "./userprofile/page";
import React from "react";
import CommentModal from "./comments/page";
import NavBar from "./nav/page";
import { useUnreadCount } from "./useunreadcount/page";
// import { useUnreadCount } from "./useunreadcount/page";

// --- Types ---
type Stats = {
  likes: number;
  views: number;
  shares: number;
  saves: number;
  comments: number;
  purchases: number;
};

type Message = {
  id: number;
  from: "me" | "other";
  url: string;
  owner: string;
  createdAt: string;
  stats: Stats;
  key?: string;
  ownerPhotoURL?: string;
  notifications?: Record<string, { seen: boolean }>;
  ownerUid?: string;
};

function getYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1);
    }
    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtube-nocookie.com")
    ) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      const match = parsed.pathname.match(/\/(embed|v)\/([^/?]+)/);
      if (match) return match[2];
    }
  } catch (e) {}
  const regExp =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// --- Utils ---
function formatTimeAgo(dateString: string) {
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

function defaultStats(): Stats {
  return {
    likes: 0,
    views: 0,
    shares: 0,
    saves: 0,
    comments: 0,
    purchases: 0,
  };
}

function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (
      typeof localStorage !== "undefined" &&
      localStorage.getItem("theme")
    ) {
      return localStorage.getItem("theme") === "dark";
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const localTheme = localStorage.getItem("theme");
    if (!localTheme) {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        setDark(true);
      } else {
        setDark(false);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const localTheme = localStorage.getItem("theme");
    if (localTheme) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return [dark, setDark] as const;
}

// --- Main Home ---
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [previews, setPreviews] = useState<Record<string, any>>({});
  const [inputUrl, setInputUrl] = useState("");
  const [dark, setDark] = useDarkMode();
  const inputRef = useRef<HTMLInputElement>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [signupPrompt, setSignupPrompt] = useState(false);

  // Share popup state
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // State for comment modal
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentMsgKey, setCommentMsgKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
   const unreadCount = useUnreadCount(firebaseUser);
  const [notifCount, setNotifCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  
  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const unsub = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsub();
  }, []);
  // --- Notifications: Count unseen notifications for this user
  useEffect(() => {
    if (!firebaseUser) return;
    const db = getDatabase(firebaseApp);
    const messagesRef = ref(db, "messages");
    const handleValue = (snapshot) => {
      const data = snapshot.val() || {};
      const newNotifs = Object.values(data).filter(
        (msg: any) =>
          msg.notifications &&
          msg.notifications[firebaseUser.uid] &&
          !msg.notifications[firebaseUser.uid].seen
      );
      setNotifCount(newNotifs.length);
    };
    onValue(messagesRef, handleValue);
    return () => off(messagesRef, "value", handleValue);
  }, [firebaseUser]);

  // Handler to open modal for a given message key
  const openCommentModal = (msg: Message) => {
    setCommentMsgKey(msg.key!);
    setShowCommentModal(true);
  };
  const closeCommentModal = () => {
    setShowCommentModal(false);
    setCommentMsgKey(null);
  };

  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        saveUserProfile(user);
        setFirebaseUser(user);
      } else {
        setFirebaseUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const db = getDatabase(firebaseApp);
    const messagesRef = ref(db, "messages");
    const handleValue = (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        return;
      }
      const arr: Message[] = Object.entries(data)
        .map(([key, msg]: [string, any]) => ({
          ...msg,
          createdAt: msg.createdAt || new Date().toISOString(),
          stats: msg.stats || defaultStats(),
          key,
        }))
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
      setMessages(arr);
    };
    onValue(messagesRef, handleValue);
    return () => off(messagesRef, "value", handleValue);
  }, []);

  const handleLogin = async () => {
    const auth = getAuth(firebaseApp);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      alert("Login failed.");
    }
  };

  const handleSignup = async () => {
    setSignupPrompt(false);
    await handleLogin();
  };

  const handleLogout = async () => {
    const auth = getAuth(firebaseApp);
    await signOut(auth);
    setFirebaseUser(null);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const fetchPreview = async (url: string) => {
    const res = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    const isDirectVideo = /\.(mp4|webm|ogg)$/i.test(url);
    const isYouTube = /youtu\.?be/.test(url);
    const ogVideo = data.ogVideo?.url || (isDirectVideo || isYouTube ? url : null);
    return {
      ...data,
      video: ogVideo,
    };
  };

  const isVideoMessage = (msg: Message, previews: Record<string, any>) => {
    const preview = previews[msg.url];
    const isDirectVideo = /\.(mp4|webm|ogg)$/i.test(msg.url);
    const isYouTube = /youtu\.?be/.test(msg.url);
    const hasVideoMeta = preview?.video;
    return isDirectVideo || isYouTube || !!hasVideoMeta;
  };

  const videoMessages = messages.filter((msg) => isVideoMessage(msg, previews));
  const nonVideoMessages = messages.filter((msg) => !isVideoMessage(msg, previews));
  useEffect(() => {
    if (!firebaseUser) {
      setVideoCount(0);
      return;
    }
    const seenKey = `unseen_videos_${firebaseUser.uid}`;
    const allVideoIds = videoMessages.map((msg) => String(msg.id));
    const seenIds: string[] = JSON.parse(localStorage.getItem(seenKey) || "[]");
    const unseen = allVideoIds.filter((id) => !seenIds.includes(id));
    setVideoCount(unseen.length);

    // Mark all as seen and clear badge as soon as videos are available
    if (unseen.length > 0) {
      localStorage.setItem(seenKey, JSON.stringify(allVideoIds));
      setVideoCount(0);
    }
  }, [firebaseUser, videoMessages.length]);
 
  useEffect(() => {
    messages.forEach(async (msg) => {
      if (!previews[msg.url]) {
        const preview = await fetchPreview(msg.url);
        setPreviews((prev) => ({ ...prev, [msg.url]: preview }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);
  // --- Post with notification ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    if (!firebaseUser) {
      setSignupPrompt(true);
      return;
    }
    const trimmedUrl = inputUrl.trim();

    // 1. Get all users from Firebase
    const db = getDatabase(firebaseApp);
    const usersRef = ref(db, "users");
    const usersSnap = await get(usersRef);
    const users = usersSnap.val() || {};

    // 2. Prepare notifications object for all users except sender
    const notifications: Record<string, { seen: boolean }> = {};
    Object.entries(users).forEach(([uid]) => {
      if (uid !== firebaseUser.uid) {
        notifications[uid] = { seen: false };
      }
    });

    // 3. Compose the new message
    const newMsg: Message = {
      id: Date.now(),
      from: "me",
      url: trimmedUrl,
      owner: firebaseUser?.displayName || firebaseUser?.email || "You",
      createdAt: new Date().toISOString(),
      stats: defaultStats(),
      ownerPhotoURL: firebaseUser?.photoURL || "",
      notifications, // <-- notification object!
      ownerUid: firebaseUser.uid, // <-- add ownerUid!
    };

    // 4. Push to messages in Firebase
    const messagesRef = ref(db, "messages");
    await push(messagesRef, newMsg);
    setInputUrl("");
    inputRef.current?.focus();
    if (!previews[trimmedUrl]) {
      const preview = await fetchPreview(trimmedUrl);
      setPreviews((prev) => ({ ...prev, [trimmedUrl]: preview }));
    }
  };

  // --- Helper for per-user stats (toggle for like, add for others) ---
  const handleUserStat = async (
    msgKey: string,
    stat: keyof Stats,
    mode: "toggle" | "add",
    payload?: any
  ) => {
    if (!firebaseUser) {
      setSignupPrompt(true);
      return;
    }
    const db = getDatabase(firebaseApp);
    const uid = firebaseUser.uid;
    const userStatRef = ref(db, `messages/${msgKey}/${stat}/${uid}`);
    const statsRef = ref(db, `messages/${msgKey}/stats`);
    const statRef = ref(db, `messages/${msgKey}/${stat}`);

    if (mode === "toggle") {
      const snap = await get(userStatRef);
      if (snap.exists()) {
        await remove(userStatRef);
      } else {
        await set(userStatRef, true);
      }
    } else {
      await set(userStatRef, Date.now());
    }

    // Update count in stats
    const statSnap = await get(statRef);
    const count = statSnap.exists()
      ? Object.keys(statSnap.val()).length
      : 0;
    await update(statsRef, { [stat]: count });

    // --- NOTIFICATION LOGIC HERE ---
    // 1. Find ownerUid
    const msgRef = ref(db, `messages/${msgKey}`);
    const msgSnap = await get(msgRef);
    if (!msgSnap.exists()) return;
    const msgData = msgSnap.val();
    const ownerUid = msgData.ownerUid;

    // 2. Only notify the owner if the current user is not the owner
    if (ownerUid && ownerUid !== firebaseUser.uid) {
      const notifRef = ref(db, `messages/${msgKey}/notifications/${ownerUid}`);
      await update(notifRef, { seen: false });
    }

    // Special UI logic...
    if (stat === "shares" && payload?.url) {
      setShareUrl(payload.url);
      setShowShare(true);
      setTimeout(() => setShowShare(false), 7000);
    }
    if (stat === "purchases" && payload?.url) {
      window.open(payload.url, "_blank", "noopener");
    }
    if (stat === "saves" && payload?.url) {
      try {
        await navigator.clipboard.writeText(payload.url);
        setToast("Link copied!");
        setTimeout(() => setToast(null), 2000);
      } catch (err) {
        setToast("Failed to copy link!");
        setTimeout(() => setToast(null), 2000);
      }
    }
  };

  // Old logic for comments (just increments, but should use comment count)
  const handleStat = async (msgKey: string, stat: keyof Stats, payload?: any) => {
    if (stat === "likes") {
      handleUserStat(msgKey, stat, "toggle");
      return;
    }
    if (["views", "shares", "saves", "purchases"].includes(stat)) {
      handleUserStat(msgKey, stat, "add", payload);
      return;
    }
    // Comments (handled by CommentModal)
  };

  // --- Register auto-view on first load for each post if user is logged in ---
  useEffect(() => {
    if (!firebaseUser) return;
    const db = getDatabase(firebaseApp);
    messages.forEach(async (msg) => {
      if (!msg.key) return;
      const viewRef = ref(db, `messages/${msg.key}/views/${firebaseUser.uid}`);
      const snap = await get(viewRef);
      if (!snap.exists()) {
        await set(viewRef, Date.now());
        const statRef = ref(db, `messages/${msg.key}/views`);
        const statSnap = await get(statRef);
        const count = statSnap.exists() ? Object.keys(statSnap.val()).length : 0;
        await update(ref(db, `messages/${msg.key}/stats`), { views: count });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, messages.length]);

  // --- User stats for highlighting buttons ---
  const [userStats, setUserStats] = useState<Record<
    string,
    { [K in keyof Stats]?: boolean }
  >>({});
  useEffect(() => {
    if (!firebaseUser) {
      setUserStats({});
      return;
    }
    const db = getDatabase(firebaseApp);
    const statTypes: (keyof Stats)[] = [
      "likes",
      "views",
      "shares",
      "saves",
      "purchases",
    ];
    const listeners: (() => void)[] = [];
    messages.forEach((msg) => {
      if (!msg.key) return;
      statTypes.forEach((stat) => {
        const statRef = ref(db, `messages/${msg.key}/${stat}/${firebaseUser.uid}`);
        const listener = onValue(statRef, (snap) => {
          setUserStats((prev) => {
            const next = { ...prev };
            if (!next[msg.key!]) next[msg.key!] = {};
            next[msg.key!][stat] = snap.exists();
            return { ...next };
          });
        });
        listeners.push(() => off(statRef, "value", listener));
      });
    });
    return () => listeners.forEach((offFn) => offFn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, messages.length]);

  function StatItem({
    icon,
    value,
    label,
    color,
    onClick,
    active,
  }: {
    icon: any;
    value: number;
    label: string;
    color?: string;
    onClick?: () => void;
    active?: boolean;
  }) {
    return (
      <button
        type="button"
        className={`flex items-center gap-2 ${color} ${active ? "font-bold" : ""}`}
        onClick={onClick}
        title={label}
      >
        <div className={`text-lg ${color || "text-blue-500"} mb-1`}>
          {icon}
        </div>
        <span className="font-bold">{value}</span>
        <span className="text-xs text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300">
          {label}
        </span>
      </button>
    );
  }

  return (
    <div className="relative flex flex-col min-h-screen bg-gradient-to-br from-violet-100 via-blue-100 to-pink-100 dark:from-[#18122B] dark:via-[#393053] dark:to-black transition-colors duration-300 p-4 sm:p-8 font-sans overflow-hidden">
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
      <div className="pointer-events-none absolute z-0">
        <div className="absolute top-12 left-16 w-40 h-40 bg-blue-300/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-52 h-52 bg-purple-300/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-32 h-32 bg-pink-200/30 rounded-full blur-2xl animate-pulse"></div>
      </div>

      <NavBar
  dark={dark}
  setDark={setDark}
  firebaseUser={firebaseUser}
  handleLogout={handleLogout}
  handleLogin={handleLogin}
  setSignupPrompt={setSignupPrompt}
  unreadCount={unreadCount}
   videoCount={videoCount}
  notifCount={notifCount}
     // <-- Add this line!
/>
      <header className="flex flex-col items-center text-center my-16 z-10 relative">
        <h1 className="mt-6 text-5xl font-black text-blue-700 dark:text-pink-200 mb-2 tracking-tighter drop-shadow">
          🔗 LooknLink <span className="animate-bounce"></span>
        </h1>
        <p className="text-base sm:text-lg text-gray-700 dark:text-gray-200 max-w-md mx-auto">
          Share <span className="font-semibold text-blue-600 dark:text-pink-300">links</span> for social appraisal, grow your <span className="font-semibold text-pink-600 dark:text-blue-200">network</span>, and let users buy your products—fast.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto w-full flex gap-2 mb-10 z-10 relative">
        <input
          ref={inputRef}
          type="url"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="Paste your link here (YouTube, Selar, or any product/video)..."
          required
          className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-[#393053] focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-pink-400 bg-white dark:bg-[#232144] text-gray-900 dark:text-white text-lg shadow"
          autoFocus
        />
        <button
          type="submit"
          className="flex items-center px-5 py-3 bg-gradient-to-br from-blue-600 to-pink-500 text-white rounded-xl font-bold hover:from-blue-800 hover:to-pink-700 transition shadow-lg focus:outline-none"
        >
          Post
        </button>
      </form>

      {signupPrompt && (
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center">
          <div className="bg-white dark:bg-[#232144] p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-gray-200 dark:border-[#393053] relative">
            <button
              onClick={() => setSignupPrompt(false)}
              className="absolute top-3 right-3 text-xl text-gray-400 hover:text-red-500"
              aria-label="Close"
            >
              &times;
            </button>
            <div className="flex flex-col items-center gap-3">
              <FaUserPlus size={38} className="text-blue-700 dark:text-pink-300 mb-1" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-pink-200">Signup Required</h2>
              <p className="text-center text-gray-600 dark:text-pink-100">Please sign up with Google before posting or interacting.</p>
              <button
                onClick={handleSignup}
                className="mt-3 px-5 py-3 bg-gradient-to-br from-green-500 to-blue-500 text-white rounded-lg flex items-center gap-2 font-medium hover:from-green-700 hover:to-blue-700 transition shadow text-lg"
              >
                <FaGoogle /> Sign Up with Google
              </button>
              <button
                onClick={() => setSignupPrompt(false)}
                className="mt-2 px-4 py-2 bg-gray-200 dark:bg-[#393053] rounded-lg font-medium text-gray-700 dark:text-pink-200 hover:bg-gray-300 dark:hover:bg-[#232144] transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex w-full gap-8 z-10 relative">
        <aside className="w-1/5 hidden xl:block">
          <div className="sticky top-24 space-y-8">
            <div className="bg-white dark:bg-[#232144] rounded-2xl p-5 shadow-xl text-center border border-gray-200 dark:border-[#393053]">
              <img
                src={firebaseUser?.photoURL || `https://api.dicebear.com/7.x/thumbs/svg?seed=You`}
                alt={firebaseUser?.displayName || firebaseUser?.email || "You"}
                className="w-20 h-20 rounded-full mx-auto mb-3 shadow-lg"
              />
              <h2 className="font-extrabold text-xl text-blue-700 dark:text-pink-200">
                {firebaseUser?.displayName || firebaseUser?.email || "You"}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {firebaseUser ? "Logged In" : "Guest"}
              </p>
              {firebaseUser ? (
                <button
                  onClick={handleLogout}
                  className="mt-3 px-4 py-2 bg-gradient-to-br from-red-500 to-pink-500 text-white rounded-lg flex items-center gap-2 font-medium hover:from-red-700 hover:to-pink-600 transition shadow"
                  title="Logout"
                >
                  <FaSignOutAlt /> Logout
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setSignupPrompt(true)}
                    className="mt-3 px-4 py-2 bg-gradient-to-br from-green-500 to-blue-500 text-white rounded-lg flex items-center gap-2 font-medium hover:from-green-700 hover:to-blue-700 transition shadow"
                    title="Sign up"
                  >
                    <FaUserPlus /> Sign Up
                  </button>
                  <button
                    onClick={handleLogin}
                    className="mt-3 px-4 py-2 bg-gradient-to-br from-blue-500 to-green-500 text-white rounded-lg flex items-center gap-2 font-medium hover:from-blue-700 hover:to-green-700 transition shadow"
                    title="Login with Google"
                  >
                    <FaGoogle /> Login
                  </button>
                </>
              )}
            </div>
            <div className="bg-white dark:bg-[#232144] rounded-2xl p-4 shadow-md border border-gray-200 dark:border-[#393053]">
              <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-pink-200">Your Posts</h3>
              <div className="flex flex-col space-y-3 max-h-[58vh] overflow-y-auto pr-2">
                {messages
                  .filter((msg) => msg.from === "me")
                  .map(({ id, url, createdAt }) => {
                    const preview = previews[url];
                    const imageUrl = Array.isArray(preview?.ogImage)
                      ? preview.ogImage[0]?.url
                      : preview?.ogImage?.url;
                    const isVideo = /\.(mp4|webm|ogg)$/i.test(url) || /youtu\.?be/.test(url) || preview?.video;

                    return (
                      <div key={id} className="group p-2 rounded-lg hover:bg-blue-100/70 dark:hover:bg-pink-200/10 transition cursor-pointer">
                        <div className="flex items-center gap-2">
                          {isVideo ? (
                            <video
                              src={preview?.video || url}
                              controls
                              className="w-14 h-14 object-cover rounded-lg shadow border"
                              preload="metadata"
                            />
                          ) : imageUrl ? (
                            <img
                              src={imageUrl}
                              alt="Thumbnail"
                              className="w-12 h-12 rounded-md object-cover flex-shrink-0 shadow"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-md bg-gray-200 dark:bg-[#393053]" />
                          )}
                          <div className="flex-1 flex flex-col">
                            <p className="text-xs font-semibold text-blue-600 dark:text-pink-200 group-hover:underline line-clamp-2">
                              {preview?.ogTitle || "No title"}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">
                              {preview?.ogDescription || "No description"}
                            </p>
                            <span className="text-[10px] text-gray-400 mt-1">{formatTimeAgo(createdAt)}</span>
                          </div>
                          <button
                            onClick={() => {
                              setShareUrl(url);
                              setShowShare(true);
                              setTimeout(() => setShowShare(false), 7000);
                            }}
                            className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-pink-400 transition"
                            title="Share"
                          >
                            <FaShareAlt />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            <AddFriends firebaseUser={firebaseUser} />
          </div>
        </aside>

        <main className="flex-1 flex flex-col gap-7 max-w-3xl mx-auto">
          {nonVideoMessages.length === 0 && (
            <div className="text-center mt-10 text-gray-500 dark:text-gray-300 animate-pulse">No posts yet. Be the first to share a link!</div>
          )}
          {nonVideoMessages.map(
            ({
              id,
              from,
              url,
              owner,
              createdAt,
              stats,
              key,
              ownerPhotoURL,
            }) => {
              const isMe = from === "me";
              const preview = previews[url];
              const imageUrl = Array.isArray(preview?.ogImage)
                ? preview.ogImage[0]?.url
                : preview?.ogImage?.url;

              return (
                <div key={id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[90%] w-fit p-5 rounded-2xl shadow-xl border border-gray-200 dark:border-[#393053] flex flex-col space-y-3 relative
                  ${isMe
                      ? "bg-gradient-to-br from-blue-600 to-pink-500 text-white rounded-br-none"
                      : "bg-white dark:bg-[#232144] text-gray-900 dark:text-pink-50 rounded-bl-none"
                    }
                  hover:scale-[1.02] transition-transform duration-200`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <img
                        src={
                          ownerPhotoURL && ownerPhotoURL.length > 0
                            ? ownerPhotoURL
                            : `https://api.dicebear.com/7.x/thumbs/svg?seed=${owner}`
                        }
                        alt={owner}
                        className="w-8 h-8 rounded-full"
                      />
                      <span className="text-sm font-bold">{owner}</span>
                      {isMe && <span className="ml-1 text-green-300"><FaCheck /></span>}
                      <span className="text-xs text-gray-800 dark:text-gray-400 ml-2">{formatTimeAgo(createdAt)}</span>
                    </div>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] font-medium underline break-words hover:text-blue-200 dark:hover:text-pink-300"
                    >
                      {url}
                    </a>
                    {preview && (
                      <div className="mt-2 border border-gray-200 dark:border-[#393053] rounded-lg p-4 bg-white/80 dark:bg-[#393053]/60 text-left shadow">
                        <h3 className="text-base font-bold mb-1 text-gray-800 dark:text-white break-words truncate">
                          {preview.ogTitle || "No title"}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-200 break-words truncate">
                          {preview.ogDescription || "No description available."}
                        </p>
                        {imageUrl && (
                          <img
                            src={imageUrl}
                            alt={preview.ogTitle || "Preview image"}
                            className="mt-3 rounded-md w-full max-h-60 object-cover shadow"
                          />
                        )}

                        <div className="flex gap-3 mt-2">
                          <StatItem
                            icon={<FaHeart />}
                            value={stats.likes}
                            label="Likes"
                            color="text-pink-500"
                            onClick={() => handleStat(key!, "likes")}
                            active={key && userStats[key]?.likes}
                          />
                          <StatItem
                            icon={<FaEye />}
                            value={stats.views}
                            label="Views"
                            color="text-blue-500"
                            // auto-increment handled by useEffect, button for info only
                            onClick={() => {}}
                            active={key && userStats[key]?.views}
                          />
                          <StatItem
                            icon={<FaShareAlt />}
                            value={stats.shares}
                            label="Shares"
                            color="text-green-500"
                            onClick={() => handleStat(key!, "shares", { url })}
                            active={key && userStats[key]?.shares}
                          />
                          <StatItem
                            icon={<FaBookmark />}
                            value={stats.saves}
                            label="Saves"
                            color="text-yellow-500"
                            onClick={() => handleStat(key!, "saves", { url })}
                            active={key && userStats[key]?.saves}
                          />
                          <StatItem
                            icon={<FaCommentDots />}
                            value={stats.comments}
                            label="Comments"
                            color="text-purple-500"
                            onClick={() => openCommentModal({ id, from, url, owner, createdAt, stats, key, ownerPhotoURL })}
                          />
                          <StatItem
                            icon={<FaShoppingCart />}
                            value={stats.purchases}
                            label="Purchases"
                            color="text-indigo-500"
                            onClick={() => handleStat(key!, "purchases", { url })}
                            active={key && userStats[key]?.purchases}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </main>

        <aside className="w-1/5 hidden xl:block">
      <div className="sticky top-24">
        <div className="
          bg-gradient-to-br from-white via-blue-50 to-pink-50 
          dark:from-[#232144] dark:via-[#2e295a] dark:to-[#3a1853]
          rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-[#393053] 
          space-y-8 max-h-[calc(100vh-6rem)] overflow-y-auto
          scrollbar-thin scrollbar-thumb-blue-300 dark:scrollbar-thumb-pink-300
          backdrop-blur-[2px]
        ">
          <h3 className="
            font-extrabold text-2xl mb-5 text-transparent bg-clip-text 
            bg-gradient-to-r from-blue-700 to-pink-500 dark:from-pink-200 dark:to-blue-300
            text-center tracking-wide drop-shadow
          ">
            Top Reels
          </h3>

          {videoMessages.length === 0 ? (
            <p className="text-gray-400 dark:text-pink-100 text-center italic">No videos yet</p>
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
                    className="
                      mb-7 rounded-2xl overflow-hidden shadow-xl
                      hover:scale-[1.025] hover:shadow-2xl transition-transform duration-200 cursor-pointer
                      bg-gradient-to-tr from-blue-100/60 to-pink-100/50 dark:from-pink-200/10 dark:to-blue-300/10
                      border border-white/60 dark:border-pink-400/10
                      p-2 group
                    "
                  >
                    <div className="rounded-xl overflow-hidden">
                      {youtubeId ? (
                        <iframe
                          width="100%"
                          height="250"
                          src={`https://www.youtube.com/embed/${youtubeId}`}
                          title="YouTube video"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="w-full h-44 object-cover rounded-xl border border-blue-100 dark:border-pink-400/10 group-hover:border-blue-400 dark:group-hover:border-pink-300 transition"
                        />
                      ) : (
                        <video
                          src={videoSrc}
                          controls
                          poster={Array.isArray(preview?.ogImage) ? preview.ogImage[0]?.url : preview?.ogImage?.url}
                          className="w-full h-44 object-cover rounded-xl border border-blue-100 dark:border-pink-400/10 group-hover:border-blue-400 dark:group-hover:border-pink-300 transition"
                          preload="metadata"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3 px-2 gap-2">
                      <img
                        src={
                          ownerPhotoURL && ownerPhotoURL.length > 0
                            ? ownerPhotoURL
                            : `https://api.dicebear.com/7.x/thumbs/svg?seed=${owner}`
                        }
                        alt={owner}
                        className="w-7 h-7 rounded-full border-2 border-blue-300 dark:border-pink-300 shadow"
                      />
                      <p className="flex-1 text-xs text-gray-700 dark:text-pink-100 truncate text-center font-medium ml-2">
                        {owner}
                      </p>
                      <span className="text-[11px] text-gray-400 dark:text-pink-200 font-mono">
                        {formatTimeAgo(createdAt)}
                      </span>
                      <button
                        className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-pink-400 transition"
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
                      onClick={() => {
                        setCommentMsgKey(key);
                        setShowCommentModal(true);
                      }}
                      className="
                        w-full mt-3 px-4 py-2
                        bg-gradient-to-br from-blue-600 via-pink-500 to-pink-400
                        text-white rounded-xl font-semibold
                        hover:from-blue-800 hover:to-pink-700 transition
                        drop-shadow-lg shadow-pink-100 dark:shadow-pink-700
                        focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-pink-300
                      "
                    >
                      View Comments &amp; Stats
                    </button>
                  </div>
                );
              }
            )
          )}
        </div>
      </div>
      {/* Social Share Popup */}
      {showShare && shareUrl && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] px-6 pt-5 pb-4 rounded-2xl shadow-xl font-semibold text-white bg-gradient-to-br from-blue-600 to-pink-500 transition-all duration-500 pointer-events-auto opacity-100 scale-100"
          role="status"
          aria-live="polite"
        >
          <div className="mb-2 text-center text-base font-bold">Share on social media</div>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 px-2 py-1 text-white hover:text-green-200 transition"
              title="Share on WhatsApp"
            >
              <FaWhatsapp className="text-green-500" />
              <span className="text-xs">WhatsApp</span>
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 px-2 py-1 text-white hover:text-blue-200 transition"
              title="Share on Facebook"
            >
              <FaFacebookF className="text-blue-700" />
              <span className="text-xs">Facebook</span>
            </a>
            <a
              href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 px-2 py-1 text-white hover:text-blue-300 transition"
              title="Share on LinkedIn"
            >
              <FaLinkedinIn className="text-blue-600" />
              <span className="text-xs">LinkedIn</span>
            </a>
            <button
              className="flex flex-col items-center gap-1 px-2 py-1 text-white hover:text-pink-200 transition"
              title="Copy link to share on Instagram"
              onClick={() => navigator.clipboard.writeText(shareUrl)}
            >
              <FaInstagram className="text-pink-500" />
              <span className="text-xs">Instagram</span>
            </button>
            <button
              className="flex flex-col items-center gap-1 px-2 py-1 text-white hover:text-black transition"
              title="Copy link to share on TikTok"
              onClick={() => navigator.clipboard.writeText(shareUrl)}
            >
              <FaTiktok className="text-black" />
              <span className="text-xs">TikTok</span>
            </button>
            <button
              className="flex flex-col items-center gap-1 px-2 py-1 text-white hover:text-gray-300 transition"
              title="Copy link"
              onClick={() => navigator.clipboard.writeText(shareUrl)}
            >
              <FaCopy />
              <span className="text-xs">Copy Link</span>
            </button>
          </div>
          <button
            className="block mx-auto mt-3 text-xs underline text-blue-200 hover:text-pink-100"
            onClick={() => setShowShare(false)}
          >
            Close
          </button>
        </div>
      )}
    </aside>
      </div>

      {/* Share Popup */}
      {showShare && shareUrl && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] px-6 pt-5 pb-4 rounded-2xl shadow-xl font-semibold text-white bg-gradient-to-br from-blue-600 to-pink-500 transition-all duration-500 pointer-events-auto opacity-100 scale-100"
          role="status"
          aria-live="polite"
        >
          <div className="mb-2 text-center text-base font-bold">Share on social media</div>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 px-2 py-1 text-white hover:text-green-200 transition"
              title="Share on WhatsApp"
            >
              <FaWhatsapp className="text-green-500" />
              <span className="text-xs">WhatsApp</span>
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 px-2 py-1 text-white hover:text-blue-200 transition"
              title="Share on Facebook"
            >
              <FaFacebook className="text-blue-700" />
              <span className="text-xs">Facebook</span>
            </a>
            <a
              href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 px-2 py-1 text-white hover:text-blue-300 transition"
              title="Share on LinkedIn"
            >
              <FaLinkedin className="text-blue-600" />
              <span className="text-xs">LinkedIn</span>
            </a>
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 px-2 py-1 text-white hover:text-blue-100 transition"
              title="Share on Twitter"
            >
              <FaTwitter className="text-blue-400" />
              <span className="text-xs">Twitter</span>
            </a>
            <button
              className="flex flex-col items-center gap-1 px-2 py-1 text-white hover:text-pink-200 transition"
              title="Copy link to share on Instagram"
              onClick={() => navigator.clipboard.writeText(shareUrl)}
            >
              <FaInstagram className="text-pink-500" />
              <span className="text-xs">Instagram</span>
            </button>
            <button
              className="flex flex-col items-center gap-1 px-2 py-1 text-white hover:text-black transition"
              title="Copy link to share on TikTok"
              onClick={() => navigator.clipboard.writeText(shareUrl)}
            >
              <FaTiktok className="text-black" />
              <span className="text-xs">TikTok</span>
            </button>
          </div>
          <button
            className="block mx-auto mt-3 text-xs underline text-blue-200 hover:text-pink-100"
            onClick={() => setShowShare(false)}
          >
            Close
          </button>
        </div>
      )}

      {/* Only one CommentModal here, with correct props */}
      {showCommentModal && commentMsgKey && (
        <CommentModal
          msgKey={commentMsgKey}
          user={firebaseUser}
          onClose={closeCommentModal}
        />
      )}

<footer className="w-full max-w-full z-30 mt-auto pt-16 pb-6 px-2">
  <div className="max-w-6xl mx-auto rounded-3xl bg-white/80 dark:bg-[#232144]/70 shadow-2xl border border-gray-200 dark:border-[#393053] flex flex-col md:flex-row items-center md:items-start justify-between gap-6 px-6 py-8">
    <div className="flex-1 flex flex-col items-center md:items-start gap-2">
      <div className="flex items-center gap-2 text-2xl font-bold text-blue-700 dark:text-pink-200">
        <FaGlobe />
        LooknLink
      </div>
      <p className="text-gray-700 dark:text-gray-300 text-sm max-w-xs">
        Connect, share, and monetize your links. <br />
        Join the next-gen social marketplace.
      </p>
      <div className="flex gap-2 mt-2">
        <a href="https://github.com/dimmyjay" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-700 dark:hover:text-pink-300 p-2 rounded-full transition"><FaGithub size={22} /></a>
        <a href="https://x.com/NONRE1" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-500 dark:hover:text-pink-300 p-2 rounded-full transition"><FaTwitter size={22} /></a>
        <a href="https://www.instagram.com/dimmyjaynanre/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-pink-500 dark:hover:text-pink-300 p-2 rounded-full transition"><FaInstagram size={22} /></a>
        <a href="https://www.linkedin.com/in/dimeji-falayi-5252b178/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-800 dark:hover:text-pink-300 p-2 rounded-full transition"><FaLinkedin size={22} /></a>
        <a href="https://web.facebook.com/jonathan.deji" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-700 dark:hover:text-pink-300 p-2 rounded-full transition"><FaFacebookF size={22} /></a>
        <a href="mailto:dimejifalayi@gmail.com" className="text-gray-500 hover:text-green-600 dark:hover:text-pink-300 p-2 rounded-full transition"><FaEnvelope size={22} /></a>
      </div>
    </div>
    <nav className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-6 text-sm mt-6 md:mt-0">
      <div>
        <h4 className="font-semibold text-gray-700 dark:text-pink-200 mb-2 uppercase tracking-widest text-xs">Product</h4>
        <ul className="space-y-1">
          <li><a href="#" className="hover:underline text-blue-700 dark:text-pink-200">Features</a></li>
          <li><a href="#" className="hover:underline text-blue-700 dark:text-pink-200">Pricing</a></li>
          <li><a href="#" className="hover:underline text-blue-700 dark:text-pink-200">For Creators</a></li>
          <li><a href="#" className="hover:underline text-blue-700 dark:text-pink-200">Reels</a></li>
        </ul>
      </div>
      <div>
        <h4 className="font-semibold text-gray-700 dark:text-pink-200 mb-2 uppercase tracking-widest text-xs">Community</h4>
        <ul className="space-y-1">
          <li><a href="#" className="hover:underline text-blue-700 dark:text-pink-200">Support</a></li>
          <li><a href="#" className="hover:underline text-blue-700 dark:text-pink-200">Blog</a></li>
          <li><a href="#" className="hover:underline text-blue-700 dark:text-pink-200">Roadmap</a></li>
          <li><a href="#" className="hover:underline text-blue-700 dark:text-pink-200">Partners</a></li>
        </ul>
      </div>
      <div>
        <h4 className="font-semibold text-gray-700 dark:text-pink-200 mb-2 uppercase tracking-widest text-xs">Legal</h4>
        <ul className="space-y-1">
          <li><a href="#" className="hover:underline text-blue-700 dark:text-pink-200">Privacy Policy</a></li>
          <li><a href="#" className="hover:underline text-blue-700 dark:text-pink-200">Terms of Service</a></li>
          <li><a href="#" className="hover:underline text-blue-700 dark:text-pink-200">Security</a></li>
        </ul>
      </div>
    </nav>
  </div>
  <div className="mt-4 text-center text-xs text-gray-600 dark:text-gray-400">
    &copy; {new Date().getFullYear()} LooknLink by <a className="underline hover:text-blue-700 dark:hover:text-pink-300" href="https://github.com/dimmyjay" target="_blank" rel="noopener noreferrer">dimmyjay</a> &middot; All rights reserved.
  </div>
</footer>
    </div>
  );
}