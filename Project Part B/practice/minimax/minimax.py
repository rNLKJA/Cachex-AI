from sys import maxsize

## https://www.youtube.com/watch?v=fInYh90YMJU

class Node(object):
    def __init__(self, i_depth, i_playerNum, i_sticksRemaining, i_value=0):
        self.i_depth = i_depth # tree depth
        self.i_playerNum = i_playerNum
        self.i_sticksRemaining = i_sticksRemaining
        self.i_value = i_value # game value
        self.children = [] # children list
        self.CreateChildren() 
        
    def CreateChildren(self):
        if self.i_depth >= 0:
            for i in range(1, 3):
                v = self.i_sticksRemaining - i
                self.children.append( Node(self.i_depth - 1, -self.i_playerNum, v,selfRealVal(v)))
                
    def RealVal(self, value):
        if value == 0:
            return maxsize * self.i_playerNum
        elif value < 0:
            return maxsize * -self.i_playerNum
        return 0
    
def MiniMax(node, i_depth, i_playerNum):
    if i_depth == 0 or abs(node.i_value) == maxsize:
        return node.i_value
    i_bestValue = maxsize * -i_playerNum
    
    for i in range(len(node.children)):
        child = node.children[i]
        i_val = MiniMax(child, i_depth-1, -i_playerNum)
        
        if (abs(maxisize*i_playerNum-i_val) < abs(maxsize*i_playerNum-i_bestValue))
            i_bestValue = i_val
            
    return i_bestValue

