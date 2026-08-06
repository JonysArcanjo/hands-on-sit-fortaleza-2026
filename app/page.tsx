import type { Metadata } from "next";
import { PublicRegistration } from "./components/PublicRegistration";

export const metadata: Metadata = {
  title: "Hands-on SAP Inside Track Fortaleza 2026",
  description: "Escolha seu Hands-on no SAP Inside Track Fortaleza 2026.",
};

export default function Home() {
  return <PublicRegistration />;
}
