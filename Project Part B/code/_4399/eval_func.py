
from dis import dis
from re import T
from utility.board import Board_4399 as Board # import custom board
from numpy import zeros, array, roll, vectorize
import numpy as np
import math
from _4399.A_star import AStar

_ADD = lambda a, b: (a[0] + b[0], a[1] + b[1])

_HEX_STEPS = array([(1, -1), (1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1)], 
    dtype="i,i")

_PLAYER_AXIS = {
    "red": 0, # Red aims to form path in r/0 axis
    "blue": 1 # Blue aims to form path in q/1 axis
}   

RED, BLUE = 'red', 'blue'

# The pattern that needs to be used to measure the board score

_TRIANGLE_PATTERNS = [[n1, n2] 

    for n1, n2 in 
        list(zip(_HEX_STEPS, roll(_HEX_STEPS, 1)))]

_DIAMOND_PATTERNS = [[_ADD(n1, n2), n1, n2] 

    for n1, n2 in 
        list(zip(_HEX_STEPS, roll(_HEX_STEPS, 1))) + 
        list(zip(_HEX_STEPS, roll(_HEX_STEPS, 2)))]

_WEAK_PATTERNS1 = [[n1, _ADD(n1,n1)]
    for n1 in _HEX_STEPS
    ]


_SWAP_PLAYER = { 0: 0, 1: 2, 2: 1 }


# count the current number of tokens for red/blue in the board 
def token_counter(board : Board): 

    result = {}
    for r in range(board.n):
            for q in range(board.n):
                if board.is_occupied(coord=(r, q)):
                    token = board.__getitem__(coord=(r, q))
                    if token not in result:
                        result[token] = 1
                    else: result[token] += 1    

    return result

# count how many tokens are in a stable_triangle pattern
def count_token_in_triangle(board : Board): 
    result = {}
    for r in range(board.n):
            for q in range(board.n):
                if board.is_occupied(coord=(r, q)):
                    token = board.__getitem__(coord=(r, q))
                    if token_in_triangle(board, coord=(r, q)):
                        if token not in result:
                            result[token] = 1
                        else: result[token] += 1   

    return result

# count how many tokens are a diamond pattern that will be captured
def count_token_in_diamond(board : Board): 
    result = {}
    for r in range(board.n):
            for q in range(board.n):
                if board.is_occupied(coord=(r, q)):
                    token = board.__getitem__(coord=(r, q))
                    if token_in_diamond(board, coord=(r, q)):
                        if token not in result:
                            result[token] = 1
                        else: result[token] += 1   

    return result

def token_in_triangle(board : Board, coord):
    opp_type = board._data[coord]

    for pattern in _TRIANGLE_PATTERNS:
        coords = [_ADD(coord, s) for s in pattern]
        
        if all(map(board.inside_bounds, coords)):
                tokens = [board._data[coord] for coord in coords]
                if tokens == [opp_type, opp_type]:

                    return True
    return False

def stable_triangle(tokens_coords, coord): 
    coord1 = tokens_coords[0]
    coord2 = tokens_coords[1]
    dis1 = calculate_Euclid_distance_square(coord1, coord2)
    dis2 = calculate_Euclid_distance_square(coord2, coord)
    dis3 = calculate_Euclid_distance_square(coord, coord1)

    if dis1 == dis2 == dis3:
        return True
    if dis1 + dis2 == dis3:
        return True
    if dis2 + dis3 == dis1:
        return True
    if dis1 + dis3 == dis2:
        return True
    return False

def calculate_Euclid_distance_square(coord1, coord2):

    A_x, A_y  = coord1

    B_x, B_y = coord2

    return ((A_x-B_x)^2 + (A_y-B_y)^2)
         

def token_in_diamond(board : Board, coord):
    opp_type = board._data[coord]
    mid_type = _SWAP_PLAYER[opp_type]

    for pattern in _DIAMOND_PATTERNS:
        coords = [_ADD(coord, s) for s in pattern]
        if all(map(board.inside_bounds, coords)):
            tokens = [board._data[coord] for coord in coords]
            if tokens == [opp_type,mid_type, 0]:

                return True
            if tokens == [opp_type,0, mid_type]:

                return True
    return False

# count how many tokens are a weak pattern that will be attacked
def count_token_in_weakness(board : Board):
    result = {}
    for r in range(board.n):
            for q in range(board.n):
                if board.is_occupied(coord=(r, q)):
                    token = board.__getitem__(coord=(r, q))
                    if token_in_weakness(board, coord=(r, q)):
                        if token not in result:
                            result[token] = 1
                        else: result[token] += 1   

    return result    

def token_in_weakness(board : Board, coord):
    opp_type = board._data[coord]

    for pattern in _WEAK_PATTERNS1:
        coords = [_ADD(coord, s) for s in pattern]
        if all(map(board.inside_bounds, coords)):
                tokens = [board._data[coord] for coord in coords]
                if tokens == [0, opp_type]:
                    return True

    for pattern in _DIAMOND_PATTERNS:
        coords = [_ADD(coord, s) for s in pattern]
        if all(map(board.inside_bounds, coords)):
            tokens = [board._data[coord] for coord in coords]
            if tokens == [opp_type,0, 0]:
                return True
    
    return False

def estimate_steps_to_win(board):
    result = {}

    connected_nodes = []

    for r in range(board.n):
            for q in range(board.n):
                if board._data[(r,q)] != 0:
                    player = board.__getitem__(coord=(r, q))
                    reachable = board.connected_coords((r, q))
                    if reachable not in connected_nodes :
                        connected_nodes.append(reachable)

    # print('connected_nodes', connected_nodes)                    

    # track how many times astar is
    Astar_count = 0

    for reachable in connected_nodes:

        player = board.__getitem__(reachable[0])
        axis_vals = [coord[_PLAYER_AXIS[player]] for coord in reachable]
        player_num = board._data[reachable[0]]

        max_score = max(axis_vals)
        min_score = min(axis_vals)

        # max_token is the token that is closest to the upper bounds, min_token is closest to the lower bounds
        max_token = [ coord  for coord in reachable if coord[_PLAYER_AXIS[player]] == max_score][0]
        min_token = [coord  for coord in reachable if coord[_PLAYER_AXIS[player]] == min_score][0]


        # for blue : 1 player, we find two closest points in connected tokens to upper and lower bound.
        # calculate their shortest steps to the points with same x asix on boundary and add them together as the shortest steps to win.
        if _PLAYER_AXIS[player]:

            Astar_count += 2
            # the shortest steps from steps of the starting to each point in boundary
            sub_steps1 = AStar(Board = board, start= max_token, goal= (max_token[0],board.n - 1), self_player = player_num)
            sub_steps2 = AStar(Board = board, start= min_token, goal= (min_token[0],0), self_player = player_num)
            
        else: 
            Astar_count += 2
            sub_steps1 =  AStar(Board = board, start= max_token, goal= (board.n - 1,max_token[1]), self_player = player_num)
            sub_steps2 = AStar(Board = board, start= min_token, goal= (0,min_token[1]), self_player = player_num) 

        steps_to_win = sub_steps1 + sub_steps2




        if player not in result:
            result[player] = steps_to_win
        if player in result and steps_to_win < result[player]:
            result[player] = steps_to_win 

    # print (result)
    return result

# hex cell scores
def score_matrix(board_size: int):
    """
    This function should return a score matrix where the corner number is big and 
    gradually decrase to the center
    """
    score_matrix = np.zeros((board_size, board_size)) + int((board_size + 3)/2 - 1)

    margin = 1
    score = board_size
    for n in range(1, board_size//2):
        tmp_matrix = np.zeros((board_size-n-margin, board_size-n-margin)) + int((board_size + 3)/2) - n
        score_matrix[n: board_size-n, n: board_size-n] = tmp_matrix
        margin += 1
    if board_size % 2 == 1:
        score_matrix[int(board_size/2)][int(board_size/2)] = 1
    return score_matrix

def count_token_in_diff_hex_location(board: Board):
    s_matrix = score_matrix(board_size = board.n)
    
    result = {
        BLUE: 0,
        RED: 0
    }
    
    for r in range(board.n):
        for q in range(board.n):
            if board[(r, q)] == RED:
                result[RED] += s_matrix[r][q]
            elif board[(r, q)] == BLUE:
                result[BLUE] += s_matrix[r][q]
    
    return result