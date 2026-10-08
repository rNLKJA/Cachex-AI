# Original coursework (COMP30024, Semester 1 2022)

This folder is the original submission by team `_4399` (Sunchuangyu "Rin" Huang and
Wei Zhao) for COMP30024 Artificial Intelligence at the University of Melbourne. It was
moved here with `git mv` so its history is preserved. **The code is unchanged** and is
kept for reference; the web app in [`../web`](../web) is a TypeScript port of this code.

The subject specification PDFs are university material, so they are kept privately and not
published here.

| Path | What it is |
| --- | --- |
| `Project Part A/code/` | A\* search solver (`python -m search input.json [Red\|Blue]`), sample inputs and their recorded outputs |
| `Project Part A/notebook/` | Development notebooks and the Manhattan vs Euclidean expansion charts |
| `Project Part A/report/` | Our Part A report (PDF) |
| `Project Part B/code/` | The game-playing agent `_4399` (minimax + alpha-beta), `utility/` (board, evaluation, `weights.json`) and the subject-provided `referee/` |
| `Project Part B/skeleton-code-B/` | The starting skeleton plus `random_play_agent` and `human_player` used for testing |
| `_archive/README.original.md` | The README as it was during the semester |
| `environment.yml`, `requirements.txt`, `pyproject.toml` | The original Python 3.6 / conda environment and Black/isort config |

## Running it today

The code was assessed on Python 3.6 with NumPy and SciPy. It also runs unchanged on
Python 3.12 (Python 3.13 removed `re.T`, which `eval_func.py` imports), which is what
these commands use via [uv](https://docs.astral.sh/uv/):

```bash
# Part A: A* search (prints the path length, then one (r,q) per line)
cd "coursework/Project Part A/code"
uv run --no-project --python 3.12 python -m search sample_input.json
uv run --no-project --python 3.12 python -m search sample_input.json Blue   # only Blue tiles block
```

The Part A entry point always exits with status 1 (it calls `sys.exit(1)` after printing);
that is the original behaviour.

```bash
# Part B: a refereed match on a 5×5 board, our agent (Red) vs the random agent (Blue)
cd "coursework/Project Part B/code"
PYTHONPATH=../skeleton-code-B uv run --no-project --python 3.12 --with numpy --with scipy \
  python -m referee 5 _4399 random_play_agent

# play against the agent yourself
PYTHONPATH=../skeleton-code-B uv run --no-project --python 3.12 --with numpy --with scipy \
  python -m referee 5 human_player _4399
```

Run these from the `code/` directory: `utility/evaluation.py` opens
`./utility/weights.json` relative to the working directory.

## Academic integrity

If you are taking COMP30024, please treat this as reference only and do not copy it.
