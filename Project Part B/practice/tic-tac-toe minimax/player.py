import math
import random

class Player():
    def __init__(self, letter):
        self.letter = letter

    def get_move(self, game):
        pass
    
class HumanPlayer(Player):
    def __init__(self, letter):
        super().__init__(letter)
        
    def get_move(self, game):
        valid_square = False
        val = None
        while not valid_square:
            square = input(self.letter + '\'s turn. Input move (0-9)')
            try:
                val = int(square)
                if val not in game.available_moves():
                    raise ValueError(val)
                valid_square = True
            except ValueError:
                print("Invalid square. Try again.")
        return val
    
class RandomComputerPlayer(Player):
    def __init__(self, letter):
        super().__init__(letter)
        
    def get_move(self, game):
        square = random.choice(game.available_moves())
        return square
    
class SmartComputerPlayer(Player):
    def __init__(self, letter):
        super().__init__(letter)
        
    def get_move(self, game):
        if len(game.available_moves()) == 9:
            square = random.choice(game.available_moves())
        else:
            square = self.minimax(game, self.letter)['position']
        return square
    
    def minimax(self, state, player):
        max_player = self.letter
        other_player = 'O' if player == 'X' else 'X'
        
        # check winning condition on the previous move
        if state.current_winner == other_player:
            return {'position': None, 'score': 1 * (state.num_empty_squares() + 1) if other_player == max_player else -1 * (state.num_empty_squares() + 1)}
        
        elif not state.empty_squares():
            return {'position': None, 'score': 0}
        
        # check if we want to maximise or minimize the score
        if player == max_player:
            best = {'position': None, 'score': -math.inf} # each score should maximize
        else:
            best = {'position': None, 'score': math.inf} # each core should minimize
            
        for possible_move in state.available_moves():
            # make a single move
            state.make_move(possible_move, player)
            # simulate a game after making that move
            sim_score = self.minimax(state, other_player)
            
            # undo move
            state.board[possible_move] = ' '
            state.current_winner = None
            
            # this represents the move optimal next move
            sim_score['position'] = possible_move
            
            if player == max_player:
                if sim_score['score'] > best['score']:
                    best = sim_score
            else:
                if sim_score['score'] < best['score']:
                    best = sim_score
        return best
            