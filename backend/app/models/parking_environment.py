import random
import math
import numpy as np


class ParkingEnvironment:
    def __init__(self):
        # Environment boundaries
        self.x_min, self.x_max = 0, 60
        self.y_min, self.y_max = 0, 40

        # Parking goal
        self.parking_spot = (45, 30)

        # Obstacles (aligned exactly with script.js)
        self.obstacles = [
            (12, 18),
            (22, 28),
            (32, 15),
            (28, 32),
            (38, 22),
            (18, 35),
            (42, 12),
            (48, 25)
        ]

        # Agent state
        self.car_x = 10.0
        self.car_y = 10.0

        # Episode settings
        self.steps = 0
        self.max_steps = 200
        self.cars = []

    # 🔁 Reset environment
    def reset(self, num_cars=1):
        self.cars = []
        for _ in range(num_cars):
            x = random.uniform(0, 20)
            y = random.uniform(0, 20)
            state = self.get_state(x, y)
            self.cars.append({
                "x": x,
                "y": y,
                "steps": 0,
                "done": False,
                "success": False,
                "collision": False,
                "distance": math.sqrt((x - self.parking_spot[0])**2 + (y - self.parking_spot[1])**2),
                "state": state
            })
        
        # Legacy single car compatibility
        self.car_x = self.cars[0]["x"]
        self.car_y = self.cars[0]["y"]
        self.steps = 0
        return self.cars[0]["state"]

    # 📍 Get discrete state (384 non-overlapping states)
    def get_state(self, x=None, y=None):
        if x is None:
            x = self.car_x
        if y is None:
            y = self.car_y

        # Grid size 60x40. Cell size 2.5x2.5.
        # X has 24 bins (0 to 23). Y has 16 bins (0 to 15).
        x_bin = max(0, min(23, int(x / 2.5)))
        y_bin = max(0, min(15, int(y / 2.5)))

        return x_bin * 16 + y_bin

    # 📏 Distance to parking spot (legacy helper)
    def get_distance(self):
        return math.sqrt(
            (self.car_x - self.parking_spot[0]) ** 2 +
            (self.car_y - self.parking_spot[1]) ** 2
        )

    # 🚗 Step a specific car
    def step_car(self, car_idx, action):
        car = self.cars[car_idx]
        if car["done"]:
            return car["state"], 0.0, True, car

        car["steps"] += 1
        old_x, old_y = car["x"], car["y"]
        old_distance = math.sqrt(
            (old_x - self.parking_spot[0]) ** 2 +
            (old_y - self.parking_spot[1]) ** 2
        )

        move_speed = 2.0

        # Actions
        if action == 1:   # LEFT
            car["x"] -= move_speed
        elif action == 2: # RIGHT
            car["x"] += move_speed
        elif action == 3: # UP
            car["y"] += move_speed
        elif action == 4: # DOWN
            car["y"] -= move_speed
        # action 0 = STAY, action 5 = PARK (handled in reward)

        # Boundary check
        car["x"] = max(self.x_min, min(self.x_max, car["x"]))
        car["y"] = max(self.y_min, min(self.y_max, car["y"]))

        new_distance = math.sqrt(
            (car["x"] - self.parking_spot[0]) ** 2 +
            (car["y"] - self.parking_spot[1]) ** 2
        )
        car["distance"] = new_distance

        # Collision detection
        collision = any(
            math.sqrt((car["x"] - ox)**2 + (car["y"] - oy)**2) < 2.0
            for ox, oy in self.obstacles
        )

        # Success condition
        success = new_distance < 2.0

        # Reward calculation
        reward = self._calculate_reward(old_distance, new_distance, collision, success, action)

        car["success"] = success
        car["collision"] = collision
        car["done"] = success or collision or car["steps"] >= self.max_steps
        car["state"] = self.get_state(car["x"], car["y"])

        # Update legacy single car attributes if this is the main car
        if car_idx == 0:
            self.car_x = car["x"]
            self.car_y = car["y"]
            self.steps = car["steps"]

        return car["state"], reward, car["done"], car

    # 🚗 Legacy Step function for single car compatibility
    def step(self, action):
        if not self.cars:
            self.reset(1)
        next_state, reward, done, car_info = self.step_car(0, action)
        return next_state, reward, done, {
            "x": car_info["x"],
            "y": car_info["y"],
            "distance": car_info["distance"],
            "success": car_info["success"],
            "collision": car_info["collision"]
        }

    # 🧠 Reward function (VERY IMPORTANT)
    def _calculate_reward(self, old_dist, new_dist, collision, success, action):
        if success:
            return 100.0

        if collision:
            return -50.0

        # Base penalty (encourage faster learning)
        reward = -0.2

        # Distance improvement reward
        if new_dist < old_dist:
            reward += (old_dist - new_dist) * 10
        else:
            reward -= (new_dist - old_dist) * 5

        # Bonus when near target
        if new_dist < 5:
            reward += 5

        if new_dist < 3:
            reward += 10

        # Penalize wrong parking
        if action == 5 and new_dist > 3:
            reward -= 20

        return reward

    # 🎯 Find optimal path using current Q-table
    def get_optimal_path(self, agent, start_x=10.0, start_y=10.0):
        path = []
        curr_x = start_x
        curr_y = start_y
        visited = set()

        for _ in range(50):
            path.append((curr_x, curr_y))

            dist = math.sqrt(
                (curr_x - self.parking_spot[0]) ** 2 +
                (curr_y - self.parking_spot[1]) ** 2
            )
            if dist < 2.0:
                break

            state = self.get_state(curr_x, curr_y)
            action = int(np.argmax(agent.q_table[state]))

            # If action is STAY or PARK, stop tracing path
            if action == 0 or action == 5:
                break

            move_speed = 2.0
            next_x, next_y = curr_x, curr_y
            if action == 1:   # LEFT
                next_x -= move_speed
            elif action == 2: # RIGHT
                next_x += move_speed
            elif action == 3: # UP
                next_y += move_speed
            elif action == 4: # DOWN
                next_y -= move_speed

            # Boundary check
            next_x = max(self.x_min, min(self.x_max, next_x))
            next_y = max(self.y_min, min(self.y_max, next_y))

            # Collision check (stop tracing if collides)
            collision = any(
                math.sqrt((next_x - ox)**2 + (next_y - oy)**2) < 2.0
                for ox, oy in self.obstacles
            )
            if collision:
                path.append((next_x, next_y))
                break

            # Loop detection
            pos_bin = (round(next_x, 1), round(next_y, 1))
            if pos_bin in visited:
                break
            visited.add(pos_bin)

            curr_x, curr_y = next_x, next_y

        return path