"use client";
import { useEffect, useState } from "react";
import { getDatabase, ref, onValue, off } from "firebase/database";
import { app as firebaseApp } from "../../firebase";

// Adjust User type as needed, must include uid
export function useUnreadCount(currentUser: { uid: string } | null) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }
    const db = getDatabase(firebaseApp);
    const inboxRef = ref(db, "inbox");

    const handleValue = (snapshot: any) => {
      let count = 0;
      const allChats = snapshot.val();
      if (!allChats) {
        setUnreadCount(0);
        return;
      }
      Object.entries(allChats).forEach(([chatId, chatMessages]: [string, any]) => {
        const uids = chatId.split("_");
        if (!uids.includes(currentUser.uid)) return;
        Object.values(chatMessages || {}).forEach((msg: any) => {
          if (
            msg &&
            msg.sender !== currentUser.uid &&
            (!msg.readBy || !msg.readBy[currentUser.uid])
          ) {
            count += 1;
          }
        });
      });
      setUnreadCount(count);
    };

    onValue(inboxRef, handleValue);
    return () => off(inboxRef, "value", handleValue);
  }, [currentUser]);

  return unreadCount;
}