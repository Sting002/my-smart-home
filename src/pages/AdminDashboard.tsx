import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { adminCreateUser, fetchManagedUsers, type ManagedUser } from "@/api/auth";
import { toast } from "@/hooks/use-toast";

type FormState = {
  username: string;
  password: string;
  role: "admin" | "user";
};

const initialForm: FormState = {
  username: "",
  password: "",
  role: "user",
};

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchManagedUsers();
        if (!alive) return;
        setUsers(res.users || []);
      } catch (err) {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : "Failed to load users";
        setError(msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" })),
    [users]
  );

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) {
      setError("Username and password are required");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const created = await adminCreateUser({
        username: form.username.trim(),
        password: form.password,
        role: form.role,
      });
      setUsers((prev) => [...prev, created]);
      setForm(initialForm);
      toast({
        title: "User created",
        description: `${created.username} (${created.role}) can now sign in.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create user";
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h1 className="text-2xl font-semibold text-white mb-2">Admin Dashboard</h1>
        <p className="text-gray-400 text-sm">
          Only administrators can view this area. Use it to onboard trusted teammates. Non-admin users cannot delete
          devices or settings.
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-white font-semibold mb-4">Create User</h2>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="newUsername" className="text-gray-400 text-sm">
              Username
            </label>
            <input
              id="newUsername"
              name="newUsername"
              type="text"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
              required
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="text-gray-400 text-sm">
              Temporary Password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Share this with the new user securely. They can change it later.</p>
          </div>
          <div>
            <label htmlFor="newRole" className="text-gray-400 text-sm">
              Role
            </label>
            <select
              id="newRole"
              name="newRole"
              value={form.role}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, role: e.target.value === "admin" ? "admin" : "user" }))
              }
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            >
              <option value="user">User (no delete permissions)</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={creating}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold"
          >
            {creating ? "Creating…" : "Create User"}
          </button>
        </form>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Existing Users</h2>
          {loading && <span className="text-sm text-gray-400">Loading…</span>}
        </div>
        {sortedUsers.length === 0 && !loading ? (
          <p className="text-gray-400 text-sm">No users found.</p>
        ) : (
          <ul className="divide-y divide-gray-700">
            {sortedUsers.map((u) => (
              <li key={u.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{u.username}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{u.role}</p>
                </div>
                <span className="text-gray-400 text-xs">
                  {u.created_at ? new Date(u.created_at).toLocaleString() : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
