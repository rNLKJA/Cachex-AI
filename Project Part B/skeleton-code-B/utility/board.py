from typing import Tuple, Dict, Union, List
from itertools import permutations
import math

from referee.board import Board
from utility.utils import PLACE, STEAL, log

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
        self.last_player = "blue"
        self.winner = None
        self._turn = 1
        self.depth = 1
        self.hex_utilize_rate = 0
    
    def is_odd(self, n: int=None) -> bool:
        """
        Check a board is constructed by odd or even dimension number

        Args:
            n (int): board dimension

        Returns:
            bool: True if board dimension size is a odd number, else False 
        """
        if n is None:
            return self.n % 2 == 1
        return n % 2 == 1
            
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
            if not self.is_occupied(coord = (i, i)):
                moves.add((i, i))
                
        return moves
    
    def update(self, player:str, action: Tuple[str, int, int]) -> None:
        """
        Update current board with senitized action.

        Args:
            player (str): player color
            action (Tuple[str, int, int]): either place a stone or steal a stone
        """
        
        if action == STEAL():
            self.swap()
        else:
            _, r, q = action

            self.place(token=player, coord=(r, q))
        
        self._turn += 1
        self.last_action = action
        self.last_player = player
