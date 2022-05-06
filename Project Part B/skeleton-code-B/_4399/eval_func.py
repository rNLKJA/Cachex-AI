
from utility.board import Board_4399 as Board # import custom board

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
