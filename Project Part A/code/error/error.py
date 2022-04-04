# define the error type
class Error(Exception):
    """
    Cachex AStar Path Solver Error
    """
    pass

class InvalidHeuristicError(Error):
    """
    Heuristic function must be one of the following distance formula:
    ['euclidean', 'manhatten', 'hamming']
    """
    def __init__(self):
        self.message = "Heuristic function must be one of the following distance formula: ['euclidean', 'manhatten', 'minkowski']"
        super().__init__(self.message)
        
class InvalidNodeStateError(Error):
    """
    Node only have four possible state status:
    ['Red', 'Blue', 'Block', None]
    """
    
    def __init__(self):
        self.message = "Node only have three possible state status: ['Red', 'Blue', None]"
        super().__init__(self.message)
        
class InvalidSearchPointError(Error):
    """
    Current AStar Start point or Goal point is a board obstacle which is invalid for path finding.
    """
    
    def __init__(self, board):
        self.message = "".join([
            "Current AStar Start point or Goal point is a board obstacle which is invalid for path finding.\n",
            "Start and Goal points cannot be one of the following coordinates:\n",
            f"{board.barriers}"
        ])
        super().__init__(self.message)
        
class InvalidStartError(Error):
    """
    Current start point out of board existing board dimension.
    """
    
    def __init__(self):
        self.message ="Current start point out of board existing board dimension."

        super().__init__(self.message)
        
class InvalidGoalError(Error):
    """
    Current goal point out of board existing board dimension.
    """
    
    def __init__(self):
        self.message ="Current goal point out of board existing board dimension."

        super().__init__(self.message)