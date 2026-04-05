export default function ScreenShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="relative mx-auto w-full max-w-5xl px-6 py-8">
        {children}
      </div>
    </div>
  );
}
