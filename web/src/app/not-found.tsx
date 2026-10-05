import { Home } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StaticBoard } from "@/components/landing/static-board";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="table-felt">
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
        <div className="w-48">
          <StaticBoard
            label="A 3 by 3 board with no path between the red and blue tiles"
            position={{
              n: 3,
              tiles: [
                { colour: "red", coord: [0, 0] },
                { colour: "blue", coord: [2, 2] },
              ],
            }}
            highlights={[[1, 1]]}
          />
        </div>
        <p className="text-muted-foreground mt-8 font-mono text-sm">404</p>
        <h1 className="mt-2 text-3xl font-semibold">No path to this page</h1>
        <p className="text-muted-foreground mt-3">
          Our A* search came up empty: the page you asked for doesn&apos;t exist or has moved.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">
            <Home /> Back to the arena
          </Link>
        </Button>
      </div>
    </div>
  );
}
