import ScreenShell from "@/components/ScreenShell";

export default function Home() {
  return (
    <ScreenShell>
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
        <img
          src="/brand/rouxte-logo.png"
          alt="Rouxte"
          className="h-16 mb-8"
        />

        <h1 className="text-4xl font-semibold mb-4">
          Welcome to Rouxte
        </h1>

        <p className="text-gray-600 max-w-md mb-8">
          Field sales intelligence built for fiber teams.
        </p>

        <a
          href="/auth"
          className="rounded-xl bg-blue-600 text-white px-6 py-3 text-lg shadow-md hover:bg-blue-700 transition"
        >
          Get Started
        </a>
      </div>
    </ScreenShell>
  );
}