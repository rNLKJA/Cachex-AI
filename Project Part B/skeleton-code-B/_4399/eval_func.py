
from utility.board import Board_4399 as Board # import custom board
from numpy import zeros, array, roll, vectorize

_ADD = lambda a, b: (a[0] + b[0], a[1] + b[1])

_HEX_STEPS = array([(1, -1), (1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1)], 
    dtype="i,i")

_TRIANGLE_PATTERNS = [[n1, n2] 

    for n1, n2 in 
        list(zip(_HEX_STEPS, roll(_HEX_STEPS, 1))) + 
        list(zip(_HEX_STEPS, roll(_HEX_STEPS, 2)))]

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

def counte_token_in_triangle(board : Board, board_size): 
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

def token_in_triangle(board : Board, coord):
    opp_type = board._data[coord]

    for pattern in _TRIANGLE_PATTERNS:
        coords = [_ADD(coord, s) for s in pattern]
        if all(map(board.inside_bounds, coords)):
            tokens = [board._data[coord] for coord in coords]
            if tokens == [opp_type, opp_type]:

                return True
    return False

