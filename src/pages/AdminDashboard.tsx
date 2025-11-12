import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  adminCreateUser,
  fetchManagedUsers,
  deleteManagedUser,
  type ManagedUser,
} from "@/api/auth";
import { toast } from "@/hooks/use-toast";

const TEMP_PASSWORD_LABEL = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  ?.VITE_DEFAULT_TEMP_PASSWORD || "test123";

const initialForm = {
  username: "",
  role: "user" as "admin" | "user",
};

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    if (!form.username.trim()) {
      setError("Username is required");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const created = await adminCreateUser({
        username: form.username.trim(),
        role: form.role,
      });
      const newUser: ManagedUser = {
        id: created.id,
        username: created.username,
        role: created.role,
        mustChangePassword: true,
        created_at: Date.now(),
      };
      setUsers((prev) => [...prev, newUser]);
      setForm(initialForm);
      const tempPwd = created.temporaryPassword || TEMP_PASSWORD_LABEL;
      toast({
        title: "User created",
        description: `Provide ${tempPwd} to ${created.username}; they will be required to change it on first login.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create user";
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (id: string, username: string) => {
    if (id === user.id) {
      toast({ title: "Cannot delete", description: "You cannot delete your own account." });
      return;
    }
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await deleteManagedUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast({ title: "User deleted", description: `${username} removed.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete user";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h1 className="text-2xl font-semibold text-white mb-2">Admin Dashboard</h1>
        <p className="text-gray-400 text-sm">
          Only administrators can view this area. Use it to onboard trusted teammates. New accounts start with the
          temporary password <span className="text-white font-semibold">{TEMP_PASSWORD_LABEL}</span> and must change it
          on first login.
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

          <p className="text-xs text-gray-500">
            The new user signs in with password <span className="font-semibold text-white">{TEMP_PASSWORD_LABEL}</span>
            
 and will immediately be prompted to set their own password.
          </p>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={creating}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold"
          >
            {creating ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Existing Users</h2>
          {loading && <span className="text-sm text-gray-400">Loading...</span>}
        </div>
        {sortedUsers.length === 0 && !loading ? (
          <p className="text-gray-400 text-sm">No users found.</p>
        ) : (
          <ul className="divide-y divide-gray-700">
            {sortedUsers.map((u) => (
              <li key={u.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-white font-medium">{u.username}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    {u.role}
                    {u.mustChangePassword ? " • TEMP PASSWORD" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleString() : "-"}
                  </span>
                  {u.id !== user.id && (
                    <button
                      onClick={() => onDelete(u.id, u.username)}
                      disabled={deletingId === u.id}
                      className="text-sm text-red-400 hover:text-red-200 disabled:opacity-50"
                    >
                      {deletingId === u.id ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
