"use client";
import { getDatabase, ref, get } from "firebase/database";
import { useEffect, useState } from "react";
import { app as firebaseApp } from "../../firebase"; // adjust if needed

export function useUserProfile(uid: string | null) {
  const [profile, setProfile] = useState<{ photoURL: string; displayName: string } | null>(null);

  useEffect(() => {
    if (!uid) return;

    const db = getDatabase(firebaseApp);
    const userRef = ref(db, `users/${uid}`);

    get(userRef).then((snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProfile({
          photoURL: data.photoURL || "",
          displayName: data.displayName || "Unknown",
        });
      }
    });
  }, [uid]);

  return profile;
}
