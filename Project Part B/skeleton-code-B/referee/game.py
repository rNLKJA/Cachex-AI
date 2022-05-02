"""
Provide a class to maintain the state of an evolving game, including
validation of actions, detection of draws, and optionally maintaining
a game log.
"""

import sys
import time
import logging
import collections

from itertools import islice

from referee.board import Board
from referee.log import comment

# Game-specific constants for use in other modules:

GAME_NAME = "Cachex"
COLOURS = "red", "blue"
NUM_PLAYERS = 2

# # #
# Generic play function:
#


def play(
    players,
    n=5,
    delay=0,
    print_state=True,
    use_debugboard=False,
    use_colour=False,
    use_unicode=False,
    log_filename=None,
    log_file=None,
    out_function=comment,
):
    """
    Coordinate a game, return a string describing the result.

    Arguments:
    * players        -- A list of Player wrappers supporting init, action
                        and update methods.
    * n              -- Size of the board to play on.
    * delay          -- Time in seconds to wait between turns, or negative
                        to wait for user input.
    * print_state    -- If True, print a picture of the board after each
                        update.
    * use_debugboard -- If True, print additional board debugging info (if
                        print_state is also True).
    * use_colour     -- Use ANSI colour codes for output.
    * use_unicode    -- Use unicode symbols for output.
    * log_filename   -- If not None, log all game actions to this path.
    * out_function   -- Use this function (instead of default 'comment')
                        for all output messages.
    """
    # Configure behaviour of this function depending on parameters:
    if delay > 0:

        def wait():
            time.sleep(delay)

    elif delay < 0:

        def wait():
            comment("(press enter to continue)", end="")
            input()

    else:

        def wait():
            pass

    if print_state:

        def display_state(game):
            comment("displaying game info:")
            comment(
                _RENDER(
                    game,
                    use_debugboard=use_debugboard,
                    use_colour=use_colour,
                    use_unicode=use_unicode,
                ),
                depth=1,
            )

    else:

        def display_state(game):
            pass

    # Set up a new game and initialise the players (constructing the
    # Player classes including running their .__init__() methods).
    game = Game(n, log_filename=log_filename, log_file=log_file)
    comment("initialising players", depth=-1)
    for player, colour in zip(players, COLOURS):
        # NOTE: `player` here is actually a player wrapper. Your program
        # should still implement a method called `__init__()`, not one
        # called `init()`:
        player.init(colour, n)

    # Display the initial state of the game.
    comment("game start!", depth=-1)
    display_state(game)

    # Repeat the following until the game ends
    turn = 1
    while not game.over():
        comment(f"Turn {turn}", depth=-1)
        curr_player = players[(turn - 1) % 2]

        # Ask current player for their next action (calling .action() method)
        action = curr_player.action()

        # Validate player's action and apply it to the game if is allowed.
        sanitised_action = game.update(curr_player.colour, action)

        # Output game state so we can see the update for this turn.
        display_state(game)

        # Notify both players of the action (via .turn() methods)
        for player in players:
            player.turn(curr_player.colour, sanitised_action)

        # Next turn!
        turn += 1
        wait()

    # After that loop, the game has ended (one way or another!)
    result = game.end()
    return result


# # #
# Game rules implementation
#

_PLAYER_AXIS = {
    "red": 0, # Red aims to form path in r/0 axis
    "blue": 1 # Blue aims to form path in q/1 axis
}

_PLAYER_TURN_ORDER = ["red", "blue"] # Red always goes first

# Actions
_ACTION_STEAL = "STEAL"
_ACTION_PLACE = "PLACE"

# Action type validators
_ACTION_TYPES = set([
    (_ACTION_STEAL, ), 
    (_ACTION_PLACE, int, int)
])

# Draw conditions
_MAX_REPEAT_STATES = 7
_MAX_TURNS = 343  


class IllegalActionException(Exception):
    """If this action is illegal based on the current board state."""


class Game:
    """
    Represent the evolving state of a game. Main useful methods
    are __init__, update, over, end, and __str__.
    """

    def __init__(self, n, log_filename=None, log_file=None):
        # Initialise game board
        self.board = Board(n)

        # Also keep track of some other state variables for win/draw
        # detection (number of turns, state history)
        self.nturns = 0
        self.last_captures = []
        self.last_coord = (-1, -1)
        self.history = collections.Counter({self.board.digest(): 1})
        self.result = None
        self.result_cluster = set()

        if log_file is not None:
            self.logger = logging.getLogger(name=log_filename)
            self.logger.addHandler(logging.StreamHandler(log_file))
            self.logger.setLevel(logging.INFO)
            self.handler = None
        elif log_filename is not None:
            self.logger = logging.getLogger(name=log_filename)
            self.handler = logging.FileHandler(log_filename, mode="w")
            self.logger.addHandler(self.handler)
            self.logger.setLevel(logging.INFO)
        else:
            self.logger = logging.getLogger()  # logger with no handlers
            self.handler = None

    def update(self, player, action):
        """
        Submit an action to the game for validation and application.
        If the action is not allowed, raise an InvalidActionException with
        a message describing allowed actions.
        Otherwise, apply the action to the game state.
        """
        # Throw an error if it is not this player's turn
        # Note: this should not occur in practice since the referee handles 
        # turn taking between each player
        if player != self._turn_player():
            raise self._illegal_action(action, f"It is not {player}'s turn!")

        # Ensure action is a tuple - attempt to normalise if not
        if not isinstance(action, tuple) or len(action) == 0:
            action = (action,)

        # Validate action types/forms
        atype, *aargs = action
        action_type = (atype, *(type(arg) for arg in aargs))
        if not isinstance(atype, str) or action_type not in _ACTION_TYPES:
            self._illegal_action(action,
                f"Action does not exist or is not well formed."
            )

        # Validate/apply action based on type
        if atype == _ACTION_STEAL:
            self._validate_steal(action)

            # Apply STEAL action
            self.board.swap()
            self.last_coord = (-1, -1)

        elif atype == _ACTION_PLACE:
            self._validate_place(action)

            # Apply PLACE action
            coord = tuple(aargs)
            self.last_captures = self.board.place(player, coord)
            self.last_coord = coord
        else:
            # This should never happen, but good to be defensive
            raise self._illegal_action(action, f"Action not handled.")

        # End turn and check for game end conditions
        self._turn_detect_end(player, action)
        
        # Log the action (if logging is enabled)
        self.logger.info(
            f"turn {self.nturns}: {player}: {_FORMAT_ACTION(action)}"
        )

        return (atype, *aargs) # action is sanitised at this point

    def _validate_steal(self, action):
        """
        Throw exception if given STEAL action is not allowed
        """
        # STEAL action is only allowed for blue's first move
        if self.nturns != 1:
            self._illegal_action(action,
                "The STEAL action is not currently permitted. This "
                "action may only be played by the blue player on their "
                "*first* move of the game."
            )

    def _validate_place(self, action):
        """
        Throw exception if given PLACE action is not allowed.
        """
        (_, r, q) = action

        # Cannot place outside board bounds
        if not self.board.inside_bounds((r, q)):
            self._illegal_action(action,
                f"The PLACE action coordinate {(r, q)} is outside "
                f"the bounds of the board (n = {self.board.n}). "
            )

        # Cannot place token in center of the board on the first move
        if self.nturns == 0 and r * 2 == q * 2 == self.board.n - 1:
            self._illegal_action(action,
                "The PLACE action is not permitted in the center cell of "
                "the board on the first move of the game. "
            )

        # Cannot place on top of an existing board token
        if self.board.is_occupied((r, q)):
            self._illegal_action(action,
                f"The PLACE action coordinate {(r, q)} is already "
                "occupied. "
            )

    def _illegal_action(self, action, message):
        """
        Helper to handle illegal action (log and throw exception).
        """
        player = self._turn_player()
        self.logger.info(f"error: {player}: illegal action {action!r}")
        self.close()
        raise IllegalActionException(
            f"{message.strip()} See the specification/game rules for details."
        )

    def _turn_player(self):
        """
        Returns player id for current turn.
        """
        return _PLAYER_TURN_ORDER[self.nturns % 2]

    def _turn_detect_end(self, player, action):
        """
        Register that a turn has passed: Update turn counts and detect
        termination conditions.
        """
        # Register turn
        self.nturns += 1
        self.history[self.board.digest()] += 1

        # Game end conditions

        # Condition 1: player forms a continuous path spanning board (win).
        # check reachable coords from just-placed token to detect winning path
        # NOTE: No point checking this while total turns is less than 2n - 1
        if self.nturns >= (self.board.n * 2) - 1:
            _, r, q = action
            reachable = self.board.connected_coords((r, q))
            axis_vals = [coord[_PLAYER_AXIS[player]] for coord in reachable]
            if min(axis_vals) == 0 and max(axis_vals) == self.board.n - 1:
                self.result = "winner: " + player
                self.result_cluster = set(reachable)
                return

        # Condition 2: the same state has occurred too many times (draw)
        if self.history[self.board.digest()] >= _MAX_REPEAT_STATES:
            self.result = f"draw: same game state occurred \
                {_MAX_REPEAT_STATES} times"
            return

        # Condition 3: there have been too many turns in the game (draw)
        if self.nturns >= _MAX_TURNS:
            self.result = "draw: maximum number of turns reached"
            return

        # No end conditions met, game continues
        return

    def over(self):
        """
        True iff the game has terminated.
        """
        return self.result is not None

    def end(self):
        """
        Conclude the game, extracting a string describing result (win or draw)
        This method should always be called to conclude a game so that this
        class has a chance to close the logfile, too.
        If the game is not over this is a no-op.
        """
        if self.result:
            self.logger.info(self.result)
            self.close()
        return self.result
    
    def close(self):
        if self.handler is not None:
            self.handler.close()
            self.logger.removeHandler(self.handler)
            self.handler = None


# # #
# Game display
#

_RED_SYM = 'r'
_BLUE_SYM = 'b'
_CAPTURE_SYM = 'X'
_POINT_TO = lambda s: f">{s}<"
_STAR_TO = lambda s: f"*{s}*"

def _RENDER(
    game,
    message="",
    use_debugboard=False,
    use_colour=False,
    use_unicode=False,
):
    """
    Create and return a representation of board for printing.
    """
    board = game.board

    # Should we use 😂 ?
    _symbol_map = {}
    if use_unicode:
        _symbol_map = {
            _RED_SYM: " 🍓  ",
            _BLUE_SYM: " 🍇  ",
            _POINT_TO(_RED_SYM): "▶🍓◀ ",
            _POINT_TO(_BLUE_SYM): "▶🍇◀ ",
            _STAR_TO(_RED_SYM): "⯌🍓⯌ ",
            _STAR_TO(_BLUE_SYM): "⯌🍇⯌ ",
            _CAPTURE_SYM: " 🐸  "
        }

    stitch_pattern = ".-'-._"
    edge_col_len = 3
    v_divider = "|"
    h_spacing = len(stitch_pattern)
    output = message + "\n"

    if use_debugboard:
        output += "DEBUG: Captured coords: "
        output += str(game.last_captures)
        output += "\n\n"

    # Helper functions to apply ansi formatting (selectively)
    def _apply_ansi(str, bold=True, color=None):
        bold_code = "\033[1m" if bold else ""
        color_code = ""
        if color == "r":
            color_code = "\033[31m"
        if color == "b":
            color_code = "\033[34m"
        return f"{bold_code}{color_code}{str}\033[0m"

    apply_ansi = _apply_ansi if use_colour else lambda str, **_: str

    # Generator to repeat pattern string (char by char) infinitely
    def repeat(pattern):
        while True:
            for c in pattern:
                yield c

    # Generate stitching pattern given some offset and length
    def stitching(offset, length):
        return "".join(islice(repeat(stitch_pattern), offset, length))

    # Loop through each row i from top (print ordering)
    # Note that n - i - 1 is equivalent to r in axial coordinates
    for i in range(board.n):
        x_padding = (board.n - i - 1) * int(h_spacing / 2)
        stitch_length = (board.n * h_spacing) - 1 + \
            (int(h_spacing / 2) + 1 if i > 0 else 0)
        mid_stitching = stitching(0, stitch_length)

        # Handle coloured borders for ansi outputs
        # Fairly ugly code, but there is no "simple" solution
        if i == 0:
            mid_stitching = apply_ansi(mid_stitching, color="r")
        else:
            mid_stitching = \
                apply_ansi(mid_stitching[:edge_col_len], color="b") + \
                mid_stitching[edge_col_len:-edge_col_len] + \
                apply_ansi(mid_stitching[-edge_col_len:], color="b")

        output += " " * (x_padding + 1) + mid_stitching + "\n"
        output += " " * x_padding + apply_ansi(v_divider, color="b")

        # Loop through each column j from left to right
        # Note that j is equivalent to q in axial coordinates
        for j in range(board.n):
            coord = (board.n - i - 1, j)
            color = value = "" if board[coord] == None else \
                (_RED_SYM if board[coord] == "red" else _BLUE_SYM)
            if use_debugboard:
                if coord == game.last_coord:
                    value = _POINT_TO(value)
                elif coord in game.result_cluster:
                    value = _STAR_TO(value)
                if coord in game.last_captures:
                    value = _CAPTURE_SYM
            contents = _symbol_map.get(value) or value.center(h_spacing - 1)
            contents = apply_ansi(contents, color=color)
            output += contents + (v_divider if j < board.n - 1 else "")
        output += apply_ansi(v_divider, color="b")
        output += "\n"
    
    # Final/lower stitching (note use of offset here)
    stitch_length = (board.n * h_spacing) + int(h_spacing / 2)
    lower_stitching = stitching(int(h_spacing / 2) - 1, stitch_length)
    output += apply_ansi(lower_stitching, color="r") + "\n"

    return output
        

def _FORMAT_ACTION(action):
    atype, *aargs = action
    if isinstance(action, str):
        atype = action
    if atype == "STEAL":
        return "STEAL first move"
    else:
        (r, q) = aargs
        return f"PLACE token in cell {(r, q)}"
