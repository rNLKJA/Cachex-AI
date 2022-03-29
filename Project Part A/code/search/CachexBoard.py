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
    
    def AStar(self, start, goal, heuristic='manhatten', p=None):
        # A* initial state validation 
        if start not in self.NodeDict or goal not in self.NodeDict or \
            start in self.barriers or goal in self.barriers:
            raise InvalidSearchPointError(self)
            
        if start == goal:
            return {'step': 1, 'path': [goal, start]}
        
        # sample queue item structure
        # [f-score, g-score, h-score, currentNode, lastNode]
        priorityQueue = PriorityQueue()
        priorityQueue.put([0, 0, self.NodeDict[start].distance_diff(point1=start, 
                                                                    point2=goal, 
                                                                    heuristic=heuristic, 
                                                                    p=p), start, None])
        
        
   
        expandedNodes = set()
    
        i = 0
        while True:
            # expand the current node
            currentNode = priorityQueue.get()
            print(currentNode)
            time.sleep(1)
            if currentNode[3] == goal:
                print(currentNode[3])
                break

            for nextNode in self.NodeDict[currentNode[3]].next:
                
                # only process the node position has an attribute None
                # None means the space is open
                if self.NodeDict[nextNode].state is None:
                    # if next node never explored
                    if nextNode not in expandedNodes:
                        # put an expandNode target in priorityQueue
                        expandNode = [0, # f-score 0
                                      currentNode[1] + 1, # g-score 1 
                                      self.NodeDict[nextNode].distance_diff(point1=nextNode,
                                                                            point2=goal,
                                                                            heuristic=heuristic,
                                                                            p=p), # h-score 2
                                      nextNode, # position 3 
                                      currentNode[-2]] # last 4
                        # calculate f-score
                        expandNode[0] = expandNode[1] + expandNode[2] 

                        # update priority Queue
                        # update expandedNodes set
                        priorityQueue.put(expandNode)
                        expandedNodes.add(nextNode)
                    elif nextNode in expandedNodes:
                        print(nextNode in expandedNodes)
                        break
                        pq = copy.copy(priorityQueue)
                        while not pq.empty():
                            qitem = pq.get()
                            # if nextNode in priorityQueue and 
                            # nextNode cost is greater than current cost + 1
                            # update the nextNode with a new lowest cost
                            if qitem[3] == nextNode and qitem[1] > currentNode[1] + 1:
                                qitem[1] = currentNode[1] + 1 # update g-score
                                qitem[0] = qitem[1] + qitem[2] # update f-score
                                qitem[4] = currentNode[3]
                                priorityQueue.put(qitem)
                            else:
                                pass
                else:
                    pass
        
            if i == 10:
                break
            else:
                i+=1
                
                
        print('----end----')

        
    