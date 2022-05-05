"""

Cachex Game Agent (MINIMAX+ALPHA_BETA)
Team: _4399 
Member 1: {email: sunchuangyuh@student.unimelb.edu.au, student id: 1118472}
Member 2: {email: weizhao1@student.unimelb.edu.au, student id: 1118649}

Custom utility functions which represent the team game play strategies.

"""

MAGIC_NUMBER: float = 1e-5

def apply_bias(bias: MAGIC_NUMBER) -> float:
    """
    Add random bias after calculate the evaluation values,
    the purpose of adding bias is to avoid a program choose the same action
    if multiple moves has the same evaluation value

    Returns:
        float: _description_
    """
    return random.choice([0, 1]) * bias