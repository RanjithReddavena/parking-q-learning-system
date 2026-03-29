import numpy as np
import os
import random


class QLearningAgent:
    def __init__(self, num_states=60, num_actions=6):
        self.num_states = num_states
        self.num_actions = num_actions

        # Q-table
        self.q_table = np.zeros((num_states, num_actions))

        # Hyperparameters (optimized)
        self.learning_rate = 0.1
        self.discount_factor = 0.95

        # Exploration settings
        self.epsilon = 1.0          # start high (better learning)
        self.epsilon_min = 0.01
        self.epsilon_decay = 0.995

        # Action names (for debugging / UI)
        self.action_names = ["STAY", "LEFT", "RIGHT", "UP", "DOWN", "PARK"]

    def get_action(self, state, training=True):
        """
        Epsilon-Greedy Policy
        """
        if training and random.random() < self.epsilon:
            return random.randint(0, self.num_actions - 1)
        else:
            return int(np.argmax(self.q_table[state]))

    def update(self, state, action, reward, next_state, done=False):
        """
        Q-Learning Update (Bellman Equation)
        """
        current_q = self.q_table[state][action]

        if done:
            target = reward
        else:
            max_next_q = np.max(self.q_table[next_state])
            target = reward + self.discount_factor * max_next_q

        new_q = current_q + self.learning_rate * (target - current_q)

        # Clip values (prevents explosion)
        self.q_table[state][action] = np.clip(new_q, -100, 100)

    def decay_epsilon(self):
        """
        Reduce exploration over time
        """
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)

    def save_model(self, filepath="backend/saved_models/q_table.npy"):
        """
        Save Q-table
        """
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        np.save(filepath, self.q_table)

    def load_model(self, filepath="backend/saved_models/q_table.npy"):
        """
        Load Q-table
        """
        if os.path.exists(filepath):
            self.q_table = np.load(filepath)