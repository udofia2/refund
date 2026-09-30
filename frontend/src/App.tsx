import { NavLink, Outlet } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-indigo-50 text-indigo-700"
      : "text-slate-600 hover:bg-gray-100 hover:text-slate-900"
  }`;

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-gray-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 font-semibold tracking-tight text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-sm text-white">
              W
            </span>
            Refund System
          </span>
          <div className="flex items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              Customer
            </NavLink>
            <NavLink to="/admin" className={linkClass}>
              Admin
            </NavLink>
          </div>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
