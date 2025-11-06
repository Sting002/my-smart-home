import React, { useState } from "react";
import { apiPost, APIError } from "@/api/client";
import { useNavigate } from "react-router-dom";

type LoginResponse = { id: string; username: string };

// Type guard to read error payload safely without `any`
function hasErrorField(x: unknown): x is { error?: unknown; message?: unknown } {
  return typeof x === "object" && x !== null;
}

const Login: React.FC = () => {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiPost<LoginResponse, { username: string; password: string }>(
        "/auth/login",
        { username, password }
      );

      // Optional: mark first-run onboarding complete
      localStorage.setItem("onboarded", "true");

      nav("/"); // dashboard
    } catch (err: unknown) {
      if (err instanceof APIError) {
        let msg = err.message;
        if (hasErrorField(err.payload)) {
          const p = err.payload as { error?: unknown; message?: unknown };
          if (typeof p.error === "string") msg = p.error;
          else if (typeof p.message === "string") msg = p.message;
        }
        setError(msg);
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-gray-800 p-6 rounded-xl space-y-4 border border-gray-700"
      >
        <h1 className="text-white text-2xl font-bold text-center">Sign in</h1>

        {error && (
          <div className="bg-red-500/20 text-red-300 border border-red-500 rounded p-2 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="username" className="text-gray-300 text-sm">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="text-gray-300 text-sm">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          disabled={busy}
          className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white py-2 rounded font-semibold"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
};

export default Login;
