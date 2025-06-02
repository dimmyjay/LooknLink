"use client";

import { useState, useEffect, useRef } from "react";
import { ref, push, onValue, off, update, remove, get, runTransaction, set } from "firebase/database";
import { User } from "firebase/auth";
import {
  FaHeart,
  FaEye,
  FaShareAlt,
  FaBookmark,
  FaCommentDots,
  FaShoppingCart,
  FaReply,
} from "react-icons/fa";
import { db } from "../../firebase";

type Message = {
  url: string;
  owner: string;
  ownerPhotoURL?: string;
  createdAt: string;
  stats: {
    likes: number;
    views: number;
    shares: number;
    saves: number;
    comments: number;
    purchases: number;
  };
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: { url: string } | { url: string }[];
  video?: string;
};

type Comment = {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  createdAt: string;
  likes?: number;
  replies?: { [replyId: string]: Reply };
};

type Reply = {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  createdAt: string;
};

type LinkPreview = {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: { url: string } | { url: string }[];
  ogVideo?: { url: string };
};

// --- YouTube ID Extraction Utility ---
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

export default function CommentModal({
  msgKey,
  user,
  onClose,
}: {
  msgKey: string;
  user: User | null;
  onClose: () => void;
}) {
  const [post, setPost] = useState<Message | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [replyEditId, setReplyEditId] = useState<string | null>(null);
  const [replyEditText, setReplyEditText] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  const [commentLikes, setCommentLikes] = useState<Record<string, boolean>>({});
  const [commentLikeCounts, setCommentLikeCounts] = useState<Record<string, number>>({});
  const [replyLikes, setReplyLikes] = useState<Record<string, Record<string, boolean>>>({});
  const [replyLikeCounts, setReplyLikeCounts] = useState<Record<string, Record<string, number>>>({});

  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [stats, setStats] = useState<Message["stats"]>({
    likes: 0, views: 0, shares: 0, saves: 0, comments: 0, purchases: 0,
  });

  const [loaded, setLoaded] = useState(false);

  // LINK PREVIEW STATE
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Ref for scrolling to comments section
  const commentSectionRef = useRef<HTMLDivElement>(null);

  // Social share menu state
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    let msgRef = ref(db, `messages/${msgKey}`);
    let statsRef = ref(db, `messages/${msgKey}/stats`);
    const unsubMsg = onValue(msgRef, (snap) => {
      setPost(snap.exists() ? snap.val() : null);
      setLoaded(true);
    });
    const unsubStats = onValue(statsRef, (snap) => {
      setStats({
        likes: snap.val()?.likes || 0,
        views: snap.val()?.views || 0,
        shares: snap.val()?.shares || 0,
        saves: snap.val()?.saves || 0,
        comments: snap.val()?.comments || 0,
        purchases: snap.val()?.purchases || 0,
      });
    });
    return () => {
      off(msgRef, "value", unsubMsg);
      off(statsRef, "value", unsubStats);
    };
  }, [msgKey]);

  // Fetch link preview when post.url changes
  useEffect(() => {
    if (!post?.url) {
      setPreview(null);
      setPreviewUrl(null);
      setPreviewLoading(false);
      return;
    }
    let ignore = false;
    setPreviewLoading(true);
    const fetchPreview = async (url: string) => {
      const res = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      const isDirectVideo = /\.(mp4|webm|ogg)$/i.test(url);
      const isYouTube = !!getYouTubeId(url);
      const ogVideo = data.ogVideo?.url || (isDirectVideo ? url : null);
      if (!ignore) {
        setPreview({
          ogTitle: data.ogTitle,
          ogDescription: data.ogDescription,
          ogImage: data.ogImage,
          ogVideo: ogVideo ? { url: ogVideo } : undefined,
        });
        setPreviewUrl(url);
        setPreviewLoading(false);
      }
    };
    fetchPreview(post.url);
    return () => {
      ignore = true;
    };
  }, [post?.url]);

  useEffect(() => {
    if (!user) return;
    const likerRef = ref(db, `messages/${msgKey}/likers/${user.uid}`);
    const unsubLiker = onValue(likerRef, (snap) => setLiked(!!snap.val()));
    const saverRef = ref(db, `messages/${msgKey}/savers/${user.uid}`);
    const unsubSaver = onValue(saverRef, (snap) => setSaved(!!snap.val()));
    const buyerRef = ref(db, `messages/${msgKey}/buyers/${user.uid}`);
    const unsubBuyer = onValue(buyerRef, (snap) => setPurchased(!!snap.val()));
    return () => {
      off(likerRef, "value", unsubLiker);
      off(saverRef, "value", unsubSaver);
      off(buyerRef, "value", unsubBuyer);
    };
  }, [user, msgKey]);

  useEffect(() => {
    if (!user) return;
    const viewerRef = ref(db, `messages/${msgKey}/viewers/${user.uid}`);
    const statsRef = ref(db, `messages/${msgKey}/stats/views`);
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
    return () => off(viewerRef);
  }, [user, msgKey]);

  // Show share menu on click
  const handleShare = () => {
    setShowShareMenu(true);
  };

  // Handle actual social sharing
  const handleSocialShare = async (platform: string) => {
    if (!post?.url) return;
    let shareUrl = "";
    const encodedUrl = encodeURIComponent(post.url);
    switch (platform) {
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case "twitter":
        shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}`;
        break;
      case "whatsapp":
        shareUrl = `https://wa.me/?text=${encodedUrl}`;
        break;
      default:
        return;
    }
    await update(ref(db, `messages/${msgKey}/stats`), {
      shares: stats.shares + 1,
    });
    window.open(shareUrl, "_blank", "noopener,noreferrer");
    setShowShareMenu(false);
  };

  // ESC to close share menu
  useEffect(() => {
    if (!showShareMenu) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowShareMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [showShareMenu]);

  const handleLike = async () => {
    if (!user) return;
    const likerRef = ref(db, `messages/${msgKey}/likers/${user.uid}`);
    if (liked) {
      await remove(likerRef);
      update(ref(db, `messages/${msgKey}/stats`), { likes: Math.max(stats.likes - 1, 0) });
    } else {
      await set(likerRef, true);
      update(ref(db, `messages/${msgKey}/stats`), { likes: stats.likes + 1 });
    }
  };

  // SAVE: Copy the link to clipboard and update stats
  const handleSave = async () => {
    if (!user || !post?.url) return;
    const saverRef = ref(db, `messages/${msgKey}/savers/${user.uid}`);
    if (saved) {
      await remove(saverRef);
      update(ref(db, `messages/${msgKey}/stats`), { saves: Math.max(stats.saves - 1, 0) });
    } else {
      await set(saverRef, true);
      update(ref(db, `messages/${msgKey}/stats`), { saves: stats.saves + 1 });
      try {
        await navigator.clipboard.writeText(post.url);
        // Optionally show a "Copied!" toast here
      } catch (e) {
        // Fallback if clipboard API fails
        const textArea = document.createElement("textarea");
        textArea.value = post.url;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
        } catch {}
        document.body.removeChild(textArea);
      }
    }
  };

  // PURCHASE: Go to the posted link and update stats
  const handlePurchase = async () => {
    if (!user || !post?.url) return;
    const buyerRef = ref(db, `messages/${msgKey}/buyers/${user.uid}`);
    if (purchased) {
      await remove(buyerRef);
      update(ref(db, `messages/${msgKey}/stats`), { purchases: Math.max(stats.purchases - 1, 0) });
    } else {
      await set(buyerRef, true);
      update(ref(db, `messages/${msgKey}/stats`), { purchases: stats.purchases + 1 });
      window.open(post.url, "_blank", "noopener,noreferrer");
    }
  };

  useEffect(() => {
    const commentsRef = ref(db, `messages/${msgKey}/comments`);
    const handleValue = (snapshot: any) => {
      const data = snapshot.val();
      if (!data) {
        setComments([]);
        setCommentLikes({});
        setCommentLikeCounts({});
        setReplyLikes({});
        setReplyLikeCounts({});
        return;
      }
      const likes: Record<string, number> = {};
      const likeStates: Record<string, boolean> = {};
      const rLikes: Record<string, Record<string, boolean>> = {};
      const rLikeCounts: Record<string, Record<string, number>> = {};
      Object.entries(data).forEach(([key, value]: [string, any]) => {
        likes[key] = value.likes || 0;
        likeStates[key] = value.likers && user ? !!value.likers[user.uid] : false;
        if (value.replies) {
          rLikes[key] = {};
          rLikeCounts[key] = {};
          Object.entries(value.replies).forEach(([rKey, rVal]: [string, any]) => {
            rLikeCounts[key][rKey] = rVal.likes || 0;
            rLikes[key][rKey] = rVal.likers && user ? !!rVal.likers[user.uid] : false;
          });
        }
      });
      setCommentLikeCounts(likes);
      setCommentLikes(likeStates);
      setReplyLikes(rLikes);
      setReplyLikeCounts(rLikeCounts);
      const arr: Comment[] = Object.entries(data)
        .map(([key, value]: [string, any]) => ({
          id: key,
          text: value.text,
          userId: value.userId,
          userName: value.userName,
          userPhotoURL: value.userPhotoURL,
          createdAt: value.createdAt,
          likes: value.likes || 0,
          replies: value.replies || {},
        }))
        .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
      setComments(arr);
    };
    onValue(commentsRef, handleValue);
    return () => off(commentsRef, "value", handleValue);
  }, [msgKey, user]);

  const handleCommentLike = async (commentId: string) => {
    if (!user) return;
    const likerRef = ref(db, `messages/${msgKey}/comments/${commentId}/likers/${user.uid}`);
    const likesRef = ref(db, `messages/${msgKey}/comments/${commentId}/likes`);
    if (commentLikes[commentId]) {
      await remove(likerRef);
      runTransaction(likesRef, (curr) => Math.max((curr || 1) - 1, 0));
    } else {
      await set(likerRef, true);
      runTransaction(likesRef, (curr) => (curr || 0) + 1);
    }
  };

  const handleReplyLike = async (commentId: string, replyId: string) => {
    if (!user) return;
    const likerRef = ref(db, `messages/${msgKey}/comments/${commentId}/replies/${replyId}/likers/${user.uid}`);
    const likesRef = ref(db, `messages/${msgKey}/comments/${commentId}/replies/${replyId}/likes`);
    if (replyLikes[commentId]?.[replyId]) {
      await remove(likerRef);
      runTransaction(likesRef, (curr) => Math.max((curr || 1) - 1, 0));
    } else {
      await set(likerRef, true);
      runTransaction(likesRef, (curr) => (curr || 0) + 1);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    if (!replyInput.trim() || !user) return;
    const replyRef = ref(db, `messages/${msgKey}/comments/${commentId}/replies`);
    await push(replyRef, {
      text: replyInput.trim(),
      userId: user.uid,
      userName: user.displayName || user.email || "Anonymous",
      userPhotoURL: user.photoURL || "",
      createdAt: new Date().toISOString(),
    });
    setReplyInput("");
    setReplyTo(null);
  };

  const handleReplyEditSubmit = async (e: React.FormEvent, commentId: string, replyId: string) => {
    e.preventDefault();
    if (!replyEditId || !replyEditText.trim() || !user) return;
    const replyRef = ref(db, `messages/${msgKey}/comments/${commentId}/replies/${replyId}`);
    await update(replyRef, { text: replyEditText.trim() });
    setReplyEditId(null);
    setReplyEditText("");
  };

  const handleReplyDelete = async (commentId: string, replyId: string) => {
    if (!user) return;
    const replyRef = ref(db, `messages/${msgKey}/comments/${commentId}/replies/${replyId}`);
    await remove(replyRef);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    const commentsRef = ref(db, `messages/${msgKey}/comments`);
    await push(commentsRef, {
      text: input.trim(),
      userId: user.uid,
      userName: user.displayName || user.email || "Anonymous",
      userPhotoURL: user.photoURL || "",
      createdAt: new Date().toISOString(),
    });
    // Increment comment count in stats
    const statsRef = ref(db, `messages/${msgKey}/stats/comments`);
    await get(statsRef).then((snap) => {
      const prev = snap.val() || 0;
      update(ref(db, `messages/${msgKey}/stats`), { comments: prev + 1 });
    });
    setInput("");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !editText.trim() || !user) return;
    const commentRef = ref(db, `messages/${msgKey}/comments/${editId}`);
    await update(commentRef, { text: editText.trim() });
    setEditId(null);
    setEditText("");
  };

  const handleEditCancel = () => {
    setEditId(null);
    setEditText("");
  };

  const handleDelete = async (comment: Comment) => {
    if (!user || user.uid !== comment.userId) return;
    if (!window.confirm("Delete this comment?")) return;
    const commentRef = ref(db, `messages/${msgKey}/comments/${comment.id}`);
    await remove(commentRef);
    // Decrement comment count in stats
    const statsRef = ref(db, `messages/${msgKey}/stats/comments`);
    await get(statsRef).then((snap) => {
      const prev = snap.val() || 1;
      update(ref(db, `messages/${msgKey}/stats`), { comments: Math.max(prev - 1, 0) });
    });
  };

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

  // Allow closing the modal on overlay click (outside modal)
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  // Scroll to comments section
  const scrollToComments = () => {
    commentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    // Allow closing on Escape key
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function getPreviewImage(preview: LinkPreview | null) {
    if (!preview) return undefined;
    if (Array.isArray(preview.ogImage)) return preview.ogImage[0]?.url;
    if (typeof preview.ogImage === "object" && preview.ogImage?.url) return preview.ogImage.url;
    return undefined;
  }

  // --- Show YouTube embed if applicable ---
  function renderMedia(preview: LinkPreview | null, url: string) {
    const youtubeId = getYouTubeId(url);
    if (youtubeId) {
      return (
        <iframe
          width="100%"
          height="260"
          src={`https://www.youtube.com/embed/${youtubeId}`}
          title="YouTube video"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full rounded-lg my-4 max-h-[260px] bg-black"
        />
      );
    } else if (preview?.ogVideo?.url) {
      return (
        <video
          src={preview.ogVideo.url}
          controls
          poster={getPreviewImage(preview)}
          className="w-full rounded-lg my-4 max-h-[260px] bg-black"
          preload="metadata"
        />
      );
    } else if (!previewLoading && getPreviewImage(preview)) {
      return (
        <img
          src={getPreviewImage(preview)}
          alt={preview?.ogTitle || "Preview"}
          className="w-full rounded-lg my-4 max-h-[260px] object-cover"
        />
      );
    }
    return null;
  }

  const commentsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [comments]);

  if (!loaded) {
    return (
      <div
        ref={overlayRef}
        className="fixed inset-0 w-screen h-screen z-[2147483647] flex items-center justify-center backdrop-blur-md"
        style={{
          background: "rgba(0,0,0,0.40)",
          zIndex: 2147483647,
        }}
      >
        <div
          className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-4xl min-w-[600px] min-h-[540px] max-h-[96vh] p-8 flex items-center justify-center"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 2147483648,
            overflowY: "auto",
          }}
        >
          <div className="text-lg text-gray-400 dark:text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 w-screen h-screen z-[2147483647] flex items-center justify-center backdrop-blur-md"
      style={{
        background: "rgba(0,0,0,0.40)",
        zIndex: 2147483647,
      }}
      tabIndex={-1}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-4xl min-w-[600px] min-h-[540px] max-h-[96vh] p-8 relative flex flex-col select-auto"
        tabIndex={0}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "auto",
          zIndex: 2147483648,
          maxHeight: "96vh",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          className="absolute top-6 right-8 text-3xl text-gray-500 hover:text-red-500"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        <div
          className="flex flex-col flex-1 min-h-0"
          style={{
            height: "100%",
            overflow: "hidden",
          }}
        >
          {post && (
            <div className="mb-5 p-4 rounded-xl shadow bg-white dark:bg-neutral-800 flex-shrink-0 relative">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={post.ownerPhotoURL || `https://api.dicebear.com/7.x/thumbs/svg?seed=${post.owner}`}
                  alt={post.owner}
                  className="w-12 h-12 rounded-full"
                />
                <span className="font-bold text-lg text-gray-900 dark:text-white">{post.owner}</span>
                <span className="text-xs text-gray-500 ml-2">{formatTimeAgo(post.createdAt)}</span>
              </div>
              {post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-neutral-900 p-3 mb-3 hover:shadow-lg transition"
                  style={{ textDecoration: "none" }}
                >
                  <div className="flex gap-3">
                    {previewLoading ? (
                      <div className="w-28 h-28 rounded-lg bg-gray-200 dark:bg-neutral-700 flex items-center justify-center text-gray-400">Loading...</div>
                    ) : getPreviewImage(preview) ? (
                      <img
                        src={getPreviewImage(preview)}
                        alt={preview?.ogTitle || "Preview"}
                        className="w-28 h-28 object-cover rounded-lg flex-shrink-0"
                        style={{ background: "#f0f0f0" }}
                      />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      {preview?.ogTitle && (
                        <div className="font-bold text-lg text-blue-700 dark:text-blue-300 truncate mb-1">{preview.ogTitle}</div>
                      )}
                      {preview?.ogDescription && (
                        <div className="text-gray-700 dark:text-gray-300 text-base truncate-2-lines mb-1" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {preview.ogDescription}
                        </div>
                      )}
                      <div className="text-blue-600 dark:text-blue-400 text-xs break-all">{post.url}</div>
                    </div>
                  </div>
                </a>
              )}
              {renderMedia(preview, post.url)}
              <div className="flex flex-wrap gap-5 mt-4 text-base relative">
                <button
                  type="button"
                  className={`flex items-center gap-1 px-3 py-1 rounded font-semibold transition hover:scale-110 ${liked ? "text-red-600" : "text-gray-700 dark:text-gray-100"}`}
                  onClick={handleLike}
                  disabled={!user}
                >
                  <FaHeart /> <span>{stats.likes}</span> <span>Likes</span>
                </button>
                <div className="flex items-center gap-1 px-3 py-1 rounded font-semibold text-blue-700 dark:text-blue-400">
                  <FaEye /> <span>{stats.views}</span> <span>Views</span>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1 rounded font-semibold text-green-700 dark:text-green-400 transition hover:scale-110"
                  onClick={handleShare}
                >
                  <FaShareAlt /> <span>{stats.shares}</span> <span>Shares</span>
                </button>
                {/* Share menu */}
                {showShareMenu && (
                  <div
                    className="absolute z-50 mt-2 right-0 bg-white dark:bg-neutral-800 border rounded-lg shadow-lg p-4 flex flex-col gap-3"
                    style={{ top: "50px", right: "0" }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      className="flex items-center gap-2 text-blue-600 hover:underline"
                      onClick={() => handleSocialShare("facebook")}
                    >
                      Facebook
                    </button>
                    <button
                      className="flex items-center gap-2 text-blue-400 hover:underline"
                      onClick={() => handleSocialShare("twitter")}
                    >
                      Twitter
                    </button>
                    <button
                      className="flex items-center gap-2 text-green-600 hover:underline"
                      onClick={() => handleSocialShare("whatsapp")}
                    >
                      WhatsApp
                    </button>
                    <button
                      className="flex items-center gap-2 text-gray-500 hover:underline"
                      onClick={() => setShowShareMenu(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className={`flex items-center gap-1 px-3 py-1 rounded font-semibold transition hover:scale-110 ${saved ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-100"}`}
                  onClick={handleSave}
                  disabled={!user}
                >
                  <FaBookmark /> <span>{stats.saves}</span> <span>Saves</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1 rounded font-semibold text-pink-600 dark:text-pink-400"
                  onClick={scrollToComments}
                >
                  <FaCommentDots /> <span>{stats.comments}</span> <span>Comments</span>
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-1 px-3 py-1 rounded font-semibold transition hover:scale-110 ${purchased ? "text-green-600 dark:text-green-400" : "text-gray-700 dark:text-gray-100"}`}
                  onClick={handlePurchase}
                  disabled={!user}
                >
                  <FaShoppingCart /> <span>{stats.purchases}</span> <span>Buys</span>
                </button>
              </div>
            </div>
          )}
          <div ref={commentSectionRef}></div>
          <form onSubmit={editId ? handleEditSubmit : handleSubmit} className="flex gap-3 mb-4 flex-shrink-0">
            <input
              type="text"
              value={editId ? editText : input}
              onChange={e => editId ? setEditText(e.target.value) : setInput(e.target.value)}
              placeholder={user ? (editId ? "Edit your comment..." : "Write a comment...") : "Login to comment"}
              className="flex-1 px-4 py-2 border rounded-lg text-base bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              style={{ minWidth: 0 }}
              disabled={!user}
              autoFocus
            />
            {editId ? (
              <>
                <button
                  type="submit"
                  disabled={!user || !editText.trim()}
                  className="bg-green-600 text-white px-5 py-2 rounded-lg disabled:opacity-60 text-base"
                >Save</button>
                <button
                  type="button"
                  className="bg-gray-400 text-white px-5 py-2 rounded-lg text-base"
                  onClick={handleEditCancel}
                >Cancel</button>
              </>
            ) : (
              <button
                type="submit"
                disabled={!user || !input.trim()}
                className="bg-blue-600 text-white px-7 py-2 rounded-lg disabled:opacity-60 text-base"
              >
                Comment
              </button>
            )}
          </form>
          <div
            className="space-y-4 pr-2 flex-1 min-h-0"
            style={{
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              maxHeight: "100%",
            }}
          >
            {comments.length === 0 && (
              <div className="text-base text-gray-400">No comments yet.</div>
            )}
            {comments.map((c) => (
              <div key={c.id} className="flex flex-col bg-gray-100 dark:bg-neutral-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <img
                    src={
                      c.userPhotoURL ||
                      `https://api.dicebear.com/7.x/thumbs/svg?seed=${c.userName}`
                    }
                    alt={c.userName}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-base text-gray-900 dark:text-white">{c.userName}</div>
                    <div className="text-base text-gray-800 dark:text-gray-200">{c.text}</div>
                    <div className="flex gap-4 items-center mt-2">
                      <button
                        className={`flex items-center gap-1 text-sm transition hover:scale-110 ${commentLikes[c.id] ? "text-red-600" : "text-gray-700 dark:text-gray-100"}`}
                        onClick={() => handleCommentLike(c.id)}
                        disabled={!user}
                        type="button"
                      >
                        <FaHeart /> <span>{commentLikeCounts[c.id] || 0}</span>
                      </button>
                      <button
                        className="flex gap-1 items-center text-blue-600 dark:text-blue-400 text-sm hover:underline transition"
                        type="button"
                        onClick={() => {
                          setReplyTo(replyTo === c.id ? null : c.id);
                          setReplyInput("");
                          setReplyEditId(null);
                          setReplyEditText("");
                        }}
                      >
                        <FaReply /> Reply
                      </button>
                      <div className="text-[13px] text-gray-400">
                        {formatTimeAgo(c.createdAt)}
                      </div>
                      {user && user.uid === c.userId && (
                        <>
                          <button
                            className="text-blue-700 dark:text-blue-400 text-sm underline"
                            onClick={() => {
                              setEditId(c.id);
                              setEditText(c.text);
                            }}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="text-red-600 dark:text-red-400 text-sm underline"
                            onClick={() => handleDelete(c)}
                            type="button"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {replyTo === c.id && (
                  <form
                    onSubmit={e => handleReplySubmit(e, c.id)}
                    className="flex gap-2 mt-3 ml-12"
                  >
                    <input
                      type="text"
                      value={replyInput}
                      onChange={e => setReplyInput(e.target.value)}
                      placeholder="Write a reply..."
                      className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      disabled={!user}
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!user || !replyInput.trim()}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-60"
                    >
                      Reply
                    </button>
                  </form>
                )}
                <div className="ml-12 mt-2 space-y-2">
                  {c.replies &&
                    Object.entries(c.replies)
                      .sort(([_a, r1], [_b, r2]) => (r1.createdAt > r2.createdAt ? 1 : -1))
                      .map(([replyId, r]) => (
                        <div key={replyId} className="flex gap-2 items-start bg-gray-50 dark:bg-neutral-700 rounded px-3 py-2">
                          <img
                            src={
                              r.userPhotoURL ||
                              `https://api.dicebear.com/7.x/thumbs/svg?seed=${r.userName}`
                            }
                            alt={r.userName}
                            className="w-8 h-8 rounded-full"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-sm text-gray-900 dark:text-white">{r.userName}</div>
                            {replyEditId === replyId ? (
                              <form
                                onSubmit={e => handleReplyEditSubmit(e, c.id, replyId)}
                                className="flex gap-2"
                              >
                                <input
                                  type="text"
                                  value={replyEditText}
                                  onChange={e => setReplyEditText(e.target.value)}
                                  className="flex-1 px-2 py-1 border rounded-lg text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                                  autoFocus
                                />
                                <button
                                  type="submit"
                                  disabled={!user || !replyEditText.trim()}
                                  className="bg-green-600 text-white px-3 py-1 rounded-lg disabled:opacity-60 text-sm"
                                >Save</button>
                                <button
                                  type="button"
                                  className="bg-gray-400 text-white px-3 py-1 rounded-lg text-sm"
                                  onClick={() => {
                                    setReplyEditId(null);
                                    setReplyEditText("");
                                  }}
                                >Cancel</button>
                              </form>
                            ) : (
                              <div className="text-xs text-gray-700 dark:text-gray-200">{r.text}</div>
                            )}
                            <div className="flex gap-3 items-center mt-1">
                              <button
                                className={`flex items-center gap-1 text-xs transition hover:scale-110 ${replyLikes[c.id]?.[replyId] ? "text-red-600" : "text-gray-700 dark:text-gray-100"}`}
                                onClick={() => handleReplyLike(c.id, replyId)}
                                disabled={!user}
                                type="button"
                              >
                                <FaHeart /> <span>{replyLikeCounts[c.id]?.[replyId] || 0}</span>
                              </button>
                              <div className="text-[11px] text-gray-400">
                                {formatTimeAgo(r.createdAt)}
                              </div>
                              {user && user.uid === r.userId && (
                                <>
                                  <button
                                    className="text-blue-700 dark:text-blue-400 text-xs underline"
                                    onClick={() => {
                                      setReplyEditId(replyId);
                                      setReplyEditText(r.text);
                                    }}
                                    type="button"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="text-red-600 dark:text-red-400 text-xs underline"
                                    onClick={() => handleReplyDelete(c.id, replyId)}
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            ))}
            <div ref={commentsEndRef}></div>
          </div>
        </div>
      </div>
    </div>
  );
}