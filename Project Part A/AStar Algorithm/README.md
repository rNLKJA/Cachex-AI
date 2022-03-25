# A* Path finding 

Dijkstra's Algorithm vs. A* Algorithm: https://stackabuse.com/dijkstras-algorithm-vs-a-algorithm/
Dijkstra vs. A* – Pathfinding: https://www.baeldung.com/cs/dijkstra-vs-a-pathfinding

## Djistra

**Two assumptions**
1. the graph is finite
2. the edge cost are non-negative

The two assumptions ensure that Dijkstra always terminates and returns either the optimal path or a notification that no goal is reachable from the start state.

## A*

**Two assumptions**
1. the edges have strictly positive costs $\boldsymbol{\geq \varepsilon > 0}$
2. the state graph is finite, or a goal state is reachable from the start