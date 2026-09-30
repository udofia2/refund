import type { RefundRequestResponse } from "../types";

interface Props {
  requests: RefundRequestResponse[];
}

interface Tile {
  label: string;
  value: number;
  border: string;
}

export default function DecisionSummary({ requests }: Props) {
  // tiles reflect all fetched requests, independent of filter
  const tiles: Tile[] = [
    { label: "Total", value: requests.length, border: "border-l-gray-300" },
    {
      label: "Approved",
      value: requests.filter((r) => r.decision === "approved").length,
      border: "border-l-green-500",
    },
    {
      label: "Denied",
      value: requests.filter((r) => r.decision === "denied").length,
      border: "border-l-red-500",
    },
    {
      label: "Escalated",
      value: requests.filter((r) => r.decision === "escalated").length,
      border: "border-l-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-label="Decision summary">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={`rounded-lg border border-l-4 border-gray-200 bg-white p-4 shadow-sm ${tile.border}`}
        >
          <p className="text-2xl font-bold text-slate-900">{tile.value}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            {tile.label}
          </p>
        </div>
      ))}
    </div>
  );
}
