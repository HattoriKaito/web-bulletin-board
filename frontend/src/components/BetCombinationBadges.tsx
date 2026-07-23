import { BoatBadge } from "./BoatBadge";

export function BetCombinationBadges({
  combination,
  size = "md",
  emphasized = false,
}: {
  combination: string;
  size?: "sm" | "md" | "lg";
  emphasized?: boolean;
}) {
  const boats = combination.split("-").map(Number);
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        emphasized ? "rounded-lg bg-accent-500/10 px-2 py-1.5 ring-1 ring-accent-500/40" : ""
      }`}
    >
      {boats.map((boat, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <BoatBadge boatNumber={boat} size={size} />
          {i < boats.length - 1 && <span className="text-navy-400">→</span>}
        </span>
      ))}
    </span>
  );
}
