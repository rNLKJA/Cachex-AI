class CachexBoard:
    """
    Cachex Game object functions, a CachexBoard object should initialised with a 
    dictionary which contains board data:
    
    For example:
    BOARD_DATA = {
        'n': 5, # board dimensions
        'board': [['b', 1, 0], ['b', 1, 1], ['b', 3, 2], ['b', 1, 3]], # barriers on the game board
        'start': [4, 2], # node start point
        'goal': [0, 0] # node end point
    }
    
    board = CachexBoard(data=BOARD_DATA)
    
    The final object will contain the following attributes:
    - board.n: number of dimensions
    - board.start: board start point
    - board.goal: board target end point
    - board.data: restore board data
    - board.NodeDict: dictionary object contain each node information
    - board.board: game board layout
    - board.barriers: barriers on the board
    - board.display: print the current board
    """
    def __init__(self, data):
        self.n = data['n']
        
        # check current start and goal is valid
        if data['start'][0]+1 > self.n or data['start'][1]+1 > self.n:
            raise InvalidStartError
        self.start = (data['start'][0], data['start'][1])
        
        if data['goal'][0]+1 > self.n or data['goal'][1]+1 > self.n:
            raise InvalidGoalError
            
        self.goal = (data['goal'][0], data['goal'][1])
        self.data = data
        
        self.construct_board(self.n)
        self.construct_node_dict()
        self.obtain_barrier_coord()
    
    def construct_board(self, n: int, inplace=True):
        """
        The function will return all valid hexagon cell coordinates in a single
        set
        input: n: int # number of the board size
        return: board: set # a set of all possilble moves
        """
        self.board = set()

        # construct cachex board
        for r in range(BOARD_DATA['n']):
            for q in range(BOARD_DATA['n']):
                self.board.add((r, q))
        if not inplace:
            return board
    
    def construct_node_dict(self):
        """
        Construct a dictionary contain
        {
            (r[0], q[0]) : HexNode(), 
            (r[1], q[1]) : HexNode(),
            ...,
            (r[n-1], q[n-1]) : HexNode()
        }
        """
        
        self.NodeDict = dict()
        
        for node in self.board:
            # check node is barrier or not
            self.NodeDict[node] = HexNode(node)
            self.NodeDict[node].find_next_moves(self.board)
    
    def obtain_barrier_coord(self):
        """
        Read board data from the json dictionary.
        if a node has a letter 'b' at the position 0, then it is a barrier
        """
        self.barriers = set()
        
        for node in self.data['board']:
            if node[0] is 'b':
                self.NodeDict[(node[1], node[2])].state = BLOCK
                self.barriers.add((node[1], node[2]))
                
    def display(self, path=None):
        """
        This function will print the current board with the given board information
        """
        # define path dictionary and board dictionary
        path_dict = dict()
        if path is not None:
            for i, p in enumerate(path):
                path_dict[p] = i + 1 
            
        board_dict = {self.start: 'Δ', self.goal: '$'}
        for barrier in self.barriers:
            board_dict[barrier] = '#'
        
        # merge path_dict and board_dict into a single dict
        # note: path_dict only contain the path info include start and goal
        # therefore update path_dict by board_dict where board_dict
        # will rewrite start and goal with their unique symbol
        board_dict = {**path_dict, **board_dict}
       
        if path:
            # define the message
            message = self.message(path)
                          
            # print game board
            print_board(n=self.n, board_dict=board_dict, message=message)
        else:
            print_board(n=self.n, board_dict=board_dict, 
                        message="\n".join(["2022 COMP30024 Artificial Intelligence Cachex Game",
                                        f"                       Group 4399 S Huang, W, Zhao"]))
        
    def message(self, path, sep='\n'):
        """
        Message generator for display function
        """
        message = ["2022 COMP30024 Artificial Intelligence Cachex Game",
                   f"                       Group 4399 S Huang, W, Zhao",
                   "--------------------------------------------------",
                   "Symbol Representation:",
                   "- Δ: AStar Search Start Point",
                   "- $: AStar Search End/Goal Point",
                   "- #: Barriers, node cannot place at here",
                   f"- [1-{len(path)}]: AStar Path Result",
                   "--------------------------------------------------",
                   f"Board Information: Start: {self.start} >>> End: {self.goal}"]
        if path is not None:
            message.append(f"- AStar Path Length: {len(path)}")
            message.append("--------------------------------------------------")
            message.append("AStar Path:")
            
            path_str = ""
            for i, p in enumerate(path):
                if i == 0 or i % 4 != 0:
                    if p == self.start:
                        path_str += 'Start -> '
                    elif p == path[-1]:
                        path_str += "Goal"
                    else:
                        path_str += str(p) + ' -> '
                else:
                    path_str += str(p) + ' ->\n'
            message.append(path_str)
                        
        message.append("--------------------------------------------------")
        return sep.join(message)
    
    def AStar(self, start=None, goal=None, heuristic='manhatten', p=None):
        """
        A* Path finding algorithm implementation
        """
        
        if start is None or goal is None:
            start, goal = self.start, self.goal
            
        
        # A* initial state validation 
        if start not in self.NodeDict or goal not in self.NodeDict or \
            start in self.barriers or goal in self.barriers:
            raise InvalidSearchPointError(self)
        
        # obtain distance calculation function from HexNode object
        distance_diff = self.NodeDict[start].distance_diff
        
        # define the required priorityQueue, g_score, f_score, h_score
        priorityQueue = PriorityQueue()
        g_score = {node: float('inf') for node in board.NodeDict.keys() if board.NodeDict[node].state is None} 
        f_score = {node: float('inf') for node in board.NodeDict.keys() if board.NodeDict[node].state is None}
           
        # store explored nodes
        # explored: {node: last-position}
        # queueTracker: set(explored queue)
        explored, queueTracker, order, path = dict(), {start}, 0, []     

        # initialise the start node (f-score, insert-order, position)
        priorityQueue.put([0, order, start])

        # initialise the start state with cost 0 and 
        # distance difference based on given heuristic function
        g_score[start], f_score[start] = 0, distance_diff(point1=start,
                                                          point2=goal,
                                                          heuristic=heuristic,
                                                          p=p)

        # find the path until priorityQueue is empty
        while not priorityQueue.empty(): 
            # currentNode = [f-score, insert-order, position][2]
            # pop out the first element in the queue and delete item in queueTracker
            currentNode = priorityQueue.get()[2]
            queueTracker.remove(currentNode)
            
            # if currentNode react the target goal, return path
            if currentNode == goal:
                while currentNode in explored:
                    currentNode = explored[currentNode]
                    path.append(currentNode)
                path.insert(0, goal)
                return path[::-1]
            
            
            # check state for next expanding nodes
            for nextNode in self.NodeDict[currentNode].next:
                # ignore node which node state is not empty
                if self.NodeDict[nextNode].state is None:
                    # update path if cost is lower than previous one
                    if g_score[currentNode] + 1 < g_score[nextNode]:
                        g_score[nextNode] = g_score[currentNode] + 1
                        f_score[nextNode] = f_score[currentNode] + distance_diff(point1=nextNode,
                                                                                 point2=goal,
                                                                                 heuristic=heuristic,
                                                                                 p=p)
                        explored[nextNode] = currentNode # update path history
                        # if no update on cost, generate a queue item and put it in priority queue
                        if nextNode not in queueTracker:
                            order += 1
                            priorityQueue.put([f_score[nextNode], order, nextNode])
                            queueTracker.add(nextNode)
                else: 
                    pass
        
        # if path is blocked, return empty list
        return []