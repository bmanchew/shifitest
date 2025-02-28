interface LogoProps {
  className?: string;
  size?: number;
  variant?: "default" | "white";
}

export function Logo({ 
  className = "", 
  size = 40, 
  variant = "default" 
}: LogoProps) {
  const fillColor = variant === "white" ? "#FFFFFF" : "#4F7CFC";
  const gradientColor1 = variant === "white" ? "#FFFFFF" : "#6B93FF";
  const gradientColor2 = variant === "white" ? "#FFFFFF" : "#2158E0";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient
          id={`logo-gradient-${variant}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor={gradientColor1} />
          <stop offset="100%" stopColor={gradientColor2} />
        </linearGradient>
      </defs>
      <circle 
        cx="256" 
        cy="256" 
        r="230" 
        fill={`url(#logo-gradient-${variant})`} 
      />
      <path
        d="M256 120C311.228 120 356 164.772 356 220L156 220C156 164.772 200.772 120 256 120Z"
        fill="white"
      />
      <path
        d="M256 392C200.772 392 156 347.228 156 292L356 292C356 347.228 311.228 392 256 392Z"
        fill="white"
      />
    </svg>
  );
}