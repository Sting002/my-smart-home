// src/components/AppLayout.tsx
import React from "react";
import { Outlet } from "react-router-dom";

import { ConnectionStatus } from "@/components/ConnectionStatus";
import { Toaster } from "@/components/ui/toaster";
import { BottomNav } from "@/components/BottomNav";

const AppLayout: React.FC = () => {
  return (
    <>
      <ConnectionStatus />
      <Toaster />
      <div className="min-h-screen bg-gray-900 pb-[82px]">
        <div className="max-w-2xl mx-auto p-4">
          {/* Nested routes render here */}
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </>
  );
};

export  default AppLayout;
