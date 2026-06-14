export function SNLogo({ className }: { className?: string }) {
  return (
    <img 
      src="/logo.png" 
      alt="SN Gene Lab Logo" 
      className={`object-contain ${className || ""}`}
    />
  );
}

