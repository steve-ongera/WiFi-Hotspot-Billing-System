import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/common/Sidebar";
import Navbar from "../components/common/Navbar";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="wb-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="wb-main">
        <Navbar onToggleSidebar={() => setSidebarOpen((p) => !p)} />
        <div className="wb-page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}