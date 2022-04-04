"""
COMP30024 Artificial Intelligence, Semester 1, 2022
Project Part A: Searching

This script contains the entry point to the program (the code in
`__main__.py` calls `main()`). Your solution starts here!
"""

import sys
import json

# If you want to separate your code into separate files, put them
# inside the `search` directory (like this one and `util.py`) and
# then import from them like this:

from cachex.CachexBoard import CachexBoard


def main():
    """
    Project Part A main code
    """

    try:
        with open(sys.argv[1]) as file:
            data = json.load(file)
        
        # construct CachexBoard object
        board = CachexBoard(data)
        
        # find a path using A* search algorithm
        # if no path found return an empty path
        # create path_dict
        path = board.AStar(start=board.start, 
                        goal=board.goal,
                        heuristic='manhattan', p=None)
        
        # standard out the output
        print(len(path))
        if path:
            for p in path:
                print(p)
        
        
    except IndexError:
            print("usage: python3 -m search path/to/input.json", file=sys.stderr)
    sys.exit(1)
    