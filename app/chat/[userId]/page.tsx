"use client";
import React, { useEffect, useState, useRef } from "react";
import { FaComments, FaArrowLeft, FaHome, FaPaperPlane, FaReply } from "react-icons/fa";
import { useParams, useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getDatabase, ref as dbRef, onValue, get, push, off, update } from "firebase/database";
import { app as firebaseApp } from "../../../firebase";

// ---- Types ----
type UserProfile = {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
};
type Message = {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  readBy?: Record<string, boolean>;
};
type ChatPreview = {
  chatId: string;
  partner: UserProfile;
  lastMessage: Message;
  unreadCount: number;
};

function avatarUrl(profile: UserProfile | null | undefined) {
  if (!profile) return "/default-avatar.png";
  if (profile.photoURL) return profile.photoURL;
  const seed = encodeURIComponent(profile.displayName || profile.email || profile.uid);
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}`;
}

function isToday(ts: number) {
  const now = new Date();
  const d = new Date(ts);
  return (
    now.getFullYear() === d.getFullYear() &&
    now.getMonth() === d.getMonth() &&
    now.getDate() === d.getDate()
  );
}
function isYesterday(ts: number) {
  const now = new Date();
  const d = new Date(ts);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  );
}

// --- Custom Bubble/Inbox Design ---
export default function InboxPage() {
  const params = useParams();
  const router = useRouter();
  const urlUserId =
    typeof params.userId === "string"
      ? params.userId
      : Array.isArray(params.userId)
      ? params.userId[0]
      : "";

  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatPreview | null>(null);

  // For chatroom view
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth check
  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) setLoading(false);
      else if (user.uid !== urlUserId) window.location.replace(`/chat/${user.uid}`);
    });
    return () => unsubscribe();
  }, [urlUserId]);

  // Fetch chats and user profiles
  useEffect(() => {
    if (!firebaseUser || firebaseUser.uid !== urlUserId) return;
    const db = getDatabase(firebaseApp);
    const inboxRef = dbRef(db, "inbox");

    const unsubscribe = onValue(inboxRef, async (snapshot) => {
      if (!snapshot.exists()) {
        setChats([]);
        setLoading(false);
        return;
      }
      const inboxData = snapshot.val();
      const chatPreviews: ChatPreview[] = [];

      await Promise.all(
        Object.entries(inboxData).map(async ([chatId, messagesObj]: [string, any]) => {
          const uids = chatId.split("_");
          if (!uids.includes(firebaseUser.uid)) return;

          const partnerUid = uids.find((uid) => uid !== firebaseUser.uid);
          if (!partnerUid) return;

          const messages: Message[] = Object.entries(messagesObj).map(
            ([id, msg]: [string, any]) => ({
              id,
              sender: msg.sender,
              text: msg.text,
              timestamp: msg.timestamp,
              readBy: msg.readBy || {},
            })
          );
          if (messages.length === 0) return;
          const lastMessage = messages.sort((a, b) => b.timestamp - a.timestamp)[0];

          // Calculate unread count for this chat
          const unreadCount = messages.filter(
            (msg) =>
              msg.sender !== firebaseUser.uid &&
              (!msg.readBy || !msg.readBy[firebaseUser.uid])
          ).length;

          // Fetch partner user profile
          const userRef = dbRef(db, `users/${partnerUid}`);
          let partner: UserProfile = {
            uid: partnerUid,
            displayName: "Unknown User",
            photoURL: null,
            email: null,
          };
          try {
            const snap = await get(userRef);
            if (snap.exists()) {
              const data = snap.val();
              partner = {
                uid: partnerUid,
                displayName: data.displayName || data.email || "Unknown User",
                photoURL: data.photoURL || null,
                email: data.email || null,
              };
            }
          } catch (e) {}

          chatPreviews.push({ chatId, partner, lastMessage, unreadCount });
        })
      );

      chatPreviews.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
      setChats(chatPreviews);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseUser, urlUserId]);

  // Mark messages as read when opening a chat
  useEffect(() => {
    if (!selectedChat || !firebaseUser) return;
    const db = getDatabase(firebaseApp);
    const messagesRef = dbRef(db, `inbox/${selectedChat.chatId}`);

    const markAsRead = async () => {
      const snap = await get(messagesRef);
      if (!snap.exists()) return;
      const updates: any = {};
      const msgs = snap.val();
      Object.entries(msgs).forEach(([id, msg]: [string, any]) => {
        if (
          msg.sender !== firebaseUser.uid &&
          (!msg.readBy || !msg.readBy[firebaseUser.uid])
        ) {
          updates[`${id}/readBy/${firebaseUser.uid}`] = true;
        }
      });
      if (Object.keys(updates).length > 0) {
        await update(messagesRef, updates);
      }
    };

    markAsRead();
  }, [selectedChat, firebaseUser]);

  // Fetch messages for selected chat
  useEffect(() => {
    if (!selectedChat || !firebaseUser) return;
    setMessages([]); // clear previous messages
    const db = getDatabase(firebaseApp);
    const messagesRef = dbRef(db, `inbox/${selectedChat.chatId}`);
    const handleValue = (snapshot: any) => {
      const data = snapshot.val() || {};
      const arr: Message[] = Object.entries(data).map(([id, msg]: [string, any]) => ({
        id,
        sender: msg.sender,
        text: msg.text,
        timestamp: msg.timestamp,
        readBy: msg.readBy || {},
      }));
      arr.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(arr);

      // Fetch all sender profiles in this chat
      const uids = Array.from(new Set(arr.map(m => m.sender)));
      const promises = uids.map(uid => {
        if (userProfiles[uid]) return Promise.resolve();
        const db = getDatabase(firebaseApp);
        const userRef = dbRef(db, `users/${uid}`);
        return get(userRef).then(snap => {
          if (snap.exists()) {
            setUserProfiles(prev => ({
              ...prev,
              [uid]: {
                uid,
                displayName: snap.val().displayName || snap.val().email || "User",
                photoURL: snap.val().photoURL || null,
                email: snap.val().email || null,
              },
            }));
          }
        });
      });
      Promise.all(promises);
    };
    onValue(messagesRef, handleValue);
    return () => off(messagesRef, "value", handleValue);
    // eslint-disable-next-line
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message in chatroom
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !firebaseUser || !selectedChat) return;
    const db = getDatabase(firebaseApp);
    const messagesRef = dbRef(db, `inbox/${selectedChat.chatId}`);
    await push(messagesRef, {
      sender: firebaseUser.uid,
      text: replyTo ? `@${userProfiles[replyTo.sender]?.displayName || "User"}: ${input.trim()}` : input.trim(),
      timestamp: Date.now(),
    });
    setInput("");
    setReplyTo(null);
  };

  // Home button handler
  const handleGoHome = () => {
    router.push("/");
  };

  // Group messages by date for separators
  function getMessageDateSeparator(ts: number) {
    if (isToday(ts)) return "Today";
    if (isYesterday(ts)) return "Yesterday";
    return new Date(ts).toLocaleDateString();
  }

  // Inbox Sidebar for Chatroom
  function Sidebar() {
    return (
      <aside className="hidden md:block w-80 h-[70vh] rounded-3xl p-4 bg-white/50 shadow-xl backdrop-blur border-r border-blue-200 overflow-y-auto">
        <h2 className="text-xl font-extrabold flex items-center gap-2 text-blue-800 mb-6">
          <FaComments /> Chats
        </h2>
        {chats.length === 0 ? (
          <div className="text-center text-gray-400 pt-16">No chats yet.</div>
        ) : (
          <ul className="space-y-3">
            {chats.map((chat) => (
              <li
                key={chat.chatId}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2 cursor-pointer transition ${
                  selectedChat?.chatId === chat.chatId
                    ? "bg-blue-100/80 border-blue-300 border"
                    : "hover:bg-blue-50"
                }`}
                onClick={() => setSelectedChat(chat)}
                title={`Chat with ${chat.partner.displayName || chat.partner.email || "User"}`}
              >
                <img
                  src={avatarUrl(chat.partner)}
                  alt={chat.partner.displayName || chat.partner.email || "User"}
                  className="w-10 h-10 rounded-full border-2 border-blue-200 shadow"
                />
                <div className="flex-1">
                  <div className="font-semibold text-blue-900 text-base truncate">{chat.partner.displayName || chat.partner.email || "User"}</div>
                  <div className="text-gray-500 text-xs truncate max-w-[120px]">
                    {chat.lastMessage.text}
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 ml-2">
                  {chat.lastMessage.timestamp
                    ? new Date(chat.lastMessage.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : ""}
                </div>
                {chat.unreadCount > 0 && (
                  <span className="ml-2 bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full shadow animate-pulse">
                    {chat.unreadCount}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    );
  }

  // --- Message Bubble Animation & Design ---
  function MessageBubble({ msg, isSender, senderProfile }: { msg: Message; isSender: boolean; senderProfile: UserProfile }) {
    const displayName = senderProfile?.displayName || senderProfile?.email || (isSender ? "You" : "User");
    // Sender is right, receiver is left (standard)
    return (
      <div
        className={`flex items-end gap-2 mb-1 group animate-fade-in ${
          isSender ? "justify-end flex-row-reverse" : "justify-start"
        }`}
      >
        <img
          src={avatarUrl(senderProfile)}
          alt={displayName}
          className={`w-8 h-8 rounded-full object-cover border shadow ${isSender ? "ml-2" : "mr-2"}`}
        />
        <div
          className={`relative px-5 py-3 rounded-[2rem] max-w-[75%] shadow-md border border-transparent transition-all cursor-pointer ${
            isSender
              ? "bg-gradient-to-br from-blue-400 to-pink-400 text-white"
              : "bg-white/70 text-blue-900 hover:border-blue-200"
          }`}
          title="Click to reply"
          onClick={() => {
            if (!isSender) setReplyTo(msg);
          }}
        >
          <div className="text-[10px] font-bold opacity-60 mb-1">
            {isSender ? "You" : displayName}
          </div>
          <span className="block break-words">{msg.text}</span>
          <div className="block text-[9px] text-right mt-1 opacity-55">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
          {!isSender && (
            <span className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-xs text-blue-500 flex items-center gap-1">
              <FaReply className="inline" /> Reply
            </span>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full py-10 bg-gradient-to-br from-blue-100 via-pink-100 to-purple-100 min-h-screen">
        <span>Loading inbox...</span>
      </div>
    );
  }
  if (!firebaseUser) {
    return (
      <div className="flex justify-center items-center h-full py-10 bg-gradient-to-br from-blue-100 via-pink-100 to-purple-100 min-h-screen">
        <span>You must be logged in to view your inbox.</span>
      </div>
    );
  }

  // If a chat is selected, render chatroom
  if (selectedChat) {
    const partner = selectedChat.partner;
    // Prepare messages with date separators
    let lastDateLabel: string | null = null;
    const messageBlocks: React.ReactNode[] = [];
    messages.forEach((msg, idx) => {
      const dateLabel = getMessageDateSeparator(msg.timestamp);
      if (dateLabel !== lastDateLabel) {
        messageBlocks.push(
          <div key={"date-" + msg.id} className="text-center text-xs font-extrabold text-blue-400 my-6 tracking-wide">
            <span className="px-4 py-1 bg-white/70 rounded-xl shadow border border-blue-100">{dateLabel}</span>
          </div>
        );
        lastDateLabel = dateLabel;
      }
      const senderProfile: UserProfile = userProfiles[msg.sender] || {
        uid: msg.sender,
        displayName: "User",
        photoURL: null,
        email: null,
      };
      const isSender = msg.sender === firebaseUser.uid;
      messageBlocks.push(
        <MessageBubble key={msg.id} msg={msg} isSender={isSender} senderProfile={senderProfile} />
      );
    });

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-pink-100 to-purple-100 py-10 px-2">
        <div className="max-w-5xl mx-auto flex gap-6">
          {/* Sidebar */}
          <Sidebar />
          {/* Chat room */}
          <div className="flex-1">
            <div className="flex gap-2 mb-4">
              <button
                className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-700 transition font-medium"
                onClick={() => setSelectedChat(null)}
              >
                <FaArrowLeft /> Back
              </button>
              <button
                className="inline-flex items-center gap-2 text-pink-500 hover:text-pink-700 transition ml-auto font-medium"
                onClick={handleGoHome}
              >
                <FaHome /> Home
              </button>
            </div>
            <div className="flex items-center gap-4 mb-6 p-4 rounded-[2rem] bg-white/60 backdrop-blur shadow-lg border border-blue-100">
              <img
                src={avatarUrl(partner)}
                alt={partner.displayName || partner.email || "User"}
                className="w-14 h-14 rounded-full object-cover border-2 border-pink-200 shadow"
              />
              <div>
                <div className="font-bold text-lg text-blue-900">{partner.displayName || partner.email || "User"}</div>
                <div className="text-xs text-blue-400">{partner.email}</div>
              </div>
            </div>
            <div className="flex flex-col gap-3 mb-6 overflow-y-auto max-h-[55vh] p-4 rounded-2xl shadow-inner bg-gradient-to-tr from-white/70 to-pink-50 ring-1 ring-blue-100 animate-fade-in">
              {messageBlocks}
              <div ref={messagesEndRef} />
            </div>
            {replyTo && (
              <div className="mb-2 flex items-center gap-2 bg-blue-100/80 border border-blue-200 py-1 px-4 rounded-2xl shadow">
                <span className="text-xs text-blue-700">
                  Replying to <b>{userProfiles[replyTo.sender]?.displayName || userProfiles[replyTo.sender]?.email || "User"}</b>: “{replyTo.text.slice(0, 40)}”
                </span>
                <button
                  className="ml-2 text-xs text-pink-600 hover:underline"
                  onClick={() => setReplyTo(null)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            )}
            <form onSubmit={handleSend} className="flex gap-2 items-center animate-fade-in">
              <input
                type="text"
                className="flex-1 rounded-2xl border border-blue-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white/80 shadow"
                placeholder={replyTo ? `Replying to ${userProfiles[replyTo.sender]?.displayName || userProfiles[replyTo.sender]?.email || "User"}...` : "Type your message…"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!firebaseUser}
              />
              <button
                type="submit"
                className="bg-gradient-to-br from-blue-500 to-pink-500 text-white font-bold px-6 py-2 rounded-2xl shadow hover:scale-105 hover:shadow-lg transition disabled:opacity-50 flex items-center gap-2"
                disabled={!input.trim()}
              >
                <FaPaperPlane /> Send
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Default: Inbox list
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-pink-100 to-purple-100 py-10 px-2">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl font-extrabold flex items-center gap-3 text-blue-800 drop-shadow">
            <FaComments size={38} className="animate-bounce" /> Inbox
          </h1>
          <button
            className="inline-flex items-center gap-2 text-pink-500 hover:text-pink-700 transition text-lg font-medium"
            onClick={handleGoHome}
          >
            <FaHome /> Home
          </button>
        </div>
        {chats.length === 0 ? (
          <div className="text-center text-gray-500 py-24 text-lg">No messages yet.</div>
        ) : (
          <ul className="space-y-5">
            {chats.map((chat) => (
              <li
                key={chat.chatId}
                className="bg-white/60 backdrop-blur-md dark:bg-[#232136bb] p-5 rounded-3xl shadow-lg flex items-center gap-5 hover:bg-blue-50/80 dark:hover:bg-[#393053] transition cursor-pointer border border-blue-100 hover:scale-[1.015] transform"
                onClick={() => setSelectedChat(chat)}
              >
                <div className="relative">
                  <img
                    src={avatarUrl(chat.partner)}
                    alt={chat.partner.displayName || chat.partner.email || "User"}
                    className="w-16 h-16 rounded-full object-cover border-2 border-pink-200 shadow-lg"
                  />
                  {/* Unread badge */}
                  {chat.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full shadow animate-pulse">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
                <div className="ml-2 flex-1">
                  <div className="font-semibold text-blue-900 dark:text-white text-xl">{chat.partner.displayName || chat.partner.email || "User"}</div>
                  <div className="text-gray-600 dark:text-gray-300 text-base max-w-xs truncate">
                    {chat.lastMessage.text}
                  </div>
                  <div className="text-xs text-blue-400 mt-1">
                    Click to see conversation and reply
                  </div>
                </div>
                <div className="ml-auto text-xs text-blue-500 font-bold">
                  {chat.lastMessage.timestamp
                    ? new Date(chat.lastMessage.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })
                    : ""}
                  <div className="text-gray-400 text-[10px]">
                    {chat.lastMessage.timestamp
                      ? new Date(chat.lastMessage.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Animations */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(15px);} to { opacity: 1; transform: none; }}
        .animate-fade-in { animation: fade-in 0.4s ease-in; }
      `}</style>
    </div>
  );
}