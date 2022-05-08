
from dis import dis
from re import T
from utility.board import Board_4399 as Board # import custom board
from numpy import zeros, array, roll, vectorize
import math

_ADD = lambda a, b: (a[0] + b[0], a[1] + b[1])

_HEX_STEPS = array([(1, -1), (1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1)], 
    dtype="i,i")

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
def token_counter(board : Board, board_size): 

    result = {}
    for r in range(board_size):
            for q in range(board_size):
                if board.is_occupied(coord=(r, q)):
                    token = board.__getitem__(coord=(r, q))
                    if token not in result:
                        result[token] = 1
                    else: result[token] += 1    

    return result

# count how many tokens are in a stable_triangle pattern
def count_token_in_triangle(board : Board, board_size): 
    result = {}
    for r in range(board_size):
            for q in range(board_size):
                if board.is_occupied(coord=(r, q)):
                    token = board.__getitem__(coord=(r, q))
                    if token_in_triangle(board, coord=(r, q)):
                        if token not in result:
                            result[token] = 1
                        else: result[token] += 1   

    return result

# count how many tokens are a diamond pattern that will be captured
def count_token_in_diamond(board : Board, board_size): 
    result = {}
    for r in range(board_size):
            for q in range(board_size):
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
def count_token_in_weakness(board : Board, board_size):
    result = {}
    for r in range(board_size):
            for q in range(board_size):
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