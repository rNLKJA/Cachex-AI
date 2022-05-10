"""

Cachex Game Agent (MINIMAX+ALPHA_BETA)
Team: _4399 
Member 1: {email: sunchuangyuh@student.unimelb.edu.au, student id: 1118472}
Member 2: {email: weizhao1@student.unimelb.edu.au, student id: 1118649}

Custom utility functions which represent the team game play strategies.

"""
import json
from typing import List, Callable, Tuple

import numpy as np
import random

from utility.board import Board
from utility.utils import log
from _4399.eval_func import *
# define constant variables
MAGIC_NUMBER: float = 1e-5
RED, BLUE = 'red', 'blue'


def apply_bias(bias: float=MAGIC_NUMBER) -> float:
    """
    Add random bias after calculate the evaluation values,
    the purpose of adding bias is to avoid a program choose the same action
    if multiple moves has the same evaluation value

    Returns:
        float: random assigned bias
    """
    return random.choice([0, 1]) * bias

# read weights for evaluation functions
with open("./utility/weights.json", "r") as json_file:
    weights = np.array(json.load(json_file)['weights'])
    
def Eval(board: Board, player) -> float:
    """
    Evaluation functions

    Args:
        board (Board): _description_
        maximizingPlayer (bool): _description_

    Returns:
        float: _description_
    """
    efuncs = [n_emptyhex, 
                count_token_in_triangle, 
                token_counter, 
                count_token_in_diamond, 
                count_token_in_weakness,
                estimate_steps_to_win]
    score = 0
    
    opponent = RED if player == 'blue' else BLUE
    
    # calculate the number of empty hexagons
    for func, weight in zip(efuncs, weights):
        result = func(board)
        if type(result) != dict:
            score += result * weight
        else:
            if result == dict():
                score += 0
            if player in result:
                score += result[player] * weight 
            if opponent in result:
                score -= result[opponent] * weight

    return score * apply_bias()

# ---------------------------------------------------
# Custom Evaluation Functions
# 
# All custom evaluation functions are defined deblow,
# more information please check function docstring or
# lookup at project report explanation.
# ---------------------------------------------------
    
def n_emptyhex(board: Board) -> int:
    """
    Return number of empty cells

    Args:
        board (Board): _description_

    Returns:
        int: _description_
    """
    return len(board.available_hexagons())

def winner(board: Board, player: str) -> int:
    """
    DEPRECATED
    
    check current game winner

    Args:
        board (Board): _description_
        player (str): _description_

    Returns:
        int: _description_
    """
    if board.curr_winner == None:
        return 1
    return 1 if player == board.curr_winner else -1

def n_diffhex(board: Board) -> int:
    n_red, n_blue = 0, 0
    for r in range(board.n):
        for q in range(board.n):
            if board[(r, q)] == RED:
                n_red += 1
            elif board[(r, q)] == BLUE:
                n_blue += 1
    return n_red - n_blue