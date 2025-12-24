"use client";

import { Calendar, User, LogOut, FileText, Clock } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export default function SidebarSecretaire() {
  const router = useRouter();
  const pathname = usePathname();

  const items = [
    {
      label: "Planning",
      icon: <Calendar size={18} />,
      path: "/secretaire/dashboard",
    },
    {
      label: "Horaires de référence",
      icon: <Clock size={18} />,
      path: "/secretaire/dashboard/horaires-reference",
    },
    {
      label: "Mon profil",
      icon: <User size={18} />,
      path: "/secretaire/dashboard/profil",
    },
    {
      label: "Fiches patients",
      icon: <FileText size={18} />,
      path: "/secretaire/dashboard/patient-notes",
    },
  ];

  const logout = () => {
    localStorage.removeItem("secretaireSession");
    router.push("/secretaire/login");
  };

  return (
    <div className="h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-6 text-xl text-emerald-400 font-bold">
        Espace secrétaire
      </div>

      <div className="flex-1 space-y-1">
        {items.map((item) => {
          const active =
            pathname === item.path || pathname.startsWith(item.path + "/");

          return (
            <button
              key={item.path}
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
        <LogOut size={18} className="inline mr-2" />
        Se déconnecter
      </button>
    </div>
  );
}
