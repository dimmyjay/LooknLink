"use client";
import { useEffect, useState, useRef } from "react";
import { getDatabase, ref, onValue, push, off, get, update } from "firebase/database";
import { app as firebaseApp, auth } from "../../firebase";
import { useParams } from "next/navigation";
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
  read?: boolean;
};

// ---- Component ----
export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();

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

  // Fetch messages for THIS user from user_inbox
  useEffect(() => {
    if (!chatId || !currentUser) return;
    const db = getDatabase(firebaseApp);
    const messagesRef = ref(db, `user_inbox/${currentUser.uid}/${chatId}`);
    const handleValue = (snapshot: any) => {
      const data = snapshot.val() || {};
      const arr: Message[] = Object.entries(data).map(([id, msg]: [string, any]) => ({
        id,
        sender: msg.sender,
        text: msg.text,
        timestamp: msg.timestamp,
        read: msg.read,
      }));
      arr.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(arr);

      // Fetch all sender profiles in this chat
      const uids = Array.from(new Set(arr.map(m => m.sender)));
      const promises = uids.map(uid => {
        if (userProfiles[uid]) return Promise.resolve();
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
  }, [chatId, currentUser]);

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

  // Mark all incoming messages as read when opening
  useEffect(() => {
    if (!chatId || !currentUser) return;
    const db = getDatabase(firebaseApp);
    const messagesRef = ref(db, `user_inbox/${currentUser.uid}/${chatId}`);
    get(messagesRef).then((snapshot) => {
      const data = snapshot.val() || {};
      const updates: any = {};
      Object.entries(data).forEach(([id, msg]: [string, any]) => {
        if (msg.sender !== currentUser.uid && !msg.read) {
          updates[`${id}/read`] = true;
        }
      });
      if (Object.keys(updates).length > 0) {
        update(messagesRef, updates);
      }
    });
  }, [chatId, currentUser]);

  // Send message to both users' inboxes
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentUser) return;
    const db = getDatabase(firebaseApp);

    const uids = chatId.split("_");
    const recipientUid = uids.find((uid) => uid !== currentUser.uid);
    if (!recipientUid) return;

    const message = {
      sender: currentUser.uid,
      text: input.trim(),
      timestamp: Date.now(),
      read: false, // unread for recipient
    };

    // Write to sender's inbox (mark as read)
    await push(ref(db, `user_inbox/${currentUser.uid}/${chatId}`), { ...message, read: true });
    // Write to recipient's inbox (unread)
    await push(ref(db, `user_inbox/${recipientUid}/${chatId}`), message);

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
    <div className="max-w-2xl mx-auto bg-white dark:bg-[#232144] rounded-2xl shadow-xl border border-gray-200 dark:border-[#393053] mt-10 flex flex-col h-[80vh]">
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
        <span className="ml-auto text-xs text-gray-400">Chat ID: {chatId}</span>
      </div>
      <div className="flex-1 p-6 overflow-y-auto space-y-2">
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
                className={`px-4 py-2 rounded-xl max-w-[70%] ${
                  msg.sender === currentUser.uid
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 dark:bg-[#393053] text-gray-800 dark:text-gray-100"
                }`}
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
      <form onSubmit={handleSend} className="flex gap-2 p-4 border-t border-gray-200 dark:border-[#393053]">
        <input
          type="text"
          className="flex-1 rounded-lg border border-gray-300 dark:border-[#393053] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-[#232144] dark:text-white"
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
  );
}