import Link from "next/link";

const TODAY = () => {
  const d = new Date();
  return d
    .toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
};

export function Masthead() {
  return (
    <header>
      <div className="flex items-center justify-between text-[10px] sm:text-xs uppercase tracking-smallcaps border-b border-ink pb-1">
        <span>Vol. I · No. I</span>
        <span className="hidden sm:inline">{TODAY()}</span>
        <span>5,000 USDC</span>
      </div>
      <h1 className="masthead text-center text-4xl sm:text-6xl md:text-7xl font-black mt-2 leading-none">
        Bequest
      </h1>
      <div className="rule-thick mt-2" />
      <p className="text-center italic text-sm sm:text-base mt-2 text-ink-faded">
        &ldquo;An onchain agent for what comes next.&rdquo;
      </p>
      <nav className="rule mt-3 pt-2 flex items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm uppercase tracking-smallcaps">
        <Link href="/">Front Page</Link>
        <Link href="/new">New Bequest</Link>
        <Link href="/bequests">Public Notices</Link>
        <Link href="/about">Editorial</Link>
      </nav>
    </header>
  );
}
