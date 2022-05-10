"""

Cachex Game Agent (MINIMAX+ALPHA_BETA)
Team: _4399 
Member 1: {email: sunchuangyuh@student.unimelb.edu.au, student id: 1118472}
Member 2: {email: weizhao1@student.unimelb.edu.au, student id: 1118649}

The game agent using minimax + alpha-beta pruning algorithm to perform the intelligent game agent

For implementation details & ideas behind the agent please check overleaf report:
https://www.overleaf.com/read/bvyssryrvdpz [VIEW ONLY]

"""
from typing import Tuple
import math
from copy import deepcopy
import numpy as np

from referee.game import Game

from utility.board import Board_4399 as Board # import custom board
from utility.utils import PLACE, STEAL, log

from _4399.minimax import minimax, get_valid_actions, game_end


# Define static variables
_PLAYER_AXIS = {
    "red": 0, # Red aims to form path in r/0 axis
    "blue": 1 # Blue aims to form path in q/1 axis
}
RED, BLUE = 'red', 'blue'

MAX_PLAYER, MIN_PLAYER = True, False


class Player:
    def __init__(self, player: str, n: int):
        """
        Called once at the beginning of a game to initialise this player.
        Set up an internal representation of the game state.

        The parameter player is the string "red" if your player will
        play as Red, or the string "blue" if your player will play
        as Blue.
        
        Args:
            player (str): either "red" or "blue"
            n (int): cachex game board size
        """
        self.colour: str = player
        self.n: int = n
        self.board = Board(n) 
        self.name = "4399 Strategy Cachex Game Agent"
        

    def action(self):
        """
        Called at the beginning of your turn. Based on the current state
        of the game, select an action to play.
        """
        # enforce game play on the first two move
        if self.board._turn <= 2:
            return enforced_gamestart_play(n=self.board.n, player=self.colour, board=self.board)
        
        # minimax will always try to maximizing the game value
        # if only one step left to win the game, then place that action without minimax calculation
        # if more steps are needed, then execute the minimax iteration
        v_actions = get_valid_actions(self.board)
        for action in v_actions: 
            temp_board = deepcopy(self.board)
            temp_board.update(player=self.colour, action=action)
            if game_end(board=temp_board):
                return action 
        
        # RED is always maximizing the game result, BLUE is always minimizing the game result
        # dynamic_depth_allocation determine the recursion depth
        depth = dynamic_depth_allocation(self.board)
        log(depth)
        if self.colour == RED:
            _, action = minimax(board=self.board,
                            depth=depth,
                            alpha=-math.inf,
                            beta=math.inf, 
                            maximizingPlayer=isMaximizingPlayer(self.colour))
        else:
            _, action = minimax(board=self.board,
                            depth=depth,
                            alpha=-math.inf,
                            beta=math.inf, 
                            maximizingPlayer=isMaximizingPlayer(self.colour))   
        return action
    
    def turn(self, player, action):
        """
        Called at the end of each player's turn to inform this player of 
        their chosen action. Update your internal representation of the 
        game state based on this. The parameter action is the chosen 
        action itself. 
        
        Note: At the end of your player's turn, the action parameter is
        the same as what your player returned from the action method
        above. However, the referee has validated it at this point.
        """
        self.board.update(player=player, action=action)
        

def isMaximizingPlayer(player: str) -> bool:
    """
    TA function use to determine either a player is maximizing the game result or vice versa
    
    * red player always try to maximizing the game result
    * blue player always try to minimizing the game result

    Args:
        player (str): player colour string
    Returns:
        bool: return the target player is a maximizing player or not
    """
    return MAX_PLAYER if player == RED else MIN_PLAYER

def enforced_gamestart_play(n: int, player: str, board: Board) -> Tuple[str, int, int]:
    """
    When board size is 3, blue player has a absolute win condition that there
    is no way to change the game result, hence what the team trying to do is 
    select the best game state and aiming for tie game as a red player. If agent
    is blue, then we want to win the game for sure.
    
    When board size is greater than 4, 
        if the agent play red, then we always place the first step on (1, 1)
        if the agent play blue:
            if (1, 1) is occupied, perform steal action
            else place a tile on (1, 1)
    Based on the team empirical experience, the blue player will always win when the board size,
    when the board size increase, the game uncertainty increase but in theory blue always has advantages.

    Args:
        n (int): board size
        player (str): player turn
        board (Board): game board class

    Returns:
        tuple[str, int, int]: return an action
    """
    if n == 3:
        if player is BLUE and board.is_occupied((0, 1)):
            return STEAL()
        elif player is RED:
            return PLACE(coord = (1, 0))
        else:
            return PLACE(coord = (0, 1))
    else:
        if player is BLUE and board.is_occupied((1, 1)):
            return STEAL()
        else:
            return PLACE(coord = (1, 1))

def dynamic_depth_allocation(board: Board) -> int:
    """
    Return a depth limit number for minimax to terminate the tree search

    Args:
        board (Board): Cachex game board object

    Returns:
        int: depth
    """
    if board.n <= 5:
        return 8
    
    target_rates = [
        0.50, # depth = 1
        0.40,
        0.30,
        0.20,
        0.15,
        0.10,
        0.05,
        0.025
    ]

    empty_rate = len(board.available_hexagons()) / (board.n ** 2)
    
    # index represent the depth
    for index, r in enumerate(target_rates):
        if empty_rate >= r:
            return index + 1
    return 4