"""

Cachex Game Agent (HUMAN_PLAYER)
Team: _4399 
Member 1: {email: sunchuangyuh@student.unimelb.edu.au, student id: 1118472}
Member 2: {email: weizhao1@student.unimelb.edu.au, student id: 1118649}

HUMAN PLAYER AGENT, each action require a coordinates input to update the board information

"""

from referee.board import Board

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
        self.name = 'Human Player'

    def action(self):
        """
        Called at the beginning of your turn. Based on the current state
        of the game, select an action to play.
        """
        # put your code here
        print("| Please enter a coordinate tuple which seperate by space, no bracket needed\n| E.g. 0 0, this represents that you will put a hexagon tile on coord (0, 0)")
        coord = input('| Please enter your coordinate: ')
        r, q = tuple(int(i) for i in coord.split())
        
        # TODO: validate the user input 
        
        return ("PLACE", r, q)
    
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
        
        print('---------------------')
        # TODO: update board data
        
        move, r, q = action
        self.board.place(self.colour, (r, q))
        self._turn += 1