# 2022 S1 COMP30024 Artificial Intelligence Project
> Cachex is a two-player connection game of strategy anticipation and sabotage. Establish efficient territorial control by constructioin of geometric patterns whiule sabotaging the best laid plans of your opponent'ss territorial instructions and unite patterns to victory!

> Cachex is a perfect-information two-player game played on an n × n rhombic, hexagonally tiled board, based on the strategy game Hex.

## Project Part A: Searching

This part of project will solve a simple search-based problem on _Cachex_ game board by implmeneting a heuristic, A\* path finding algorithm.

The aims for Project Part A is build a agent that:

- refresh Pyhon programming skills
- explore algorithms learned in lecture
- familiar with Cachex

```bash
# to run the AStar search script, please enter the code directory and run the following command
# python -m search input.json [block-type]
# [block-type could be None, Red, or Blue], if None then skip this field
# e.g. where search block-type is None
python -m search sample_input.json 

# e.g. where search block-type is Blue
python -m search sample_input.json Blue
```

- familiar with Cache

## Project Part B: Competitive Game Agent

The team need to design and implement a program to play the game of Cachex. That is, given information about the evolving state of the game.
- Opponents who choose randomly from their set of allowed actions each turn.
- "Greedy" opponents who select the most immediately promising action available each turn, without considering your player's responses (for various definitions of 'most promising').
- Opponents using the adversarial search techniques discussed in class and a simpple evaluation function to look an increasing number of turns ahead.

```bash
# to run the game agent, please enter the following command
python -m referee <n> <player1> <player2>

# e.g. human player vs. random selection agent with a board size n=5
python -m referee 5 human_player random_play_agent

# for more information about referee please check the helper function via -h or --help
```

## _Cache_ Game

Cachex is a perfect-information two-player game played on an n×nrhombic, hexagonally tiled board, based on the strategy game Hex. Two players (named Red and Blue) compete, with the goal to form a connection between the opposing sides of the board corresponding to their respective color. More information please check **[AI_chachex_spec.pdf]("https://github.com/chuangyu-hscy/legendary-succotash/blob/master/COMP30024%20Project/COMP30024%20Project%20Part%20A/specification/AI_cachex_spec.pdf")**.

## Project Dependencies

Due to science faculty assessment marking constraints that the tests will run with **python 3.6** on the student **Unix** machines.
Hence authors using conda to build the working environment.

```bash
# please check the conda_env.txt file and requirements.txt file does exist
# create conda environment
conda create -n COMP30024 --file environment.yml

# after set up conda environment, please install package dependencies
pip install -r requirements.txt
```

**TO RUN IMPLMENTED CODE**

Most of algorithm and code logic and structure are implemented via a jupyter notebook. Then convert into various `.py` files.

To test the completed code, please run the line below.

```
# activate conda environment first
conda activate COMP30024

# run the main program
python3 main.py
```

## Project Progress Tracking
<!-- ### Part A Progress Tracking

- [x] Find a group partner [@EcZww](https://github.com/EcZww)
- [x] Understand A\* heuristic algorithm
- [x] Path finding strategy design
- [x] Code tasks
- [x] Report writing
- [x] Complete states check
- [x] Final Code & Report Submission -->

### Part B Progress Tracking

## Project Report
### Part A Breif Report

https://www.overleaf.com/read/rjtbjbrbgkqb

### Project Part B Brief Report

https://www.overleaf.com/read/bvyssryrvdpz

## Others

<p>More notes about the project is available on <a href='https://www.notion.so/huangsunchuangyu/Project-Part-A-97ad43542a9a42d39433a14d834102f8'><img height=20 src="https://img.shields.io/badge/Notion-000000?style=for-the-badge&logo=notion&logoColor=white" alt='notion'></a></p>

Project license is available at [HERE](https://github.com/chuangyu-hscy/legendary-succotash/blob/master/COMP30024%20Project/LICENSE). Please notice this repository won't be pulic until Unimelb 2022 Semester 1 COMP30024 course ends. For academic intergrity and your honesty, please notice that all code fragments should not directly copy paste to your code. In other cases all codes under folder `COMP30024 Project` are followed by MIT LICENSE.
