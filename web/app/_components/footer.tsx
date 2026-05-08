import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 pt-6 rule text-xs uppercase tracking-smallcaps text-ink-faded flex flex-wrap items-center justify-between gap-2">
      <span>Printed on the Base chain.</span>
      <span className="flex gap-3">
        <Link href="/about">About</Link>
        <a href="https://github.com/zeriontech/zerion-ai" target="_blank" rel="noreferrer">
          Built on Zerion CLI
        </a>
      </span>
    </footer>
  );
}
