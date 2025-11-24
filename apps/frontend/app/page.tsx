export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-10">Bienvenue 👋</h1>

      <div className="flex flex-col gap-4">
        <a
          href="/patient/login"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 text-center"
        >
          Je suis patient
        </a>

        <a
          href="/medecin/landing"
          className="bg-green-600 text-white px-6 py-3 rounded-lg shadow hover:bg-green-700 text-center"
        >
          Je suis médecin
        </a>
      </div>
    </main>
  );
}
