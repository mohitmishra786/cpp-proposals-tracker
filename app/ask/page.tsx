import { Metadata } from "next";
import { Suspense } from "react";
import AskInterface from "@/components/AskInterface";

export const metadata: Metadata = {
  title: "Ask AI",
  description:
    "Ask any question about C++ proposals and get AI-synthesized answers grounded in mailing list discussions.",
};

export default function AskPage() {
  return (
    <Suspense fallback={<div className="p-8 text-surface-400">Loading...</div>}>
      <AskInterface />
    </Suspense>
  );
}
