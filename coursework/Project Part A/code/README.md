**A\* Search Code is written under `cachex/CachexBoard.py`, call function via `CachexBoard().AStar(start, end)`**

To run the part A* search code,
please run the following commands:

```bash
# please make sure the current working directory is /Project Part A/code/
python -m search sample_input.json

# or you could specify the block type
python -m search sample_input.json [block-type]

# example, different block type
python -m search sample_input.json RED # block type is red
python -m search sample_input.json BLUE # block type is blue
```

The block type means the tile that your opponent placed on the cachex board. e.g. if you play the red tile then any blue tile consider as a block.

**Code Structure**
```
| aster: astar score class
    | ---- AStarScore.py
| cachex: board game related class
    | ---- CachexBoard.py
    | ---- HexNode.py
| constant
    | ---- constant.py
|---- error: custom error
      | ---- error.py
| ---- search # default working directory
      | ---- __main__.py
      | ---- main.py
      | ---- util.py
| report.pdf
```
