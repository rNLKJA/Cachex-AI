# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy>=1.26", "scipy>=1.11"]
# ///
"""
Cross-check the tournament harness against the ORIGINAL Python agents.

The reference tournament on /tournament is played by the parity-tested
TypeScript port, because depth-3 search in the original Python (deepcopy of
the board at every node) is far too slow for 1,200 games. This script replays
the subset that IS feasible in Python, with the same protocol:

  * agents built from the original code with exactly one knob changed:
      - minimax-dynamic: _4399.Player, unchanged;
      - minimax-d2: dynamic_depth_allocation patched to return 2;
      - greedy: dynamic_depth_allocation patched to return 1 and
        action(enforceGamePlayer=False) (no opening book);
      - random: random_play_agent, unchanged;
  * every pairing plays colour-swapped pairs of games, both games of a pair
    seeded identically (Python's global `random`);
  * the subject's referee `Game` validates every action.

The RNG streams differ from the TypeScript run (Python's Mersenne Twister vs
mulberry32), so individual games differ; the comparison is between win
rates, with intervals, on the web page.

Like benchmark_agent.py it re-executes itself with PYTHONHASHSEED=0 so the
set iteration order inside get_valid_actions is reproducible.

    uv run scripts/crosscheck_tournament.py
"""

from __future__ import annotations

import json
import logging
import os
import platform
import random
import sys
import time
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PART_B = ROOT / "coursework" / "Project Part B" / "code"
SKELETON = ROOT / "coursework" / "Project Part B" / "skeleton-code-B"
OUT = ROOT / "web" / "src" / "lib" / "data" / "python-crosscheck.json"

AGENTS = ["minimax-dynamic", "minimax-d2", "greedy", "random"]
SIZES = [4, 5]
ROUNDS = 20  # colour-swapped pairs per pairing per size -> 40 games
SEED = 2022


def pin_hash_seed() -> None:
    if os.environ.get("PYTHONHASHSEED") != "0":
        os.execve(
            sys.executable,
            [sys.executable, *sys.argv],
            {**os.environ, "PYTHONHASHSEED": "0"},
        )


def main() -> None:
    pin_hash_seed()
    os.chdir(PART_B)  # utility/evaluation.py opens ./utility/weights.json
    sys.path.insert(0, str(PART_B))
    sys.path.insert(1, str(SKELETON))

    import _4399.player as player_module  # noqa: E402
    from _4399.player import Player as MinimaxPlayer  # noqa: E402
    from random_play_agent.player import Player as RandomPlayer  # noqa: E402
    from referee.game import Game  # noqa: E402

    logging.getLogger().setLevel(logging.WARNING)
    original_depth = player_module.dynamic_depth_allocation

    class Variant(MinimaxPlayer):
        """The original player with the depth (and opening book) overridden per call."""

        depth: int | None = None
        book: bool = True

        def action(self):  # type: ignore[override]
            if self.depth is not None:
                player_module.dynamic_depth_allocation = lambda board, d=self.depth: d
            try:
                return super().action(enforceGamePlayer=self.book)
            finally:
                player_module.dynamic_depth_allocation = original_depth

    def make(agent: str, colour: str, n: int):
        if agent == "random":
            return RandomPlayer(colour, n)
        p = Variant(colour, n)
        if agent == "minimax-d2":
            p.depth = 2
        elif agent == "greedy":
            p.depth = 1
            p.book = False
        return p

    def play(n: int, red: str, blue: str, seed: int) -> dict:
        random.seed(seed)
        game = Game(n)
        players = [make(red, "red", n), make(blue, "blue", n)]
        while not game.over():
            colour = "red" if game.nturns % 2 == 0 else "blue"
            action = players[game.nturns % 2].action()
            sanitised = game.update(colour, action)
            for p in players:
                p.turn(colour, sanitised)
        winner = None
        if game.result == "winner: red":
            winner = "red"
        elif game.result == "winner: blue":
            winner = "blue"
        return {"n": n, "red": red, "blue": blue, "seed": seed, "winner": winner, "turns": game.nturns}

    games = []
    started = time.perf_counter()
    for n in SIZES:
        for a, b in combinations(AGENTS, 2):
            t0 = time.perf_counter()
            for r in range(ROUNDS):
                seed = SEED * 1_000_003 + n * 10_007 + AGENTS.index(a) * 101 + AGENTS.index(b) * 11 + r
                games.append(play(n, a, b, seed))
                games.append(play(n, b, a, seed))
            print(f"n={n} {a} vs {b}: {time.perf_counter() - t0:.1f}s", flush=True)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "meta": {
            "generatedBy": "scripts/crosscheck_tournament.py",
            "implementation": "original Python (coursework/Project Part B), variants by patching one knob",
            "python": platform.python_version(),
            "pythonHashSeed": os.environ.get("PYTHONHASHSEED"),
            "config": {"agents": AGENTS, "sizes": SIZES, "rounds": ROUNDS, "seed": SEED},
            "seconds": round(time.perf_counter() - started, 1),
        },
        "games": games,
    }
    with open(OUT, "w") as f:
        json.dump(payload, f)
        f.write("\n")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
