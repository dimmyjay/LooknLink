"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import NavBar from "../nav/page";
import { useUnreadCount } from "../useunreadcount/page";
import { auth } from "@/firebase";

export default function AppLayout({ children }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const unreadCount = useUnreadCount(currentUser);

  return (
    <>
      <NavBar
       
        unreadCount={unreadCount}
      />
      {children}
    </>
  );
}