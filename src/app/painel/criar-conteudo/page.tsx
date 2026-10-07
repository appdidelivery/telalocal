import type { Metadata } from "next";
import TemplateStudioClient from "@/components/panel/TemplateStudioClient";

export const metadata: Metadata = {
  title: "Criar conteúdo",
  robots: { index: false, follow: false },
};

export default function CreateContentPage() {
  return <TemplateStudioClient />;
}
