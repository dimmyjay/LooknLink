"use client";
import { useState } from "react";
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { app as firebaseApp } from "../../firebase";
import { FaGoogle } from "react-icons/fa";

export default function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = getAuth(firebaseApp);
      await signInWithEmailAndPassword(auth, email, password);
      setLoading(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Email login error:", err);
      setError(err.message || "Login failed.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const auth = getAuth(firebaseApp);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setLoading(false);
      onSuccess?.();
    } catch (err: any) {
      // This could be popup blocked, provider not enabled, or domain not allowed
      console.error("Google login error:", err);
      setError(err.message || "Login failed.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xs mx-auto bg-white dark:bg-[#232144] rounded-xl shadow-lg p-6">
      <form onSubmit={handleEmailLogin}>
        <label className="block mb-2 font-semibold text-gray-700 dark:text-pink-200">Email</label>
        <input
          className="w-full mb-4 px-3 py-2 border rounded-lg dark:bg-[#18122B] dark:text-white"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <label className="block mb-2 font-semibold text-gray-700 dark:text-pink-200">Password</label>
        <input
          className="w-full mb-4 px-3 py-2 border rounded-lg dark:bg-[#18122B] dark:text-white"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <div className="my-4 text-center text-gray-500 dark:text-pink-100">OR</div>
      <button
        onClick={handleGoogleLogin}
        className="w-full flex items-center justify-center bg-red-500 text-white font-bold py-2 rounded-lg hover:bg-red-600 transition"
        disabled={loading}
        type="button"
      >
        <FaGoogle className="mr-2" /> Sign in with Google
      </button>
    </div>
  );
}