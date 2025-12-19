"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { io, Socket } from "socket.io-client";

type MedecinSession = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string | null;
  specialite?: string | null;
  adresseCabinet?: string | null;
  rpps?: string | null;
  siret?: string | null;
  photoUrl?: string | null;
};

type Medecin = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  photoUrl?: string | null;
};

type MessageFile = {
  name: string;
  url: string;
  size: number;
  type: string;
};

type Message = {
  id: number;
  contenu: string;
  createdAt: string;
  fromId: number;
  conversationId: number;
  from: Medecin;
  fichiers?: MessageFile[] | null;
};

type ConversationParticipant = {
  id: number;
  medecinId: number;
  medecin: Medecin;
};

type Conversation = {
  id: number;
  name?: string | null;
  cabinetId: number;
  createdAt: string;
  participants: ConversationParticipant[];
  messages: Message[];
};

const BACKEND_URL = "http://localhost:3001";

export default function MessagesPage() {
  const router = useRouter(); // 🔹 AJOUT

  const [session, setSession] = useState<MedecinSession | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  /* ---------------------- 1) SESSION ---------------------- */
  useEffect(() => {
    const saved = localStorage.getItem("medecinSession");
    if (!saved) {
      window.location.href = "/medecin/login";
      return;
    }
    setSession(JSON.parse(saved));
  }, []);

  /* ---------------------- 2) SOCKET ---------------------- */
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  /* ---------------------- 3) OS NOTIF ---------------------- */
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const showNotification = (msg: Message) => {
    if (!session) return;
    if (msg.fromId === session.id) return;
    if (Notification.permission !== "granted") return;

    new Notification(`💬 Dr ${msg.from.prenom} ${msg.from.nom}`, {
      body: msg.contenu || "Nouveau document reçu",
    });
  };

  /* ---------------------- 4) LOAD CONVS ---------------------- */
  const loadConversations = async (medecinId: number) => {
    const res = await fetch(
      `${BACKEND_URL}/conversations/medecin/${medecinId}`
    );
    const data = await res.json();
    setConversations(Array.isArray(data) ? data : []);
  };

  /* ---------------------- 5) LOAD COLLEAGUES ---------------------- */
  const [colleagues, setColleagues] = useState<Medecin[]>([]);
  useEffect(() => {
    const loadColleagues = async () => {
      if (!session) return;
      const resMed = await fetch(`${BACKEND_URL}/medecin/${session.id}`);
      const medData = await resMed.json();

      if (!medData.cabinetId) return;

      const resCab = await fetch(`${BACKEND_URL}/cabinet/${medData.cabinetId}`);
      const cabData = await resCab.json();
      setColleagues(cabData.medecins.filter((m: any) => m.id !== session.id));
    };
    if (session) loadColleagues();
  }, [session]);

  /* ---------------------- 6) LOAD MESSAGES ---------------------- */
  const loadMessages = async (conversationId: number) => {
    const res = await fetch(
      `${BACKEND_URL}/messages/conversation/${conversationId}`
    );
    const data = await res.json();
    setMessages(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    if (!session) return;
    loadConversations(session.id);
  }, [session]);

  /* ---------------------- 7) WS: NEW MESSAGE ---------------------- */
  useEffect(() => {
    if (!selectedConversation || !socketRef.current) return;

    const socket = socketRef.current;

    socket.emit("joinConversation", {
      conversationId: selectedConversation.id,
    });

    const handler = (msg: Message) => {
      if (msg.conversationId === selectedConversation.id) {
        setMessages((prev) => [...prev, msg]);
      }
      showNotification(msg);
    };

    socket.on("newMessage", handler);
    return () => socket.off("newMessage", handler);
  }, [selectedConversation, session]);

  /* ---------------------- 8) SEND MESSAGE ---------------------- */
  const uploadFile = async (file: File) => {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${BACKEND_URL}/messages/upload`, {
      method: "POST",
      body: form,
    });
    return res.json();
  };

  const handleSend = async () => {
    if (!session || !selectedConversation) return;

    const trimmed = newMessage.trim();
    if (!trimmed && selectedFiles.length === 0) return;

    let uploaded: MessageFile[] = [];
    if (selectedFiles.length > 0) {
      uploaded = await Promise.all(selectedFiles.map((f) => uploadFile(f)));
    }

    await fetch(`${BACKEND_URL}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromId: session.id,
        conversationId: selectedConversation.id,
        contenu: trimmed,
        fichiers: uploaded.length > 0 ? uploaded : undefined,
      }),
    });

    setNewMessage("");
    setSelectedFiles([]);
  };

  /* ---------------------- RENDER ---------------------- */
  return (
    <div className="flex bg-slate-950 text-white min-h-screen">
      <Sidebar />

      <div className="flex-1 p-8 max-w-7xl mx-auto flex flex-col">
        {/* 🔙 RETOUR DASHBOARD */}
        <button
          onClick={() => router.push("/medecin/dashboard")}
          className="mb-4 px-4 py-2 bg-slate-800 rounded hover:bg-slate-700 transition self-start"
        >
          ← Retour au dashboard
        </button>

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-emerald-400">Messagerie</h1>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-sm"
          >
            Nouvelle conversation
          </button>
        </div>

        <div className="flex flex-1 gap-6 min-h-[500px]">
          {/* … le reste du composant est STRICTEMENT IDENTIQUE … */}


          {/* LISTE CONVERSATIONS */}
          <div className="w-72 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h2 className="text-sm font-semibold mb-3">Conversations</h2>

            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setSelectedConversation(conv);
                  setMessages([]);
                  loadMessages(conv.id);
                }}
                className={`w-full px-3 py-2 rounded-xl text-sm text-left ${
                  selectedConversation?.id === conv.id
                    ? "bg-emerald-500 text-black font-semibold"
                    : "bg-slate-800 hover:bg-slate-700"
                }`}
              >
                {conv.name || "Conversation"}
              </button>
            ))}
          </div>

          {/* MESSAGES */}
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col">
            {!selectedConversation ? (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                Sélectionnez une conversation
              </div>
            ) : (
              <>
                {/* LISTE */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {messages.map((msg) => {
                    const isMe = msg.fromId === session?.id;

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                            isMe
                              ? "bg-emerald-500 text-black"
                              : "bg-slate-800 text-slate-200"
                          }`}
                        >
                          {msg.contenu}

                          {/* 🔥 DOCUMENTS */}
                          {msg.fichiers && msg.fichiers.length > 0 && (
                            <div
                              className={`mt-2 space-y-1 ${
                                msg.contenu ? "pt-2 border-t border-black/10" : ""
                              }`}
                            >
                              {msg.fichiers.map((f, idx) => (
                                <a
                                  key={idx}
                                  href={`${BACKEND_URL}${f.url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block text-xs underline break-all hover:text-emerald-400"
                                >
                                  📎 {f.name}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div ref={bottomRef} />
                </div>

                {/* INPUT */}
                <div className="border-t border-slate-800 pt-3 mt-3">
                  {selectedFiles.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2 text-xs text-slate-400">
                      {selectedFiles.map((f, i) => (
                        <div
                          key={i}
                          className="px-2 py-1 bg-slate-800 rounded-lg border border-slate-700"
                        >
                          📎 {f.name}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 items-center">

                    <label
                      htmlFor="file-input"
                      className="cursor-pointer bg-slate-800 px-3 py-2 rounded-xl"
                    >
                      📎
                    </label>

                    <input
                      id="file-input"
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e: any) =>
                        setSelectedFiles(Array.from(e.target.files || []))
                      }
                    />

                    <input
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2"
                      placeholder="Écrire..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />

                    <button
                      onClick={handleSend}
                      className="bg-emerald-500 text-black px-4 py-2 rounded-xl"
                    >
                      Envoyer
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* MODAL CREATION */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-lg font-semibold text-emerald-400 mb-4">
                Nouvelle conversation
              </h2>

              <input
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 mb-4 text-sm"
                placeholder="Nom (optionnel)"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />

              <div className="max-h-60 overflow-y-auto mb-4 space-y-2">
                {colleagues.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(m.id)}
                      onChange={() =>
                        setSelectedMembers((prev) =>
                          prev.includes(m.id)
                            ? prev.filter((x) => x !== m.id)
                            : [...prev, m.id]
                        )
                      }
                    />
                    Dr {m.prenom} {m.nom}
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedMembers([]);
                    setGroupName("");
                  }}
                  className="px-4 py-2 rounded-xl text-sm bg-slate-800"
                >
                  Annuler
                </button>

                <button
                  onClick={async () => {
                    if (!session) return;

                    const participants = Array.from(
                      new Set([session.id, ...selectedMembers])
                    );

                    const res = await fetch(`${BACKEND_URL}/medecin/${session.id}`);
                    const med = await res.json();

                    const payload = {
                      name: groupName || undefined,
                      cabinetId: med.cabinetId,
                      participantIds: participants,
                    };

                    const createRes = await fetch(`${BACKEND_URL}/conversations`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    });

                    const data = await createRes.json();

                    setShowCreateModal(false);
                    setSelectedMembers([]);
                    setGroupName("");

                    await loadConversations(session.id);
                    setSelectedConversation(data);
                    loadMessages(data.id);
                  }}
                  disabled={selectedMembers.length === 0}
                  className="px-4 py-2 rounded-xl text-sm bg-emerald-500 text-black"
                >
                  Créer
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
