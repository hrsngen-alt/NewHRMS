export function SNLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Red/Pink Fan Background */}
      <path 
        d="M50 15C65 15 85 30 85 50C85 70 65 85 50 85C35 85 15 70 15 50C15 30 35 15 50 15Z" 
        fill="#E15B64" 
      />
      {/* White Outline/Shadow for SN */}
      <text 
        x="50%" 
        y="58%" 
        dominantBaseline="middle" 
        textAnchor="middle" 
        fontSize="38" 
        fontWeight="900" 
        fontFamily="sans-serif" 
        fill="white"
        stroke="white"
        strokeWidth="6"
        strokeLinejoin="round"
      >SN</text>
      {/* Blue SN Letters */}
      <text 
        x="50%" 
        y="58%" 
        dominantBaseline="middle" 
        textAnchor="middle" 
        fontSize="38" 
        fontWeight="900" 
        fontFamily="sans-serif" 
        fill="#0EA5E9"
      >SN</text>
    </svg>
  );
}
