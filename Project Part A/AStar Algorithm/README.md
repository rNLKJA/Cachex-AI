# A* Path finding 

Under this file are materials help to understand the concept of A* algorithm. 

All codes in this folder are linked with this isse: https://github.com/chuangyu-hscy/refactored-octo-potato/issues/1

and coding must work on this pull request: https://github.com/chuangyu-hscy/refactored-octo-potato/pull/6

## Djistra

**Two assumptions**
1. the graph is finite
2. the edge cost are non-negative

The two assumptions ensure that Dijkstra always terminates and returns either the optimal path or a notification that no goal is reachable from the start state.

## A*

**Two assumptions**
1. the edges have strictly positive costs $\boldsymbol{\geq \varepsilon > 0}$
2. the state graph is finite, or a goal state is reachable from the start

## Reference

- Dijkstra's Algorithm vs. A* Algorithm: https://stackabuse.com/dijkstras-algorithm-vs-a-algorithm/

- Dijkstra vs. A* – Pathfinding: https://www.baeldung.com/cs/dijkstra-vs-a-pathfinding
