To run the part A search code,
please run the following commands:

```bash
# please make sure the current working directory is /Project Part A/code/
python -m search sample_input.json [block-type]

# example, different block type
python -m search sample_input.json RED # block type is red
python -m search sample_input.json BLUE # block type is blue
```

The block type means the tile that your opponent placed on the cachex board. e.g. if you play the red tile then any blue tile consider as a block.
