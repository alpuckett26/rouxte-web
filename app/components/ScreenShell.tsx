export default function ScreenShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* subtle background X */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: "url('/ui/rouxte-x-bg.png')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />
      <div className="relative mx-auto w-full max-w-5xl px-6 py-8">
        {children}
      </div>
    </div>
  );
}