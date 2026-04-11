import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-blue-500 mb-4">404</p>
        <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
        <p className="text-gray-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-xl transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
