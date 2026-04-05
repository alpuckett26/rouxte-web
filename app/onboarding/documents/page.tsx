import ScreenShell from "@/components/ScreenShell";
import DocumentsStep from "@/components/onboarding/DocumentsStep";

export default function OnboardingDocumentsPage() {
  return (
    <ScreenShell>
      <div className="flex flex-col items-center min-h-[85vh] py-12 px-4">
        <img src="/logo.svg" alt="Rouxte" className="h-9 mb-2" />
        <p className="text-xs text-gray-400 mb-8">Step 3 of 3 — HR Documents</p>

        <div className="w-full max-w-2xl mb-3">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">HR Documents</h1>
          <p className="text-sm text-gray-500">
            Please read and sign each document below. All signatures are legally binding electronic signatures.
          </p>
        </div>

        <DocumentsStep />
      </div>
    </ScreenShell>
  );
}
