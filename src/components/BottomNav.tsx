import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const navItems = useMemo(() => {
    const base = [
      { path: "/dashboard", icon: "📊", label: "Dashboard" },
      { path: "/devices", icon: "🔌", label: "Devices" },
      { path: "/automations", icon: "⚙️", label: "Auto" },
      { path: "/insights", icon: "📈", label: "Insights" },
      { path: "/settings", icon: "⚙", label: "Settings" },
    ];
    if (user?.role === "admin") {
      base.push({ path: "/admin", icon: "🛡️", label: "Admin" });
    }
    return base;
  }, [user]);

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/" || location.pathname.startsWith("/dashboard");
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-4 py-2 z-50">
      <div className="max-w-2xl mx-auto flex justify-around">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all ${
              isActive(item.path) ? "text-green-500" : "text-gray-400 hover:text-white"
            }`}
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BottomNav;
