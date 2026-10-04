import Link from "next/link";
import { CheckCheck, Layers3, CircleCheck, ArrowUpRight } from "lucide-react";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#14233f] p-14 text-white lg:flex">
        <Link
          href="/"
          className="flex items-center gap-3 text-lg font-semibold"
        >
          <div className="rounded-lg bg-primary p-2">
            <CheckCheck className="size-5" />
          </div>
          Test Case Management
        </Link>
        <div className="relative z-10 max-w-md">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">
            A little structure. A lot more confidence.
          </p>
          <h1 className="text-5xl font-semibold leading-[1.12] tracking-tight">
            Great releases
            <br />
            start with
            <br />
            <span className="text-indigo-300">clear results.</span>
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-300">
            Give every test a home. Bring your team’s cases, runs, and results
            together in one workspace.
          </p>
          <div className="mt-10 flex gap-5 text-sm text-slate-300">
            <span className="flex items-center gap-2">
              <Layers3 className="size-4" />
              Organize
            </span>
            <span className="flex items-center gap-2">
              <CircleCheck className="size-4" />
              Execute
            </span>
            <span className="flex items-center gap-2">
              <ArrowUpRight className="size-4" />
              Ship
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400">Built for your QA team.</p>
        <div className="pointer-events-none absolute -right-32 top-28 size-[500px] rounded-full border border-white/5" />
        <div className="pointer-events-none absolute -right-16 top-44 size-[370px] rounded-full border border-white/5" />
      </section>
      <section className="flex items-center justify-center bg-white p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2 text-primary lg:hidden">
            <CheckCheck className="size-7" />
            <span className="font-semibold">Test Case Management</span>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
