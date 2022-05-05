from typing import Tuple, Dict, Union, List
from itertools import permutations

from referee.board import Board
from utility.utils import PLACE, STEAL

_PLAYER_AXIS = {
    "red": 0, # Red aims to form path in r/0 axis
    "blue": 1 # Blue aims to form path in q/1 axis
}

class Board_4399(Board):
    """
    Inherent Board class from referee Board to add
    custom features to determine the game win lose condition
    and other utility functions such as pattern detection

    Args:
        Board: Board object from referee.board
    """
    def __init__(self, n: int):
        super().__init__(n)
        self.last_action = None
    
    def is_odd(self, n: int) -> bool:
        """
        Check a board is constructed by odd or even dimension number

        Args:
            n (int): board dimension

        Returns:
            bool: True if board dimension size is a odd number, else False 
        """
        return n % 2 == 1
    
    def is_end(self):
        action = self.last_action
        
        if action is STEAL() or action is None:
            return {"winner": None}
        else:
            _, r, q = action
            reachable = self.board.connected_coords((r, q))
            axis_vals = [coord[_PLAYER_AXIS[player]] for coord in reachable]
            if min(axis_vals) == 0 and max(axis_vals) == self.board.n - 1:
                return {"winner": player}
    
    def available_hexagons(self) -> List[Tuple[int, int]]:
        """
        Return available hexagons to place the tiles
        """
        moves = set()
        
        for coord in permutations([i for i in range(self.n)], 2):
            if not self.is_occupied(coord = coord):
                moves.add(coord)
        
        # add diagonal elements to moves list since permutation doesn't include diagonal elements
        for i in range(self.n):
            moves.add((i, i))
                
        return moves