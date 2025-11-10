import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/", icon: "📊", label: "Dashboard" },
    { path: "/devices", icon: "🔌", label: "Devices" },
    { path: "/automations", icon: "🤖", label: "Auto" },
    { path: "/insights", icon: "📈", label: "Insights" },
    { path: "/settings", icon: "⚙️", label: "Settings" },
  ]; // ✅ FIXED — removed extra semicolon that caused parse error

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-4 py-2 z-50">
      <div className="max-w-2xl mx-auto flex justify-around">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all ${
              location.pathname === item.path
                ? "text-green-500"
                : "text-gray-400 hover:text-white"
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
