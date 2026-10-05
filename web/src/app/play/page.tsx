import type { Metadata } from "next";

import { PlayClient } from "@/components/play/play-client";

export const metadata: Metadata = {
  title: "Play vs AI",
  description: "Play Cachex against a faithful port of team _4399's minimax + alpha-beta agent.",
};

export default function PlayPage() {
  return <PlayClient />;
}
