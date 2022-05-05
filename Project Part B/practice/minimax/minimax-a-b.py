"""
PesudoCode of Minimax + Alpha Beta Pruning

Adapt from https://www.youtube.com/watch?v=l-hh51ncgDI
"""

import math
import random

MAGIC_NUMBER: float = 1e-5

def minimax(position, depth, alpha, beta, maximizingPlayer=True):
    if depth == 0 or board.game_end(board, maximizingPlayer) == True:
        return eval(board)
    
    if maximizingPlayer:
        maxEval = math.inf
        for move in v_moves(board):
            eval = minimax(child, depth-1, alpha, beta, !maximizingPlayer)
            maxEval = max(maxEval, eval)
            alpha = max(alpha, eval)
            if beta <= alpha:
                break
        return maxEval * apply_bias()
    else:
        minEval = -math.inf
        for move in v_moves(board):
            eval = minimax(child, depth-1, alpha, beta, maximizingPlayer)
            beta = min(beta, eval)
            if beta <= alpha:
                break
        return minEval * apply_bias()
    

def apply_bias() -> float:
    """
    Add random bias after calculate the evaluation values,
    the purpose of adding bias is to avoid a program choose the same action
    if multiple moves has the same evaluation value

    Returns:
        float: _description_
    """
    return random.choice([0, 1]) * MAGIC_NUMBER