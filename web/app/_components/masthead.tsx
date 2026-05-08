import Link from "next/link";
import { getSession } from "@/lib/auth";

const MONTHS_LATIN: Record<number, string> = {
  1: "JAN", 2: "FEB", 3: "MAR", 4: "APR", 5: "MAY", 6: "JUN",
  7: "JUL", 8: "AUG", 9: "SEP", 10: "OCT", 11: "NOV", 12: "DEC",
};

const TODAY = () => {
  const d = new Date();
  // Newspaper-style date: TUESDAY, MAY 8, MMXXVI
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase();
  const month = MONTHS_LATIN[d.getMonth() + 1];
  const day = d.getDate();
  const year = toRoman(d.getFullYear());
  return `${weekday}, ${month} ${day} · ${year}`;
};

function toRoman(num: number): string {
  const map: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let result = "";
  let n = num;
  for (const [v, s] of map) {
    while (n >= v) { result += s; n -= v; }
  }
  return result;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function shortEmail(email: string) {
  if (email.length <= 22) return email;
  const [local, domain] = email.split("@");
  if (!domain) return email.slice(0, 20) + "…";
  return `${local.slice(0, 6)}…@${domain}`;
}

export async function Masthead() {
  const session = await getSession();
  const identity = session?.ethAddress
    ? { kind: "wallet" as const, label: shortAddr(session.ethAddress) }
    : session?.email
      ? { kind: "email" as const, label: shortEmail(session.email) }
      : null;

  return (
    <header className="paper-masthead">
      <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs uppercase tracking-smallcaps text-ink-faded pb-2">
        <span className="shrink-0">Vol. I · No. I</span>
        <span className="hidden sm:inline">{TODAY()}</span>
        <span className="sm:hidden">{MONTHS_LATIN[new Date().getMonth() + 1]} {new Date().getDate()}</span>
        {identity ? (
          <span
            className={`shrink-0 ${identity.kind === "wallet" ? "font-mono normal-case tracking-normal" : "normal-case tracking-normal"}`}
            title={identity.kind === "wallet" ? "Signed in with Ethereum" : "Signed in by email"}
          >
            {identity.label}
          </span>
        ) : (
          <span className="shrink-0">Price · One Wei</span>
        )}
      </div>
      <div className="rule-thin" />
      <h1 className="masthead-title text-center font-display text-5xl sm:text-7xl md:text-[5.5rem] mt-1 leading-[0.95]">
        Bequest
      </h1>
      <p className="text-center font-display italic text-sm sm:text-base mt-1 text-ink-faded">
        &ldquo;An onchain agent for what comes next.&rdquo;
      </p>
      <div className="rule-thick mt-2" />
      <nav className="mt-3 pt-1 flex items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm uppercase tracking-smallcaps">
        <Link href="/">Front Page</Link>
        <span aria-hidden className="text-ink-faded">❦</span>
        <Link href="/new">New Bequest</Link>
        <span aria-hidden className="text-ink-faded">❦</span>
        <Link href="/bequests">Public Notices</Link>
        <span aria-hidden className="text-ink-faded">❦</span>
        <Link href="/about">Editorial</Link>
      </nav>
    </header>
  );
}
