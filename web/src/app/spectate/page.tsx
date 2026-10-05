import type { Metadata } from "next";

import { SpectateClient } from "@/components/play/spectate-client";

export const metadata: Metadata = {
  title: "AI vs AI",
  description:
    "Watch the minimax agent play itself or the random baseline, with move-by-move explanations.",
};

export default function SpectatePage() {
  return <SpectateClient />;
}
