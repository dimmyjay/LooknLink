"use client";
import React from "react";
import Link from "next/link";
import {
  FaHome,
  FaUserPlus,
  FaComments,
  FaBell,
  FaVideo,
  FaMoon,
  FaSun,
  FaSignOutAlt,
  FaUserPlus as FaUserPlus2,
  FaGoogle,
} from "react-icons/fa";
import { useRouter, usePathname } from "next/navigation";

type NavBarProps = {
  dark: boolean;
  setDark: React.Dispatch<React.SetStateAction<boolean>>;
  firebaseUser: any;
  handleLogout: () => void;
  handleLogin: () => void;
  setSignupPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  unreadCount: number;
  videoCount: number;
  notifCount?: number;
};

export default function NavBar({
  dark,
  setDark,
  firebaseUser,
  handleLogout,
  handleLogin,
  setSignupPrompt,
  unreadCount,
  videoCount,
  notifCount = 0,
}: NavBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Only show unreadCount badge if user has at least one message
  const showUnread =
    firebaseUser?.uid &&
    typeof unreadCount === "number" &&
    unreadCount > 0;

  // Only show videoCount badge if user has at least one unseen video
  // And NOT on /videoreel page (clear badge while viewing video reels)
  const showVideo =
    firebaseUser?.uid &&
    typeof videoCount === "number" &&
    videoCount > 0 &&
    pathname !== "/videoreel";

  return (
    <nav className="fixed top-0 left-0 w-full backdrop-blur shadow z-50 flex justify-between items-center px-6 py-3 transition-colors duration-300 border-b border-gray-200 dark:border-[#393053]">
      <div className="flex items-center gap-2">
        <span className="text-[30px] text-blue-600 dark:text-pink-300 font-extrabold drop-shadow">🔗</span>
        <span className="text-blue-700 dark:text-pink-200 font-bold text-2xl tracking-wide">LooknLink</span>
      </div>
      <div className="flex space-x-6 text-gray-600 dark:text-pink-200 text-xl items-center">
        <Link href="/" passHref>
          <button title="Home" className="hover:text-blue-700 dark:hover:text-pink-400">
            <FaHome />
          </button>
        </Link>
        {/*  <button title="Add Friend" className="hover:text-blue-700 dark:hover:text-pink-400"><FaUserPlus /></button> */}
        <div className="relative">
        {firebaseUser?.uid ? (
          <Link href={`/chat/${firebaseUser.uid}`}>
            <button title="Messages" className="hover:text-blue-700 dark:hover:text-pink-400 relative">
              <FaComments />
              {showUnread && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full text-xs px-1.5 py-0.5">
                  {unreadCount}
                </span>
              )}
            </button>
          </Link>
        ) : (
          <button
            title="Login to view messages"
            className="text-gray-400 cursor-not-allowed relative"
            disabled
          >
            <FaComments />
          </button>
        )}
        </div>
        <div className="relative">
        {/* <Link
          href="/notification"
          title="Notifications"
          className="hover:text-blue-700 dark:hover:text-pink-400 relative"
        >
          <FaBell />
          {notifCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-pink-500 text-white rounded-full text-xs px-2 py-0.5 font-bold border-2 border-white dark:border-[#232144] animate-bounce">
              {notifCount}
            </span>
          )}
        </Link> */}
        </div>
        <div className="relative">
          <Link href="/videoreel">
            <button title="Video Reels" className="hover:text-blue-700 dark:hover:text-pink-400 relative">
              <FaVideo />
              {showVideo && (
                <span className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full text-xs px-1.5 py-0.5">
                  {videoCount}
                </span>
              )}
            </button>
          </Link>
        </div>
        {/* <button
          onClick={() => setDark((d) => !d)}
          className="ml-2 focus:outline-none transition"
          title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle dark mode"
        >
          {dark ? <FaSun className="text-yellow-400" /> : <FaMoon className="text-gray-700" />}
        </button> */}
        {firebaseUser ? (
          <button
            onClick={handleLogout}
            className="ml-2 px-3 py-1 bg-gradient-to-br from-red-500 to-pink-500 text-white rounded-lg flex items-center gap-2 font-medium hover:from-red-700 hover:to-pink-600 transition shadow"
            title="Logout"
          >
            <FaSignOutAlt /> <span className="hidden sm:inline">Logout</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => setSignupPrompt(true)}
              className="ml-2 px-3 py-1 bg-gradient-to-br from-green-500 to-blue-500 text-white rounded-lg flex items-center gap-2 font-medium hover:from-green-700 hover:to-blue-700 transition shadow"
              title="Sign up"
            >
              <FaUserPlus2 /> <span className="hidden sm:inline">Sign Up</span>
            </button>
            <button
              onClick={handleLogin}
              className="ml-2 px-3 py-1 bg-gradient-to-br from-blue-500 to-green-500 text-white rounded-lg flex items-center gap-2 font-medium hover:from-blue-700 hover:to-green-700 transition shadow"
              title="Login with Google"
            >
              <FaGoogle /> <span className="hidden sm:inline">Login</span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
}