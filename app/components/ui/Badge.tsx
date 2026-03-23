type Color =
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple"
  | "orange";

interface BadgeProps {
  label: string;
  color?: Color;
  dot?: boolean;
}

const colorClasses: Record<Color, string> = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
  orange: "bg-orange-100 text-orange-700",
};

const dotColors: Record<Color, string> = {
  gray: "bg-gray-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
};

export default function Badge({ label, color = "gray", dot = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses[color]}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotColors[color]}`} />
      )}
      {label}
    </span>
  );
}
