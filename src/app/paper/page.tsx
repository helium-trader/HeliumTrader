import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import PaperTrading from "@/components/PaperTrading";

export const metadata = {
  title: "Paper Trading · HeliumTrader",
  description: "Live paper trading for stocks and crypto with strategy automation.",
};

export default async function PaperPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  return <PaperTrading />;
}
