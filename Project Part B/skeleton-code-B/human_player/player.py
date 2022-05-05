"""

Cachex Game Agent (HUMAN_PLAYER)
Team: _4399 
Member 1: {email: sunchuangyuh@student.unimelb.edu.au, student id: 1118472}
Member 2: {email: weizhao1@student.unimelb.edu.au, student id: 1118649}

HUMAN PLAYER AGENT, each action require a coordinates input to update the board information

"""

from utility.board import Board

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
        
        # put your code here
        # check steal action if self._turn == 2
        if self._turn == 2:
            if input("| Do you want to steal the tile? [Y/n]: ").lower() in ['yes', 'y']:
                return (STEAL,)
        
        print("| Please enter a coordinate tuple which separate by space, no bracket needed\n| E.g. 0 0, this represents that you will put a hexagon tile on coord (0, 0)")
        coord = input('| Please enter your coordinate: ')
        
        # assign magic numbers, -1 denotes invalid position
        r, q = -1, -1
        
        while (r, q) == (-1, -1):
            try:
                r, q = tuple(int(i) for i in coord.split())
            except ValueError:
                print("| The input must strictly follow the format r q, e.g. 0 0")
                coord = input("| Please try again: ")
            # validate the first move, cannot place at the center if a board has a odd number dimension
            if self._turn == 1 and self.n % 2 == 1:
                while (r, q) == (self.n // 2, self.n // 2):
                    coord = input(f'| Cannot place the first move at the middle of the board {(self.n//2, self.n//2)}!\n| Please try again: ')
                    r, q = tuple(int(i) for i in coord.split())
        
        # validate the user input 
        while self.board.is_occupied(coord=(r, q)):
            coord = input('| Current cell is occupied, please try again: ')
            r, q = tuple(int(i) for i in coord.split())
            
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