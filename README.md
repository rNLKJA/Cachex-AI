<div align="center">

# Cachex AI

A game-playing AI agent for **Cachex**, a hex-based connection game, built for the University of Melbourne **COMP30024 Artificial Intelligence** project (Semester 1, 2022).

[![Python](https://img.shields.io/badge/Python-3.6-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![University of Melbourne](https://img.shields.io/badge/University%20of%20Melbourne-COMP30024-094183?style=for-the-badge)](https://handbook.unimelb.edu.au/2022/subjects/comp30024)
[![Algorithm](https://img.shields.io/badge/Algorithm-Minimax%20%2B%20Alpha--Beta-orange?style=for-the-badge)](#approach)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## Overview

Cachex is a perfect-information, two-player connection game played on an *n* × *n* rhombic, hexagonally tiled board. It is based on the classic strategy game **Hex**. Two players, Red and Blue, take turns placing tiles. Red aims to form an unbroken chain of its tiles connecting the top and bottom edges of the board, while Blue aims to connect the left and right edges. The first player to complete a connection across their two sides wins.

The board also supports a *capture* rule and a one-off *steal* move, so the agent has to reason about more than just shortest paths.

This repository holds two pieces of work that build on each other:

- **Part A — Searching.** A standalone solver that finds the shortest path between two cells on a Cachex board using the **A\* search algorithm**, treating opponent tiles as obstacles. This is the foundation for reasoning about connections.
- **Part B — Competitive game agent.** A full playing agent that chooses its moves using **minimax search with alpha-beta pruning**, guided by a hand-crafted evaluation function. It is designed to beat random, greedy, and shallow adversarial opponents.

## Approach

### Part A — A\* shortest-path search

The agent models the board as a graph of `HexNode` cells, each knowing its valid neighbours (six hex directions, with the two major-axis diagonals removed). A\* then finds the lowest-cost path from a start cell to a goal cell:

- **Cost (g):** one step per tile traversed.
- **Heuristic (h):** a Minkowski distance, configurable as Manhattan (*p* = 1) or Euclidean (*p* = 2), which stays admissible on the hex grid.
- **Blocks:** tiles of the opponent's colour are treated as impassable, so the path the agent finds is the real shortest connection available to it.

### Part B — Minimax with alpha-beta pruning

The competitive agent searches the game tree to choose its move:

- **Minimax + alpha-beta pruning.** Red plays as the maximising player and Blue as the minimising player. Alpha-beta pruning cuts off branches that cannot affect the result, so the agent searches deeper within the same time budget.
- **Dynamic search depth.** Rather than a fixed depth, the agent adjusts how far it looks ahead based on how full the board is, searching deeper as the board empties out and the branching factor falls.
- **Evaluation function.** Non-terminal states are scored by a weighted mix of features defined in `weights.json`: number of empty cells, tiles sitting in strong *triangle* formations, tile counts per colour, and positional value (corners and edges score higher than the centre). Negative features penalise tiles in capture-prone *diamond* shapes and weak formations. An A\* "steps to win" estimate is also implemented as an optional feature.
- **Opening book.** The first couple of moves are hard-coded from analysis of the game: on a size-3 board Blue has a forced win, and on larger boards the agent opens on a strong cell or uses the steal move when the opponent has taken it.

## Repository Structure

```
Cachex-AI/
├── Project Part A/
│   ├── code/
│   │   ├── search/          # entry point (python -m search ...)
│   │   ├── cachex/          # CachexBoard + HexNode (A* lives here)
│   │   ├── astar/           # A* f/g/h score helper
│   │   ├── constant/        # shared constants
│   │   ├── error/           # custom exceptions
│   │   └── sample_input*.json
│   ├── notebook/            # A* development notebooks and benchmark charts
│   ├── report/              # written report (PDF)
│   └── specification/       # project and game spec (PDF)
│
├── Project Part B/
│   ├── code/
│   │   ├── _4399/           # the agent: player, minimax, eval_func, A_star
│   │   ├── utility/         # board, evaluation, weights.json, helpers
│   │   └── referee/         # supplied driver that runs a match
│   └── skeleton-code-B/     # original skeleton, incl. sample opponents
│
├── environment.yml          # conda environment (Python 3.6)
├── requirements.txt         # pip dependencies (numpy, scipy)
└── LICENSE                  # MIT
```

## Getting Started

### Prerequisites

The project was assessed on Python 3.6 with NumPy and SciPy. The simplest way to match that is conda:

```bash
# create and activate the environment
conda create -n COMP30024 --file environment.yml
conda activate COMP30024

# install the pip dependencies
pip install -r requirements.txt
```

### Running Part A (A\* search)

From `Project Part A/code/`, run the search module against an input file. An optional block type (`Red` or `Blue`) marks which colour's tiles act as obstacles:

```bash
cd "Project Part A/code"

# find a path with no blocking colour
python -m search sample_input.json

# find a path treating Blue tiles as blocks
python -m search sample_input.json Blue
```

The program prints the path length followed by each `(r, q)` coordinate along the shortest path.

### Running Part B (a match between agents)

From `Project Part B/code/`, the supplied referee runs a full game between two player packages. The pattern is:

```bash
python -m referee <n> <player1> <player2>
```

where `n` is the board size and each player argument is a Python package containing a `Player` class. The agent in this repository is the `_4399` package. For example, to play the agent (as Red) against the bundled random agent on a size-5 board:

```bash
cd "Project Part B/code"

# this repo's agent vs. a random opponent
python -m referee 5 _4399 skeleton-code-B.random_play_agent

# a human vs. this repo's agent
python -m referee 5 skeleton-code-B.human_player _4399
```

Run `python -m referee -h` for the full list of options, including time and space limits, verbosity, and game logging.

## Notes

- This was a two-person project (team `_4399`): **Sunchuangyu "Rin" Huang** and **Wei Zhao**.
- Most of the logic was first prototyped in the Jupyter notebooks under `Project Part A/notebook/` and then refactored into the `.py` modules, so the notebooks are a useful window into the design process and the A\* benchmarking.
- Australian spelling is used throughout.
- Released under the MIT Licence. If you are a current COMP30024 student, please treat this as reference only and respect academic integrity rather than copying any code.
