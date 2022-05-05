"""

Cachex Game Agent (MINIMAX+ALPHA_BETA)
Team: _4399 
Member 1: {email: sunchuangyuh@student.unimelb.edu.au, student id: 1118472}
Member 2: {email: weizhao1@student.unimelb.edu.au, student id: 1118649}

Minimax + Alpha Beta Pruning algorithm implementation

"""

import math
import random
import numpy
import scipy as sp
from utility.board import Board

# define constant variables
MAGIC_NUMBER: float = 1e-5

def minimax(board: Board, depth: int, alpha: float, beta: float, maximizingPlayer: bool):
    ...