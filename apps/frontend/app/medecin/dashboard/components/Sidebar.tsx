"use client";

import { Home, User, MessageSquare, Video, LogOut } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const items = [
    { label: "Dashboard", icon: <Home size={20} />, path: "/medecin/dashboard" },
    { label: "Profil", icon: <User size={20} />, path: "/medecin/dashboard/profil" },
    { label: "Messagerie", icon: <MessageSquare size={20} />, path: "/medecin/dashboard/messages" },
    { label: "Visio", icon: <Video size={20} />, path: "/medecin/dashboard/visio" },
  ];

  const logout = () => {
    localStorage.removeItem("medecinSession");
    router.push("/medecin/login");
  };

  return (
    <div className="h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-6 text-xl text-emerald-400 font-bold">MonCabinet</div>

      <div className="flex-1 space-y-1">
        {items.map((item, index) => {
          const active = pathname.startsWith(item.path);

          return (
            <button
              key={index}
              onClick={() => router.push(item.path)}
              className={`w-full flex items-center gap-3 px-6 py-3 transition ${
                active
                  ? "bg-slate-800 text-emerald-400 font-semibold"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={logout}
        className="text-red-400 p-6 text-left hover:bg-slate-800"
      >
        <LogOut size={20} className="inline mr-2" />
        Se déconnecter
      </button>
    </div>
  );
}
