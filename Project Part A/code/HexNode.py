# define the node class
class HexNode:
    """
    In Cachex game, each Hexagon cell will be represented with a object HexNode,
    where HexNode contains its coordinates, next valid moves, current hexagon cell 
    status.
    input: coords: tuple, move: list, state: string or None
    return: class HexNode
    """
    def __init__(self, coord: tuple, state=None, board=None):
        self.coord = coord
        
        # if board is known, then automatically generate next moves
        if board:
            self.next = self.find_next_moves(board=board, inplace=False)
        else:
            self.next = set()
        
        if state not in ['Red', 'Blue', 'Block', None]:
            raise InvalidNodeStateError
            
        self.state = None # state could be Red, Blue, Block or None
        
    def summary(self):
        """
        Print Node object detailed information.
        """
        print("=====================================================================")
        print(f"Current Node Position: {self.coord}")
        print(f"Current Node State: {self.state}")
        print(f"Next Possible Moves: {self.next}")
        print("=====================================================================")
        
        
    def distance_diff(self, point1: tuple, point2: tuple, heuristic='manhatten', p=None):
        """
        Calculate the distance between current node and the target hexagon cell using
        given heuristic distance function
        
        heuristic must be one of the following distance formula:
        ['euclidean', 'manhatten', 'hamming']
        """
        if heuristic not in ['euclidean', 'manhatten', 'minkowski']:
            raise InvalidHeuristicError
        
        # calculate the distance with the given heuristic distance formula
        if heuristic is 'euclidean':
            return self.minkowski(point1, point2, 2)
        elif heuristic is 'manhatten':
            return self.minkowski(point1, point2, 1)
        elif heuristic is 'minkowski':
            return self.minkowski(point1, point2, p)
    
    def minkowski(self, point1: tuple, point2: tuple, p:int):
        """
        Calculate the distance use minkowski distance formula where
        distance = (sum( abs(point1[0] - point2[0])^p, abs(point1[1] - point2[1])^p ))**(1/p)
        
        where p = 1, minkowski == manhatten distance
        where p = 2, minkowski == euclidean distance
        """
        return pow(pow(abs(point1[0] - point2[0]), p) + pow(abs(point1[1]-point2[1]), p), 1/p)
    
    def find_next_moves(self, board: CachexBoard, inplace=True, verbose=0):
        """
        Through obversation, if turn the Cachex game board from a hexagon 2D layout to a rectangle grid
        layout, a node could move in six directions except a node cannot move along the major axis.
        
        Hence for each point:
        1. check all posible moves
        2. check moves are vaild (in board)
        3. return a result list
        
        board: set # game board coordinates information to check a move is valid or not
        inplace: boolean # could return a set instead changing node attribute value
        """
        
        # define the output result
        possible_moves = set()
        
        # generate possible moves
        for r in range(self.coord[0]-1, self.coord[0]+2):
            for q in range(self.coord[1]-1,  self.coord[1]+2):
                if (r, q) in board:
                    if verbose == 1:
                        print(f"Expanding node: {self.coord}, generated next valid move {(r, q)}")
                    possible_moves.add((r, q))

        # remove the diagonal elements along the major axis
        if verbose == 1:
            print(f"Removing diagonal element {(self.coord[0]-1, self.coord[1]-1)}, {(self.coord[0]+1, self.coord[1]+1)}")
        if (self.coord[0]-1, self.coord[1]-1) in possible_moves:
            possible_moves.remove((self.coord[0]-1, self.coord[1]-1))
        if (self.coord[0]+1, self.coord[1]+1) in possible_moves:
            possible_moves.remove((self.coord[0]+1, self.coord[1]+1))
        if self.coord in possible_moves:
            possible_moves.remove(self.coord)
        
        
        # return result
        if inplace is True:
            self.next = possible_moves
            return
        
        return possible_moves

    
    def state_check(self, isState):
        """
        Return current state check result by compare the target value
        ['Red', 'Blue', 'Block', None]
        return boolean status True or False
            if is None, then the next move is valid
            if not then the next move is invalid
        """
        if isState not in ['Red', 'Blue', 'Block', None]:
            raise InvalidNodeStateError
        
        if self.state == isState:
            return True
        return False
    