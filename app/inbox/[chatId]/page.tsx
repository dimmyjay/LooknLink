"use client";
import { useEffect, useState, useRef } from "react";
import { getDatabase, ref, onValue, push, off, get } from "firebase/database";
import { app as firebaseApp, auth } from "../../../firebase";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

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
};

// ---- Component ----
export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      if (user) {
        setCurrentUser({
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          email: user.email,
        });
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch messages
  useEffect(() => {
    if (!chatId) return;
    const db = getDatabase(firebaseApp);
    const messagesRef = ref(db, `inbox/${chatId}`);
    const handleValue = (snapshot: any) => {
      const data = snapshot.val() || {};
      const arr: Message[] = Object.entries(data).map(([id, msg]: [string, any]) => ({
        id,
        sender: msg.sender,
        text: msg.text,
        timestamp: msg.timestamp,
      }));
      arr.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(arr);

      // Fetch all sender profiles in this chat
      const uids = Array.from(new Set(arr.map(m => m.sender)));
      const promises = uids.map(uid => {
        if (userProfiles[uid]) return Promise.resolve(); // Already loaded
        const db = getDatabase(firebaseApp);
        const userRef = ref(db, `users/${uid}`);
        return get(userRef).then(snap => {
          if (snap.exists()) {
            setUserProfiles(prev => ({ ...prev, [uid]: snap.val() }));
          }
        });
      });
      Promise.all(promises);
    };
    onValue(messagesRef, handleValue);
    return () => off(messagesRef, "value", handleValue);
    // eslint-disable-next-line
  }, [chatId]);

  // Always scroll to bottom on messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Get the profile of the other user
  useEffect(() => {
    if (!chatId || !currentUser) return;
    const uids = chatId.split("_");
    const otherUid = uids.find((uid) => uid !== currentUser.uid);
    if (!otherUid) return;
    const db = getDatabase(firebaseApp);
    const userRef = ref(db, `users/${otherUid}`);
    get(userRef).then((snapshot) => {
      if (snapshot.exists()) setOtherUser(snapshot.val());
    });
  }, [chatId, currentUser]);

  // Send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentUser) return;
    const db = getDatabase(firebaseApp);
    const messagesRef = ref(db, `inbox/${chatId}`);
    await push(messagesRef, {
      sender: currentUser.uid,
      text: input.trim(),
      timestamp: Date.now(),
    });
    setInput("");
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <p className="text-lg text-gray-600">Login to chat!</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex justify-center items-start bg-gradient-to-br from-[#e0c3fc] via-[#8ec5fc] to-[#f093fb] dark:from-[#191627] dark:via-[#393053] dark:to-[#232144] transition-colors duration-700 py-12 overflow-hidden">
      {/* --- Cartoon Characters & Chat Bubbles background --- */}
      <img
        src="https://raw.githubusercontent.com/opensourcedesign/open-doodles/master/src/sitting.svg"
        alt="Cartoon Person Left"
        className="pointer-events-none select-none absolute left-[-40px] bottom-10 w-44 opacity-90"
        style={{ zIndex: 1 }}
      />
      {/* Speech bubble for left */}
      <div className="pointer-events-none select-none absolute left-24 bottom-40 bg-white/90 rounded-2xl shadow-lg px-6 py-3 text-lg font-semibold text-blue-700" style={{ zIndex: 2 }}>
        <span>Hello!</span>
        <span className="ml-1 animate-bounce inline-block">💬</span>
      </div>
      {/* Chat dots */}
      <div className="pointer-events-none select-none absolute left-40 bottom-28 flex gap-1 z-2">
        <span className="block w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
        <span className="block w-2 h-2 bg-pink-400 rounded-full animate-pulse delay-150" />
        <span className="block w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-300" />
      </div>
      {/* Right character */}
      <img
        src="https://raw.githubusercontent.com/opensourcedesign/open-doodles/master/src/sitting.svg"
        alt="Cartoon Person Right"
        className="pointer-events-none select-none absolute right-[-50px] top-[30vh] w-48 opacity-90"
        style={{ zIndex: 1 }}
      />
      {/* Speech bubble for right */}
      <div className="pointer-events-none select-none absolute right-24 top-[32vh] bg-white/90 rounded-2xl shadow-lg px-6 py-3 text-lg font-semibold text-pink-700" style={{ zIndex: 2 }}>
        <span>Hi there!</span>
        <span className="ml-1 animate-bounce inline-block">👋</span>
      </div>
      {/* --- Your Actual Chat Window --- */}
      <div className="relative z-10 max-w-2xl w-full mx-auto bg-white/80 dark:bg-[#232144]/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-[#393053] flex flex-col h-[80vh]">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-[#393053]">
          {otherUser && (
            <>
              <img
                src={
                  otherUser.photoURL ||
                  `https://api.dicebear.com/7.x/thumbs/svg?seed=${otherUser.displayName || otherUser.email}`
                }
                alt={otherUser.displayName || "Friend"}
                className="w-10 h-10 rounded-full"
              />
              <span className="font-semibold text-blue-700 dark:text-pink-200">{otherUser.displayName}</span>
            </>
          )}
          {/* Home Button */}
          <button
            onClick={() => router.push("/")}
            className="ml-auto bg-gradient-to-br from-pink-400 to-blue-400 text-white px-4 py-2 rounded-lg shadow hover:from-pink-500 hover:to-blue-500 transition"
            aria-label="Return Home"
            type="button"
          >
            Return Home
          </button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto space-y-2 custom-scrollbar">
          {messages.map((msg) => {
            const senderProfile = userProfiles[msg.sender];
            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${msg.sender === currentUser.uid ? "justify-end" : "justify-start"}`}
              >
                {msg.sender !== currentUser.uid && senderProfile && (
                  <img
                    src={
                      senderProfile.photoURL ||
                      `https://api.dicebear.com/7.x/thumbs/svg?seed=${senderProfile.displayName || senderProfile.email}`
                    }
                    alt={senderProfile.displayName || "User"}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <div
                  className={`px-4 py-2 rounded-xl max-w-[70%] shadow-md ${
                    msg.sender === currentUser.uid
                      ? "bg-gradient-to-br from-blue-500 to-pink-500 text-white"
                      : "bg-gray-100 dark:bg-[#393053] text-gray-800 dark:text-gray-100"
                  }`}
                  style={{
                    boxShadow:
                      msg.sender === currentUser.uid
                        ? "0 2px 16px rgba(137, 99, 255, 0.2)"
                        : "0 2px 12px rgba(57, 48, 83, 0.08)",
                  }}
                >
                  {senderProfile && (
                    <div className="text-xs font-semibold mb-1">
                      {msg.sender === currentUser.uid ? "You" : senderProfile.displayName || senderProfile.email}
                    </div>
                  )}
                  <span>{msg.text}</span>
                  <div className="block text-xs text-right mt-1 opacity-60">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                {msg.sender === currentUser.uid && senderProfile && (
                  <img
                    src={
                      senderProfile.photoURL ||
                      `https://api.dicebear.com/7.x/thumbs/svg?seed=${senderProfile.displayName || senderProfile.email}`
                    }
                    alt={senderProfile.displayName || "You"}
                    className="w-8 h-8 rounded-full"
                  />
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSend} className="flex gap-2 p-4 border-t border-gray-200 dark:border-[#393053] bg-gradient-to-r from-white/60 to-[#f3e7fa]/80 dark:from-[#232144]/70 dark:to-[#393053]/70">
          <input
            type="text"
            className="flex-1 rounded-lg border border-gray-300 dark:border-[#393053] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-[#232144] dark:text-white bg-white/75"
            placeholder="Type your message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!currentUser}
          />
          <button
            type="submit"
            className="bg-gradient-to-br from-blue-500 to-pink-500 text-white font-bold px-5 py-2 rounded-lg shadow hover:from-blue-700 hover:to-pink-700 transition disabled:opacity-50"
            disabled={!input.trim()}
          >
            Send
          </button>
        </form>
      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #c3bef7 30%, #f093fb 100%);
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}