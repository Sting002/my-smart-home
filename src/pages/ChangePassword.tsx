import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { changePassword } from "@/api/auth";
import { toast } from "@/hooks/use-toast";

const ChangePassword: React.FC = () => {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      await refresh().catch(() => undefined);
      toast({ title: "Password updated", description: "You can continue using the app." });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl p-6 space-y-4">
        <h1 className="text-white text-2xl font-semibold">Update Password</h1>
        <p className="text-gray-400 text-sm">
          For security, you must set a personal password before using the dashboard. Enter the temporary password you
          received (e.g., <code>test123</code>) as your current password.
        </p>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="current" className="text-gray-400 text-sm">
              Current Password
            </label>
            <input
              id="current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mt-1"
              required
            />
          </div>
          <div>
            <label htmlFor="new" className="text-gray-400 text-sm">
              New Password
            </label>
            <input
              id="new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mt-1"
              required
            />
          </div>
          <div>
            <label htmlFor="confirm" className="text-gray-400 text-sm">
              Confirm New Password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mt-1"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold"
          >
            {submitting ? "Saving..." : "Save Password"}
          </button>
        </form>
        <button
          onClick={() => logout().then(() => navigate("/login", { replace: true }))}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold"
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

export default ChangePassword;
