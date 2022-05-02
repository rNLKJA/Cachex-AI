class AStarScore:
    """
    Store f-score, g-score, h-score for informed A Star Search Algorithm
    """
    def __init__(self):
        self.g = float('inf')
        self.h = float('inf')
        self.f = float('inf')
        
    def update_f(self):
        """
        Update f-score based on known g-score and h-score
        """
        self.f = self.g + self.h
        
    def __repr__(self):
        return f"f(n): {self.f}, g(n): {self.g}, h(n): {self.h}\n"