#!/bin/bash

SESSION="food"

# Create detached session with first window
tmux new-session -d -s "$SESSION" -n "food-old"

# Create second window
tmux new-window -t "$SESSION" -n "food-new nvim"

# Create third window
tmux new-window -t "$SESSION" -n "food-new bash"

# Open nvim in the second window
tmux send-keys -t "$SESSION":"food-new nvim" "nvim" C-m

# Attach to session
tmux attach-session -t "$SESSION"
