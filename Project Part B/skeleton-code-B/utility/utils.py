"""

Cachex Game Agent (MINIMAX+ALPHA_BETA)
Team: _4399 
Member 1: {email: sunchuangyuh@student.unimelb.edu.au, student id: 1118472}
Member 2: {email: weizhao1@student.unimelb.edu.au, student id: 1118649}

Utility functions

"""
from typing import Tuple

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")

def PLACE(coord: (int, int)) -> Tuple[str, int, int]:
    """
    Perform PLACE action

    Args:
        coord (tuple[int, int]): target coordinate

    Returns:
        tuple[str, int, int]: action tuple with the format ("PLACE", r, q)
    """
    r, q = coord
    return ("PLACE", r, q)
    
def STEAL() -> Tuple[str,]:
    """
    Perform STEAL action

    Returns:
        _type_: _description_
    """
    return ('STEAL',)

def log(content) -> None:
    """
    Logging function use to log debug information

    Args:
        content (optional): logging content
    """
    logging.info(content)