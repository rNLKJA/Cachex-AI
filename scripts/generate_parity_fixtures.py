# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy>=1.26", "scipy>=1.11"]
# ///
"""
Generate parity fixtures for the TypeScript ports in web/src/lib.

This script imports the ORIGINAL coursework code from ``coursework/`` (unchanged)
and records what it outputs for a set of fixed and seeded-random inputs. The
vitest suites in ``web/src/lib/**`` replay the same inputs through the TypeScript
ports and assert identical results.

Run from the repository root:

    uv run scripts/generate_parity_fixtures.py

Determinism notes
-----------------
* Part A (A*) is deterministic, but its neighbour iteration order comes from a
  Python ``set`` of ``(r, q)`` tuples. The fixtures therefore pin CPython 3.12
  behaviour (the TypeScript port simulates the same set iteration order).
* Part B's agent shuffles candidate moves (``random.shuffle``) and multiplies the
  evaluation by a random bias (``apply_bias``). For parity we monkeypatch the
  shuffle to a canonical sort and the bias to 1. Nothing else is changed.
"""

from __future__ import annotations

import json
import math
import os
import platform
import random
import sys
from pathlib import Path
from queue import PriorityQueue

ROOT = Path(__file__).resolve().parents[1]
PART_A = ROOT / "coursework" / "Project Part A" / "code"
PART_B = ROOT / "coursework" / "Project Part B" / "code"
OUT_DIR = ROOT / "web" / "src" / "lib" / "__fixtures__"


def num(x: float) -> float | str:
    """JSON cannot encode infinities; encode them as strings."""
    x = float(x)
    if math.isinf(x):
        return "inf" if x > 0 else "-inf"
    return x


def coord_list(coords) -> list[list[int]]:
    return [[int(r), int(q)] for r, q in coords]


# ---------------------------------------------------------------------------
# Part A: A* search
# ---------------------------------------------------------------------------


def part_a() -> dict:
    sys.path.insert(0, str(PART_A))
    import cachex.CachexBoard as cb_mod  # noqa: E402
    from cachex.CachexBoard import CachexBoard, HexNode  # noqa: E402

    counters: list[dict] = []

    class CountingPQ(PriorityQueue):
        def __init__(self) -> None:
            super().__init__()
            self.stats = {"pops": 0, "pushes": 0}
            counters.append(self.stats)

        def put(self, item, *args, **kwargs):  # type: ignore[override]
            self.stats["pushes"] += 1
            return super().put(item, *args, **kwargs)

        def get(self, *args, **kwargs):  # type: ignore[override]
            self.stats["pops"] += 1
            return super().get(*args, **kwargs)

    cb_mod.PriorityQueue = CountingPQ

    # Neighbour iteration order (Python set order) for every cell, n = 1..14.
    neighbour_orders: dict[str, list] = {}
    for n in range(1, 15):
        board = {(r, q) for r in range(n) for q in range(n)}
        cells = []
        for r in range(n):
            for q in range(n):
                node = HexNode((r, q))
                node.find_next_moves(board)
                cells.append(coord_list(node.next))
        neighbour_orders[str(n)] = cells

    def run_case(name: str, data: dict, heuristic: str, block: str | None) -> dict:
        board = CachexBoard(data)
        path = board.AStar(
            start=board.start, goal=board.goal, heuristic=heuristic, p=None, block=block
        )
        stats = counters[-1]
        return {
            "name": name,
            "input": data,
            "heuristic": heuristic,
            "block": block,
            "path": coord_list(path),
            "pops": stats["pops"],
            "pushes": stats["pushes"],
        }

    cases = []

    for fname in ["sample_input.json", "sample_input2.json"]:
        with open(PART_A / fname) as f:
            data = json.load(f)
        for heuristic in ["manhattan", "euclidean"]:
            for block in [None, "Blue", "Red"]:
                cases.append(run_case(fname, data, heuristic, block))

    # Boards used in "Part A Testing Nodebook.ipynb" (group-defined tests).
    base = [["b", 1, 0], ["b", 1, 1], ["b", 3, 2], ["b", 1, 3]]
    notebook_boards = [
        {"n": 5, "board": base, "start": [4, 2], "goal": [1, 4]},
        {"n": 5, "board": base, "start": [4, 0], "goal": [0, 4]},
        {"n": 5, "board": base + [["b", 0, 3]], "start": [0, 0], "goal": [0, 4]},
        {
            "n": 5,
            "board": base + [["b", 0, 3], ["b", 2, 3]],
            "start": [4, 4],
            "goal": [0, 0],
        },
        {
            "n": 5,
            "board": base + [["b", 0, 3], ["b", 1, 2]],
            "start": [4, 0],
            "goal": [0, 0],
        },
        {"n": 5, "board": base + [["b", 1, 2]], "start": [4, 0], "goal": [0, 0]},
    ]
    for i, data in enumerate(notebook_boards):
        for heuristic in ["manhattan", "euclidean"]:
            cases.append(run_case(f"notebook-{i + 1}", data, heuristic, None))

    # Seeded random boards with both colours and all three block modes.
    rng = random.Random(30024)
    for i in range(80):
        n = rng.randint(2, 14)
        cells = [(r, q) for r in range(n) for q in range(n)]
        density = rng.choice([0.1, 0.25, 0.4, 0.55])
        tiles = [c for c in cells if rng.random() < density]
        empties = [c for c in cells if c not in tiles]
        if len(empties) < 2:
            continue
        start, goal = rng.sample(empties, 2)
        data = {
            "n": n,
            "board": [[rng.choice(["r", "b"]), r, q] for r, q in tiles],
            "start": list(start),
            "goal": list(goal),
        }
        block = rng.choice([None, "Red", "Blue"])
        for heuristic in ["manhattan", "euclidean"]:
            cases.append(run_case(f"random-{i}", data, heuristic, block))

    sys.path.remove(str(PART_A))
    return {"neighbourOrders": neighbour_orders, "cases": cases}


# ---------------------------------------------------------------------------
# Part B: referee rules, evaluation function, minimax agent
# ---------------------------------------------------------------------------


def board_string(data) -> str:
    """Row-major (r, then q) string of token codes 0/1/2."""
    n = data.shape[0]
    return "".join(str(int(data[r][q])) for r in range(n) for q in range(n))


def part_b() -> dict:
    os.chdir(PART_B)  # utility/evaluation.py opens ./utility/weights.json
    sys.path.insert(0, str(PART_B))

    import _4399.minimax as minimax_mod  # noqa: E402
    import utility.evaluation as evaluation_mod  # noqa: E402
    from _4399 import eval_func  # noqa: E402
    from _4399.player import Player  # noqa: E402
    from referee.game import Game  # noqa: E402
    from utility.board import Board_4399  # noqa: E402

    import logging

    logging.getLogger().setLevel(logging.WARNING)  # the referee logs every turn

    # --- deterministic patches (see module docstring) ---
    real_shuffle = random.shuffle
    minimax_mod.random.shuffle = lambda xs: xs.sort()  # canonical move order
    evaluation_mod.apply_bias = lambda bias=None: 1  # no random tie-break bias

    def replay_agent_board(n: int, actions: list) -> Board_4399:
        board = Board_4399(n)
        for i, action in enumerate(actions):
            board.update(player="red" if i % 2 == 0 else "blue", action=tuple(action))
        return board

    # score_matrix for each supported size
    score_matrices = {
        str(n): eval_func.score_matrix(n).tolist() for n in range(2, 13)
    }

    # Seeded random referee games (biased towards adjacent placements so that
    # captures and swaps actually happen).
    rng = random.Random(4399)

    def random_game(n: int, max_moves: int) -> dict:
        game = Game(n)
        actions, steps = [], []
        while not game.over() and len(actions) < max_moves:
            colour = "red" if game.nturns % 2 == 0 else "blue"
            if game.nturns == 1 and rng.random() < 0.35:
                action = ("STEAL",)
            else:
                empties = [
                    (r, q)
                    for r in range(n)
                    for q in range(n)
                    if not game.board.is_occupied((r, q))
                ]
                if game.nturns == 0 and n % 2 == 1:
                    empties.remove((n // 2, n // 2))
                adjacent = [
                    c
                    for c in empties
                    if any(
                        game.board.is_occupied(nb)
                        for nb in game.board._coord_neighbours(c)
                    )
                ]
                pool = adjacent if adjacent and rng.random() < 0.75 else empties
                r, q = rng.choice(pool)
                action = ("PLACE", r, q)
            game.update(colour, action)
            captures = (
                sorted(coord_list(game.last_captures)) if action[0] == "PLACE" else []
            )
            result = game.result
            if result is not None and result.startswith("draw"):
                result = "draw"
            actions.append(list(action))
            steps.append(
                {
                    "captures": captures,
                    "board": board_string(game.board._data),
                    "result": result,
                }
            )
        return {"n": n, "actions": actions, "steps": steps}

    referee_games = []
    for i in range(40):
        n = [3, 4, 5, 6, 7, 8][i % 6]
        referee_games.append(random_game(n, max_moves=n * n * 2))

    # Evaluation features on positions sampled from those games.
    def features(board: Board_4399) -> dict:
        def colour_dict(d):
            return {"red": num(d.get("red", 0)), "blue": num(d.get("blue", 0))}

        return {
            "empty": len(board.available_hexagons()),
            "triangle": colour_dict(eval_func.count_token_in_triangle(board)),
            "tokens": colour_dict(eval_func.token_counter(board)),
            "location": colour_dict(eval_func.count_token_in_diff_hex_location(board)),
            "diamond": colour_dict(eval_func.count_token_in_diamond(board)),
            "weakness": colour_dict(eval_func.count_token_in_weakness(board)),
        }

    # Positions are referenced as (game index, number of actions replayed).
    eval_positions = []
    for gi, game in enumerate(referee_games):
        k = len(game["actions"])
        for cut in sorted({1, 2, k // 3, k // 2, k - 1, k}):
            if cut <= 0:
                continue
            actions = game["actions"][:cut]
            board = replay_agent_board(game["n"], actions)
            eval_positions.append(
                {
                    "game": gi,
                    "cut": cut,
                    "features": features(board),
                    "eval": num(evaluation_mod.Eval(board=board, player="red")),
                }
            )

    # Raw minimax on fixed positions.
    minimax_cases = []
    for gi, game in enumerate(referee_games[:24]):
        k = len(game["actions"])
        for cut in sorted({2, k // 2, max(k - 3, 2)}):
            if cut >= k:
                continue
            actions = game["actions"][:cut]
            board = replay_agent_board(game["n"], actions)
            if minimax_mod.game_end(board):
                continue
            board.winner = None
            empties = len(board.available_hexagons())
            depths = [1, 2] + ([3] if empties <= 14 else [])
            for depth in depths:
                maximizing = cut % 2 == 0  # red to move after an even count
                b = replay_agent_board(game["n"], actions)
                score, action = minimax_mod.minimax(
                    board=b,
                    depth=depth,
                    alpha=-math.inf,
                    beta=math.inf,
                    maximizingPlayer=maximizing,
                )
                minimax_cases.append(
                    {
                        "game": gi,
                        "cut": cut,
                        "depth": depth,
                        "maximizing": maximizing,
                        "score": num(score),
                        "action": list(action) if action is not None else None,
                    }
                )

    # Full Player.action (opening book + instant win + dynamic depth + minimax).
    agent_moves = []

    def agent_move(n: int, actions: list, ref: dict | None = None) -> dict:
        colour = "red" if len(actions) % 2 == 0 else "blue"
        player = Player(colour, n)
        for i, action in enumerate(actions):
            player.turn("red" if i % 2 == 0 else "blue", tuple(action))
        action = player.action()
        position = ref if ref is not None else {"n": n, "actions": actions}
        return {**position, "colour": colour, "action": list(action)}

    for n in [3, 4, 5, 6, 7]:
        agent_moves.append(agent_move(n, []))
        for opening in [(1, 1), (0, 1), (0, 0), (2, 1)]:
            if n % 2 == 1 and opening == (n // 2, n // 2):
                continue  # centre is illegal as the first move on odd boards
            agent_moves.append(agent_move(n, [["PLACE", *opening]]))
    for gi, game in enumerate(referee_games):
        k = len(game["actions"])
        for cut in sorted({3, k // 2, k - 2}):
            if 2 < cut < k:
                actions = game["actions"][:cut]
                if game["steps"][cut - 1]["result"] is None:
                    ref = {"game": gi, "cut": cut}
                    agent_moves.append(agent_move(game["n"], actions, ref))

    # Deterministic self-play: _4399 vs _4399 through the referee.
    agent_games = []
    for n in [3, 4, 5, 6, 7]:
        game = Game(n)
        players = [Player("red", n), Player("blue", n)]
        actions = []
        while not game.over():
            colour = "red" if game.nturns % 2 == 0 else "blue"
            mover = players[game.nturns % 2]
            action = mover.action()
            sanitised = game.update(colour, action)
            for p in players:
                p.turn(colour, sanitised)
            actions.append([str(sanitised[0]), *map(int, sanitised[1:])])
        result = game.result if game.result.startswith("winner") else "draw"
        agent_games.append({"n": n, "actions": actions, "result": result})

    minimax_mod.random.shuffle = real_shuffle
    return {
        "scoreMatrices": score_matrices,
        "refereeGames": referee_games,
        "evalPositions": eval_positions,
        "minimax": minimax_cases,
        "agentMoves": agent_moves,
        "agentGames": agent_games,
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    meta = {
        "generatedBy": "scripts/generate_parity_fixtures.py",
        "python": platform.python_version(),
        "implementation": platform.python_implementation(),
    }
    a = part_a()
    b = part_b()
    for name, payload in [("parity-part-a.json", a), ("parity-part-b.json", b)]:
        path = OUT_DIR / name
        with open(path, "w") as f:
            json.dump({"meta": meta, **payload}, f, separators=(",", ":"))
        print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.1f} KiB)")


if __name__ == "__main__":
    main()
