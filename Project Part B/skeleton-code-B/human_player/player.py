"""

Cachex Game Agent (HUMAN_PLAYER)
Team: _4399 
Member 1: {email: sunchuangyuh@student.unimelb.edu.au, student id: 1118472}
Member 2: {email: weizhao1@student.unimelb.edu.au, student id: 1118649}

HUMAN PLAYER AGENT, each action require a coordinates input to update the board information

"""

from utility.board import Board

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
        # put your code here
        print("| Please enter a coordinate tuple which separate by space, no bracket needed\n| E.g. 0 0, this represents that you will put a hexagon tile on coord (0, 0)")
        coord = input('| Please enter your coordinate: ')
        r, q = tuple(int(i) for i in coord.split())
        
        # TODO: validate the first move, cannot place at the center if a board has a odd number dimension
        
        # TODO: validate the user input 
        while self.board.is_occupied(coord=(r, q)):
            print(self.board[(r, q)])
            coord = input('| Current cell is occupied, please try again: ')
            r, q = tuple(int(i) for i in coord.split())
            
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
        
        # TODO: update board data
        
        move, r, q = action
        
        # _turn number is odd means current player has a token color 'red'
        # _turn number is even it has a token 'blue'
        token = 'red' if (self._turn - 1) % 2 == 0 else 'blue'
            
        print(self.board.place(token=token, coord=(r, q)))
        self.board.place(token=token, coord=(r, q))
        
        self._turn += 1
        
    def __repr__(self):
        print(f"{self.name}")