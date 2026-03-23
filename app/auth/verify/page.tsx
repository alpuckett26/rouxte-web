import ScreenShell from "@/components/ScreenShell";

export default function VerifyPage() {
  return (
    <ScreenShell>
      <div className="flex flex-col items-center justify-center min-h-[85vh] text-center">
        <img src="/brand/rouxte-logo.png" alt="Rouxte" className="h-10 mx-auto mb-8" />

        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-6">
          <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Check your email</h1>
        <p className="text-gray-500 max-w-xs">
          We sent a verification link to your email address. Click it to activate your account.
        </p>

        <p className="mt-8 text-xs text-gray-400">
          Didn&apos;t receive it? Check your spam folder or{" "}
          <a href="/auth" className="text-blue-600 hover:underline">try again</a>.
        </p>
      </div>
    </ScreenShell>
  );
}
