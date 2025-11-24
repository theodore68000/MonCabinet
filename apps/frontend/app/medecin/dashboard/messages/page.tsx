"use client";

import { useEffect, useState, useRef } from "react";
import Sidebar from "../components/Sidebar";

type MedecinSession = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
};

type Medecin = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  photoUrl?: string | null;
};

type Message = {
  id: number;
  contenu: string;
  createdAt: string;
  fromId: number;
  conversationId: number;
  from: Medecin;
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
  const [session, setSession] = useState<MedecinSession | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const [colleagues, setColleagues] = useState<Medecin[]>([]);
  const [loadingColleagues, setLoadingColleagues] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [creatingConversation, setCreatingConversation] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const saved = localStorage.getItem("medecinSession");
    if (!saved) {
      window.location.href = "/medecin/login";
      return;
    }
    try {
      setSession(JSON.parse(saved));
    } catch {
      localStorage.removeItem("medecinSession");
      window.location.href = "/medecin/login";
    }
  }, []);

  const loadConversations = async (medecinId: number) => {
    setLoadingConversations(true);
    try {
      const res = await fetch(`${BACKEND_URL}/conversations/medecin/${medecinId}`);
      const data = await res.json();

      if (!res.ok || !Array.isArray(data)) {
        setConversations([]);
        return;
      }

      setConversations(data);
    } catch {
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadColleagues = async (medecinId: number) => {
    try {
      const resMed = await fetch(`${BACKEND_URL}/medecin/${medecinId}`);
      const medData = await resMed.json();

      if (!medData.cabinetId) {
        setColleagues([]);
        setLoadingColleagues(false);
        return;
      }

      const resCab = await fetch(`${BACKEND_URL}/cabinet/${medData.cabinetId}`);
      const cabData = await resCab.json();

      setColleagues((cabData.medecins || []).filter((m: any) => m.id !== medecinId));
    } catch {
      setColleagues([]);
    } finally {
      setLoadingColleagues(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    loadConversations(session.id);
    loadColleagues(session.id);
  }, [session]);

  const loadMessages = async (conversationId: number) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`${BACKEND_URL}/messages/conversation/${conversationId}`);
      const data = await res.json();

      if (!res.ok || !Array.isArray(data)) {
        setMessages([]);
        return;
      }

      setMessages(data);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!selectedConversation) return;

    loadMessages(selectedConversation.id);
    const interval = setInterval(
      () => loadMessages(selectedConversation.id),
      3000
    );

    return () => clearInterval(interval);
  }, [selectedConversation]);

  const handleSend = async () => {
    if (!session || !selectedConversation || !newMessage.trim()) return;

    const payload = {
      fromId: session.id,
      conversationId: selectedConversation.id,
      contenu: newMessage.trim(),
    };

    try {
      const res = await fetch(`${BACKEND_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) return;

      setNewMessage("");
      loadMessages(selectedConversation.id);
      loadConversations(session.id);
    } catch {}
  };

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
  };

  const toggleMemberSelection = (id: number) => {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleCreateConversation = async () => {
    console.log("CLICK OK — handleCreateConversation déclenché !");

    if (!session) return;
    if (selectedMembers.length === 0) return;

    setCreatingConversation(true);
    try {
      const participantIds = Array.from(new Set([session.id, ...selectedMembers]));

      const resMed = await fetch(`${BACKEND_URL}/medecin/${session.id}`);
      const medData = await resMed.json();

      const payload = {
        name: groupName.trim() === "" ? undefined : groupName.trim(),
        cabinetId: medData.cabinetId,
        participantIds,
      };

      const res = await fetch(`${BACKEND_URL}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        console.warn("Erreur création:", data);
        return;
      }

      setShowCreateModal(false);
      setGroupName("");
      setSelectedMembers([]);

      await loadConversations(session.id);
      setSelectedConversation(data);
      loadMessages(data.id);
    } catch (e) {
      console.warn("Erreur création conversation :", e);
    } finally {
      setCreatingConversation(false);
    }
  };

  return (
    <div className="flex bg-slate-950 text-white min-h-screen">
      <Sidebar />

      <div className="flex-1 p-8 max-w-7xl mx-auto flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-emerald-400">Messagerie</h1>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2 rounded-xl text-sm"
          >
            Nouvelle conversation / groupe
          </button>
        </div>

        <div className="flex flex-1 gap-6 min-h-[500px]">
          <div className="w-72 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">
              Conversations
            </h2>

            <div className="space-y-2 mt-2">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm ${
                    selectedConversation?.id === conv.id
                      ? "bg-emerald-500 text-black font-semibold"
                      : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  <div className="font-medium truncate">
                    {conv.name || "Conversation"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col p-4">
            {!selectedConversation ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                Sélectionnez une conversation
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {messages.map(msg => {
                    const isMe = msg.fromId === session?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${
                          isMe ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                            isMe
                              ? "bg-emerald-500 text-black"
                              : "bg-slate-800 text-slate-200"
                          }`}
                        >
                          {msg.contenu}
                        </div>
                      </div>
                    );
                  })}

                  <div ref={bottomRef} />
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800 flex gap-2 bg-slate-900 sticky bottom-0">
                  <input
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                    placeholder="Écrire..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <button
                    onClick={handleSend}
                    className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-sm"
                  >
                    Envoyer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-emerald-400 mb-4">
              Nouvelle conversation / groupe
            </h2>

            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm mb-4"
              placeholder="Nom du groupe (optionnel)"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
            />

            <div className="max-h-60 overflow-y-auto mb-4 space-y-2">
              {colleagues.map(m => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl cursor-pointer hover:bg-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(m.id)}
                    onChange={() => toggleMemberSelection(m.id)}
                  />
                  <div>
                    Dr {m.prenom} {m.nom}
                    <div className="text-[11px] text-slate-400">{m.email}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setGroupName("");
                  setSelectedMembers([]);
                }}
                className="px-4 py-2 rounded-xl text-sm bg-slate-800"
              >
                Annuler
              </button>

              <button
                onClick={handleCreateConversation}
                disabled={creatingConversation || selectedMembers.length === 0}
                className="px-4 py-2 rounded-xl text-sm bg-emerald-500 text-black"
              >
                {creatingConversation ? "Création..." : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
