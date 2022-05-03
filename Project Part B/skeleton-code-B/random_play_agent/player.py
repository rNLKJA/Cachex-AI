"""

Cachex Game Agent (RANDOM_PLAY_AGENT)
Team: _4399 
Member 1: {email: sunchuangyuh@student.unimelb.edu.au, student id: 1118472}
Member 2: {email: weizhao1@student.unimelb.edu.au, student id: 1118649}

A game agent random select a position to play without any heuristic or evaluation function, just randomly select a playable point to place the hexagon tile. This agent is use to compete and train _4399 MINIMAX+ALPHA_BETA agent parameters.

"""

from utility.board import Board
import random

STEAL="STEAL"
PLACE="PLACE"

class Player:
    def __init__(self, player, n):
        """
        Called once at the beginning of a game to initialise this player.
        Set up an internal representation of the game state.

        The parameter player is the string "red" if your player will
        play as Red, or the string "blue" if your player will play
        as Blue.
        """
        # put your code here
        self.colour = player
        self.n = n
        self.board = Board(n)
        self._turn = 1
        self.name = f'Human Player {player}'

    def action(self):
        """
        Called at the beginning of your turn. Based on the current state
        of the game, select an action to play.
        """
        
        # check steal action if self._turn == 2
        if self._turn == 2 and random.choice([STEAL, PLACE]) == STEAL:
            return (STEAL,)    
        
        # check board valid points and random select a point to place the hexagon tile
        valid_moves = list()
        for r in range(self.n):
            for q in range(self.n):
                if not self.board.is_occupied(coord=(r, q)):
                    valid_moves.append((r, q))
                else:
                    for move in self.board._coord_neighbours((r, q)):
                        if not self.board.is_occupied(coord=(r, q)):
                            valid_moves.append((r, q))

        random.shuffle(valid_moves)

        r, q = random.choice(valid_moves)
        return (PLACE, r, q)
    
    def turn(self, player, action):
        """
        Called at the end of each player's turn to inform this player of 
        their chosen action. Update your internal representation of the 
        game state based on this. The parameter action is the chosen 
        action itself. 
        
        Note: At the end of your player's turn, the action parameter is
        the same as what your player returned from the action method
        above. However, the referee has validated it at this point.
        """
        # put your code here
        
        # _turn number is odd means current player has a token color 'red'
        # _turn number is even it has a token 'blue'
        token = 'red' if (self._turn - 1) % 2 == 0 else 'blue'
        
        # update board data
        # if a steal action is performed, update the board
        if action[0] == STEAL:
            self.board.swap()
        else:
            move, r, q = action
            self.board.place(token=token, coord=(r, q))
        
        self._turn += 1
        
    def __repr__(self):
        print(f"{self.name}")