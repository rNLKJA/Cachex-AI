import type { Metadata } from "next";

import { AstarLab } from "@/components/astar/astar-lab";
import { HeuristicStudy } from "@/components/astar/heuristic-study";

export const metadata: Metadata = {
  title: "A* Lab",
  description:
    "Edit a Cachex board, run the original Part A A* search step by step, and compare Manhattan and Euclidean heuristics.",
};

export default function AstarPage() {
  return (
    <div className="table-felt">
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-6 sm:px-6 lg:py-10">
        <AstarLab />
        <HeuristicStudy />
      </div>
    </div>
  );
}
