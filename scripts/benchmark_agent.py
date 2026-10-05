# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy>=1.26", "scipy>=1.11"]
# ///
"""
Benchmark the ORIGINAL _4399 agent against the ORIGINAL random_play_agent.

Both players are imported unchanged from ``coursework/Project Part B``. Games
are driven through the subject-provided referee ``Game`` class (the same rules
the assessment used), with Python's global ``random`` seeded per game.

The original ``get_valid_actions`` builds a ``set`` of ``("PLACE", r, q)``
tuples, and CPython randomises ``str`` hashes per process, so the order handed
to ``random.shuffle`` would change between runs even with a fixed seed. The
script therefore re-executes itself with ``PYTHONHASHSEED=0``, which makes the
numbers byte-for-byte reproducible under CPython 3.12.

The summary is written to ``web/src/lib/data/agent-benchmark.json`` and shown
on the landing page.

    uv run scripts/benchmark_agent.py
"""

from __future__ import annotations

import json
import logging
import os
import platform
import random
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PART_B = ROOT / "coursework" / "Project Part B" / "code"
SKELETON = ROOT / "coursework" / "Project Part B" / "skeleton-code-B"
OUT = ROOT / "web" / "src" / "lib" / "data" / "agent-benchmark.json"

SIZES = [4, 5, 6, 7]
GAMES_PER_COLOUR = 20


def pin_hash_seed() -> None:
    """Re-run this script under PYTHONHASHSEED=0 so set order is stable."""
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
    sys.path.insert(1, str(SKELETON))  # random_play_agent package

    from _4399.player import Player as MinimaxPlayer  # noqa: E402
    from random_play_agent.player import Player as RandomPlayer  # noqa: E402
    from referee.game import Game  # noqa: E402

    logging.getLogger().setLevel(logging.WARNING)

    results = []
    for n in SIZES:
        for agent_colour in ["red", "blue"]:
            wins = losses = draws = 0
            turns = []
            started = time.perf_counter()
            for g in range(GAMES_PER_COLOUR):
                random.seed(1000 * n + g + (0 if agent_colour == "red" else 500))
                game = Game(n)
                if agent_colour == "red":
                    players = [MinimaxPlayer("red", n), RandomPlayer("blue", n)]
                else:
                    players = [RandomPlayer("red", n), MinimaxPlayer("blue", n)]
                while not game.over():
                    colour = "red" if game.nturns % 2 == 0 else "blue"
                    action = players[game.nturns % 2].action()
                    sanitised = game.update(colour, action)
                    for p in players:
                        p.turn(colour, sanitised)
                turns.append(game.nturns)
                if game.result == f"winner: {agent_colour}":
                    wins += 1
                elif game.result.startswith("winner"):
                    losses += 1
                else:
                    draws += 1
            elapsed = time.perf_counter() - started
            results.append(
                {
                    "n": n,
                    "agentColour": agent_colour,
                    "games": GAMES_PER_COLOUR,
                    "wins": wins,
                    "losses": losses,
                    "draws": draws,
                    "avgTurns": round(sum(turns) / len(turns), 1),
                }
            )
            print(
                f"n={n} agent={agent_colour}: {wins}W {losses}L {draws}D "
                f"({elapsed:.1f}s)"
            )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "meta": {
            "generatedBy": "scripts/benchmark_agent.py",
            "python": platform.python_version(),
            "pythonHashSeed": os.environ.get("PYTHONHASHSEED"),
            "opponent": "random_play_agent (coursework/Project Part B/skeleton-code-B)",
            "agent": "_4399 (coursework/Project Part B/code)",
        },
        "results": results,
    }
    with open(OUT, "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
