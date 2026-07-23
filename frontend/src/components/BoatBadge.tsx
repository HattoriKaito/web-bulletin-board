const BOAT_STYLES: Record<number, string> = {
  1: "bg-boat-1 text-navy-950 ring-white/40",
  2: "bg-boat-2 text-ink-100 ring-white/20",
  3: "bg-boat-3 text-white ring-white/20",
  4: "bg-boat-4 text-white ring-white/20",
  5: "bg-boat-5 text-navy-950 ring-white/40",
  6: "bg-boat-6 text-white ring-white/20",
};

const SIZE_CLASSES = {
  sm: "h-5 w-5 text-xs",
  md: "h-7 w-7 text-sm",
  lg: "h-10 w-10 text-lg",
};

export function BoatBadge({
  boatNumber,
  size = "md",
}: {
  boatNumber: number;
  size?: "sm" | "md" | "lg";
}) {
  const style = BOAT_STYLES[boatNumber] ?? "bg-navy-500 text-white ring-white/20";
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-full font-heading font-bold ring-1 ${style} ${SIZE_CLASSES[size]}`}
    >
      {boatNumber}
    </span>
  );
}
