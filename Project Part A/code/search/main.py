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
from constant.constant import *


def main():
    """
    Project Part A main code
    """

    try:
        with open(sys.argv[1]) as file:
            data = json.load(file)
            
        # allow user to define the block type
        # block means the tile that AStar cannot explore
        # e.g. block type could be red or blue
        # if no block type given then return None
        block = None
        if len(sys.argv) > 2:
            if str.title(sys.argv[2]) == RED:
                block = RED
            elif str.title(sys.argv[2]) == BLUE:
                block = BLUE

        # construct CachexBoard object
        board = CachexBoard(data)
        
        # find a path using A* search algorithm
        # if no path found return an empty path
        # create path_dict
        path = board.AStar(start=board.start, 
                        goal=board.goal,
                        heuristic='euclidean', 
                        p=None,
                        block=block)
        
        # standard out the output
        print(len(path))
        if path:
            for p in path:
                print(p)
        
				# display the board
        # board.display(path)
        
        
    except IndexError:
            print("usage: python3 -m search path/to/input.json", file=sys.stderr)
    sys.exit(1)
    