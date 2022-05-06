"""

Cachex Game Agent (MINIMAX+ALPHA_BETA)
Team: _4399 
Member 1: {email: sunchuangyuh@student.unimelb.edu.au, student id: 1118472}
Member 2: {email: weizhao1@student.unimelb.edu.au, student id: 1118649}

Minimax + Alpha Beta Pruning algorithm implementation

"""

import math
import random
import numpy as np
import scipy as sp
import json

from typing import Tuple, List, Optional
from copy import copy, deepcopy

from utility.board import Board_4399 as Board
from utility.evaluation import Eval
from utility.utils import log, PLACE, STEAL

from referee.game import Game

MAX_PLAYER, MIN_PLAYER = True, False
RED, BLUE = 'red', 'blue'

_PLAYER_AXIS = {
    "red": 0, # Red aims to form path in r/0 axis
    "blue": 1 # Blue aims to form path in q/1 axis
}

def minimax(board: Board, 
            depth: int,
            alpha: float,
            beta: float, 
            maximizingPlayer: bool):
    # if depth = 0 or node is a terminal node then
    # return the evaluation value of node
    if depth == 0 or game_end(board=board):
        # if there is no winner, return 0
        if board.winner is None:
            return Eval(board=board)
        elif maximizingPlayer and board.winner is RED:
            return math.inf, None
        elif maximizingPlayer and board.winner is BLUE:
            return -math.inf, None
        elif not maximizingPlayer and board.winner is BLUE:
            return -math.inf, None
        elif not maximizingPlayer and board.winner is RED:
            return math.inf, None
    
    
    # find all valid actions
    v_actions = get_valid_actions(board)
    
    # AI try to maximizing its performance    
    if maximizingPlayer:
        # initialise the maximum score to -inf
        max_score, max_action = -math.inf, None

        # for each action
        # copy the current board and recalculate the minimax score
        for action in v_actions:
            temp_board = deepcopy(board)
            temp_board.update(player=BLUE, action=action)

            eval_score, _ = minimax(board=temp_board, 
                                        depth=depth-1,
                                        alpha=alpha,
                                        beta=beta,
                                        maximizingPlayer=False)
            if eval_score >= max_score:
                max_score = eval_score
                max_action = action
                
            if max_score >= alpha:
                alpha = max_score
            if alpha >= beta:
                break
        return max_score, max_action
    else:
        # initialize the minimum score to inf
        min_score, min_action = math.inf, None
        
        # for each action
        # copy the current board and recalculate the minimax score
        for action in v_actions:
            
            temp_board = deepcopy(board)
            temp_board.update(player=RED, action=action)
            eval_score, _ = minimax(board=temp_board,
                                        depth=depth-1,
                                        alpha=alpha,
                                        beta=beta,
                                        maximizingPlayer=True)
            if eval_score <= min_score:
                min_score = eval_score
                min_action = action
            
            if beta <= min_score:
                beta = min_score    
            if alpha >= beta:
                break
        return min_score, min_action

def switch_minimax_player(player):
    return "red" if player == "blue" else "red"

def game_end(board: Board):
    log(len(board.available_hexagons()))
    if len(board.available_hexagons()) == 0:
        return False
    
    if board.last_action == STEAL() or board.last_action is None:
        return False
    
    else:
        _, r, q = board.last_action
        reachable = board.connected_coords((r, q))
        
        
        
        axis_vals = [coord[_PLAYER_AXIS[board.last_player]] for coord in reachable]
        log("----------")
        log(board.last_player)
        log(reachable)
        log(axis_vals)
        log("-----------")
        if min(axis_vals) == 0 and max(axis_vals) == board.n - 1:
            board.winner = board.last_player
            
            return True
    return False

def get_valid_actions(board: Board) -> List[Tuple[int, int]]:
    """
    TODO: add docstring

    Args:
        board (Board): _description_

    Returns:
        List[Tuple[int, int]]: _description_
    """
    valid_actions = set()
    
    possible_hexagons = board.available_hexagons()
            
    # blue player could steal the red hex if the game just start
    for _hex in possible_hexagons:
        valid_actions.add(PLACE(coord=_hex))
    
    # the first move cannot be place at the center of the board
    if board._turn == 1 and board.is_odd():
        valid_actions.remove(PLACE(coord=(board.n//2, board.n//2)))
    
    if board._turn == 2:
        valid_actions.add(STEAL())
    
    valid_actions = list(valid_actions)
    if valid_actions:
        random.shuffle(valid_actions)
    
    return valid_actions