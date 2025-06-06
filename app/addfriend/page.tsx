"use client";
import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { getDatabase, ref, onValue, set, off, get } from "firebase/database";
import { app as firebaseApp } from "../../firebase";
import Link from "next/link";
import { FaRegCommentDots } from "react-icons/fa6";

type UserProfile = {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
};

function useOtherUsers(loggedInUser: User | null) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  useEffect(() => {
    if (!loggedInUser) {
      setUsers([]);
      return;
    }
    const db = getDatabase(firebaseApp);
    const usersRef = ref(db, "users");
    const handleValue = (snapshot: any) => {
      const data = snapshot.val();
      if (!data) {
        setUsers([]);
        return;
      }
      const arr: UserProfile[] = Object.entries(data)
        .map(([uid, user]: [string, any]) => ({
          uid,
          displayName: user.displayName || user.email || "Unknown",
          photoURL: user.photoURL || "",
          email: user.email || "",
        }))
        .filter((u) => u.uid !== loggedInUser.uid);
      setUsers(arr);
    };
    onValue(usersRef, handleValue);
    return () => off(usersRef, "value", handleValue);
  }, [loggedInUser]);
  return users;
}

export async function saveUserProfile(user: User) {
  const db = getDatabase(firebaseApp);
  await set(ref(db, `users/${user.uid}`), {
    uid: user.uid,
    displayName: user.displayName || user.email || "Unknown",
    photoURL: user.photoURL || "",
    email: user.email || "",
  });
}

async function addFriend(loggedInUid: string, friendUid: string) {
  const db = getDatabase(firebaseApp);
  await set(ref(db, `friends/${loggedInUid}/${friendUid}`), true);
  await set(ref(db, `friends/${friendUid}/${loggedInUid}`), true);
}

function getChatId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join("_");
}

export function AddFriends({ firebaseUser }: { firebaseUser: User | null }) {
  const users = useOtherUsers(firebaseUser);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;

    const db = getDatabase(firebaseApp);
    const friendsRef = ref(db, `friends/${firebaseUser.uid}`);
    const usersRef = ref(db, "users");

    const handleValue = async (snapshot: any) => {
      const data = snapshot.val();
      const friendUids = data ? Object.keys(data) : [];

      const usersSnapshot = await get(usersRef);
      const allUsers = usersSnapshot.val();

      const fullFriends: UserProfile[] = friendUids
        .map((uid) => allUsers?.[uid])
        .filter((u: any) => !!u && (u.displayName || u.email))
        .map((u: any) => ({
          uid: u.uid,
          displayName: u.displayName || u.email || "Unknown",
          photoURL: u.photoURL || "",
          email: u.email || "",
        }));

      setFriendProfiles(fullFriends);
      setAdded(
        friendUids.filter(
          (uid) => !!allUsers?.[uid] && (allUsers[uid].displayName || allUsers[uid].email)
        )
      );
    };

    onValue(friendsRef, handleValue);
    return () => off(friendsRef, "value", handleValue);
  }, [firebaseUser]);

  const handleAddFriend = async (friendUid: string) => {
    if (!firebaseUser) return;
    setAdding(friendUid);
    await addFriend(firebaseUser.uid, friendUid);
    setAdding(null);
  };

  if (!firebaseUser) {
    return <div className="text-center py-6">Login to add friends!</div>;
  }

  const usersToAdd = users.filter((u) => !added.includes(u.uid));

  return (
    <div className="max-w-lg mx-auto bg-white dark:bg-[#232144] rounded-2xl shadow-xl border border-gray-200 dark:border-[#393053] p-6 mt-10 h-[500px] overflow-y-auto">
      <h2 className="font-bold text-xl mb-4 text-blue-700 dark:text-pink-200">Add Friends</h2>

      {usersToAdd.length === 0 ? (
        <div className="text-gray-500">No users to add yet!</div>
      ) : (
        <ul className="space-y-4 mb-6">
          {usersToAdd.map((u) => (
            <li key={u.uid} className="flex items-center gap-3">
              <img
                src={
                  u.photoURL ||
                  `https://api.dicebear.com/7.x/thumbs/svg?seed=${u.displayName || u.email}`
                }
                alt={u.displayName || "User"}
                className="w-10 h-10 rounded-full"
              />
              <span className="flex-1 font-medium text-gray-700 dark:text-pink-100">
                {u.displayName}
              </span>
              <button
                onClick={() => handleAddFriend(u.uid)}
                disabled={adding === u.uid}
                className={`px-3 py-1 rounded-lg font-medium text-white bg-gradient-to-br from-blue-500 to-pink-500 hover:from-blue-700 hover:to-pink-700 transition shadow ${
                  adding === u.uid ? "opacity-75" : ""
                }`}
              >
                {adding === u.uid ? "Adding..." : "Add Friend"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {friendProfiles.length > 0 && (
        <>
          <h3 className="font-bold text-lg mt-8 mb-3 text-blue-700 dark:text-pink-200">
            Your Friends
          </h3>
          <ul className="space-y-4">
            {friendProfiles.map((friend) => (
              <li key={friend.uid} className="flex items-center gap-3">
                <img
                  src={
                    friend.photoURL ||
                    `https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.displayName || friend.email}`
                  }
                  alt={friend.displayName || "Friend"}
                  className="w-10 h-10 rounded-full"
                />
                <span className="flex-1 font-medium text-gray-700 dark:text-pink-100">
                  {friend.displayName}
                </span>
                <Link
                  href={`/inbox/${getChatId(firebaseUser.uid, friend.uid)}`}
                  title={`Message ${friend.displayName}`}
                  className="group p-2 rounded-full transition bg-gradient-to-br from-blue-400 to-pink-400 shadow-md hover:from-pink-400 hover:to-blue-400 hover:scale-110 flex items-center justify-center"
                >
                  <FaRegCommentDots
                    size={24}
                    className="text-white group-hover:text-pink-50 transition"
                  />
                </Link>
                <span className="text-sm text-gray-500 dark:text-gray-300">Friend</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
