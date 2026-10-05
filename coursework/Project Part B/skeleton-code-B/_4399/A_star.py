from queue import PriorityQueue

from utility.board import Board_4399 as Board
from _4399.A_star_score import AStarScore

import math

_SWAP_PLAYER = { 0: 0, 1: 2, 2: 1 }

def AStar(Board = Board , start=None, goal=None, self_player = 0):
        """
        A* Path finding algorithm implementation
        if path not found, return an empty list
        """

        # define the required priorityQueue, g_score, f_score, h_score
        priorityQueue = PriorityQueue()
        AStarScores = dict()
        NodeDict = []
        for r in range(Board.n): 
            for q in range(Board.n):
                NodeDict.append((r, q))
        for node_key in NodeDict:
            
            if Board._data[node_key] == 0 or Board._data[node_key] == self_player:
                AStarScores[node_key] = AStarScore()
        
        # store explored nodes
        # explored: {node: last-position}
        # queueTracker: set(explored queue)
        explored, queueTracker, insert_order, path = dict(), {start}, 0, []     

        # initialise the start node (f-score, insert-insert_order, position)
        priorityQueue.put([0, insert_order, start])

        # initialise the start state with cost 0 and 
        # distance difference based on given heuristic function
        AStarScores[start].g = 0
        AStarScores[start].h = distance_diff(start, goal)
        
        # find the path until priorityQueue is empty
        while not priorityQueue.empty(): 
            # currentNode = [f-score, insert-insert_order, position][2]
            # pop out the first element in the queue and delete item in queueTracker
            currentNode = priorityQueue.get()[2]
            queueTracker.remove(currentNode)

            # if currentNode react the target goal, return path
            if currentNode == goal:

                while currentNode in explored:
                    currentNode = explored[currentNode]
                    path.append(currentNode)
                path.insert(0, goal)
                if len(path) == 0:
                    return Board.n

                steps = 0

                for i in path:
                    if Board._data[i] == 0:
                        steps += 1
                    
                return steps
            
            # check state for next expanding nodes
            for nextNode in Board._coord_neighbours(currentNode):

                
                # if block specified, e.g. Blue tiles are placed now red need to find a shortest path
                # now all blocks are made by blue tiles, red could use existing tiles to construct
                # an optimal path
                
                if Board._data[nextNode] != _SWAP_PLAYER[self_player]:
                    # update path if cost is lower than previous one
                    if AStarScores[currentNode].g + 1 < AStarScores[nextNode].g:
                        AStarScores[nextNode].g = AStarScores[currentNode].g + 1
                        AStarScores[nextNode].h = distance_diff(nextNode, goal)
                        AStarScores[nextNode].update_f()
                        
                        explored[nextNode] = currentNode # update path history
                        # if no update on cost, generate a queue item and put it in priority queue
                        if nextNode not in queueTracker:
                            insert_order += 1
                            priorityQueue.put([AStarScores[nextNode].f, insert_order, nextNode])
                            queueTracker.add(nextNode)
                else: 
                    pass
                    
        
        # if path is blocked, return empty list
        return Board.n

def distance_diff(coord1, coord2):
    return  abs(coord1[0] - coord2[0]) + abs(coord1[1] - coord2[1])