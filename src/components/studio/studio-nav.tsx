import { Link } from "@tanstack/react-router";

const TABS = [
  { to: "/", label: "Studio" },
  { to: "/song", label: "Song" },
] as const;

export function StudioNav() {
  return (
    <nav aria-label="Sections" className="flex gap-1 rounded-md bg-raised p-1">
      {TABS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          activeOptions={{ exact: true }}
          className="inline-flex h-9 items-center rounded-sm px-4 font-mono text-xs tracking-wider text-muted uppercase transition-colors hover:text-fg"
          activeProps={{ className: "bg-accent !text-accent-fg" }}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
