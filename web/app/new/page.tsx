import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { NewBequestForm } from "./new-form";

export default async function NewBequestPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <article className="max-w-2xl mx-auto">
      <p className="smallcaps text-xs text-ink-faded text-center">Notice of intention</p>
      <h2 className="font-display text-3xl sm:text-4xl mt-2 text-center">A new bequest</h2>
      <hr className="my-6" />

      <p className="text-justify dropcap mb-6">
        Below, declare your intention. The agent will mint a fresh wallet for this
        bequest alone. No other funds are at risk. You will be asked to send the
        bequest amount, plus a small allowance for gas, to the deposit address shown
        on the next page.
      </p>

      <NewBequestForm />
    </article>
  );
}
