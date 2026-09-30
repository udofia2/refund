import type { Customer } from "../types";

interface Props {
  customers: Customer[];
  value: number | null;
  onChange: (id: number) => void;
  disabled?: boolean;
}

export default function CustomerSelector({
  customers,
  value,
  onChange,
  disabled,
}: Props) {
  return (
    <div>
      <label htmlFor="customer" className="mb-1 block text-sm font-medium text-slate-700">
        Customer
      </label>
      <select
        id="customer"
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
      >
        <option value="" disabled>
          Select a customer…
        </option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.email})
          </option>
        ))}
      </select>
    </div>
  );
}
