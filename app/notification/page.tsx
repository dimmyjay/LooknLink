"use client";

import React, { useEffect, useState } from "react";
import { ref, onValue, off, update } from "firebase/database";
import { db } from "../../firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { FaLink } from "react-icons/fa";

type Notification = {
  id: string;
  url: string;
  owner: string;
  createdAt: string;
  seen: boolean;
};

export default function NotificationPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);

  // Get current user on mount
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    const messagesRef = ref(db, "messages");
    const handleValue = (snapshot: any) => {
      const data = snapshot.val() || {};
      const notifArr = Object.entries(data)
        .flatMap(([key, value]: [string, any]) => {
          if (
            value.notifications &&
            value.notifications[firebaseUser.uid] !== undefined
          ) {
            return [{
              id: key,
              url: value.url,
              owner: value.owner,
              createdAt: value.createdAt,
              seen:
                value.notifications &&
                value.notifications[firebaseUser.uid] &&
                value.notifications[firebaseUser.uid].seen
                  ? true
                  : false,
            }];
          }
          return [];
        })
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setNotifications(notifArr);
      setLoading(false);
    };
    onValue(messagesRef, handleValue);

    return () => off(messagesRef, "value", handleValue);
  }, [firebaseUser]);

  // Mark all as seen when the user loads the page
  useEffect(() => {
    if (firebaseUser && notifications.length > 0) {
      notifications.forEach((notif) => {
        if (!notif.seen) {
          const notifRef = ref(db, `messages/${notif.id}/notifications/${firebaseUser.uid}`);
          update(notifRef, { seen: true });
        }
      });
    }
  }, [firebaseUser, notifications.length]); // do not depend on all notifications, just length

  if (!firebaseUser) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <div className="text-gray-500">Please log in to view notifications.</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-12">
      <h2 className="text-3xl font-bold mb-8 text-center text-blue-700 dark:text-pink-200">
        Notifications
      </h2>
      {loading ? (
        <div className="text-center text-gray-400 py-6">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center text-gray-400 py-6">
          <span>There&apos;s no notification.</span>
        </div>
      ) : (
        <ul className="space-y-4">
          {notifications.map((notif) => (
            <li
              key={notif.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition ${
                notif.seen
                  ? "bg-gray-100 dark:bg-[#2d2550]"
                  : "bg-blue-50 dark:bg-pink-700/30 shadow"
              }`}
            >
              <FaLink className="text-blue-600 dark:text-pink-300 text-xl" />
              <div className="flex-1">
                <div className="text-gray-800 dark:text-pink-100 font-semibold">
                  {notif.owner} posted a new link!
                </div>
                <a
                  href={notif.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-pink-200 underline text-sm break-all"
                >
                  {notif.url}
                </a>
                <div className="text-xs text-gray-400 mt-1">
                  {formatTimeAgo(notif.createdAt)}
                </div>
              </div>
              {!notif.seen && (
                <span className="ml-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                  New
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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