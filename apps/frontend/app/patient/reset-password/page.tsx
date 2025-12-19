'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [motDePasse, setMotDePasse] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');

  /* -------------------------------------------------
     VALIDATION MOT DE PASSE
  ------------------------------------------------- */
  const isPasswordStrong = (pwd: string) =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{10,}$/.test(pwd);

  /* -------------------------------------------------
     SUBMIT
  ------------------------------------------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!token) {
      setMessage('Lien invalide ou expiré.');
      return;
    }

    if (!isPasswordStrong(motDePasse)) {
      setMessage(
        'Le mot de passe doit contenir au moins 10 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.'
      );
      return;
    }

    if (motDePasse !== confirm) {
      setMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      const res = await fetch('http://localhost:3001/patient/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, motDePasse }),
      });

      const data = await res.json();

      if (res.ok) {
        alert('Mot de passe réinitialisé avec succès ✅');
        router.push('/patient/login');
      } else {
        setMessage(data.message || 'Erreur lors de la réinitialisation.');
      }
    } catch (err) {
      setMessage('Erreur serveur.');
    }
  };

  /* -------------------------------------------------
     RENDER
  ------------------------------------------------- */
  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-96">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          Réinitialiser le mot de passe
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="border rounded-md p-2"
            required
          />

          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="border rounded-md p-2"
            required
          />

          {message && (
            <p className="text-red-600 text-sm text-center">{message}</p>
          )}

          <button
            type="submit"
            className="bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
          >
            Réinitialiser
          </button>
        </form>
      </div>
    </main>
  );
}
