import random
import math


class ParkingEnvironment:
    def __init__(self):
        # Environment boundaries
        self.x_min, self.x_max = 0, 60
        self.y_min, self.y_max = 0, 40

        # Parking goal
        self.parking_spot = (45, 30)

        # Obstacles
        self.obstacles = [
            (15, 25),
            (25, 35),
            (35, 15),
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

    # 🔁 Reset environment
    def reset(self):
        self.car_x = random.uniform(0, 20)
        self.car_y = random.uniform(0, 20)
        self.steps = 0
        return self.get_state()

    # 📍 Get discrete state
    def get_state(self):
        distance = self.get_distance()

        x_bin = min(int(self.car_x / 10), 5)
        y_bin = min(int(self.car_y / 10), 5)
        dist_bin = min(int(distance / 20), 3)

        state = x_bin * 12 + y_bin * 2 + dist_bin
        return min(state, 59)

    # 📏 Distance to parking spot
    def get_distance(self):
        return math.sqrt(
            (self.car_x - self.parking_spot[0]) ** 2 +
            (self.car_y - self.parking_spot[1]) ** 2
        )

    # 🚗 Step function
    def step(self, action):
        self.steps += 1

        old_distance = self.get_distance()
        move_speed = 2.0

        # Actions
        if action == 1:   # LEFT
            self.car_x -= move_speed
        elif action == 2: # RIGHT
            self.car_x += move_speed
        elif action == 3: # UP
            self.car_y += move_speed
        elif action == 4: # DOWN
            self.car_y -= move_speed
        # action 0 = STAY
        # action 5 = PARK (handled in reward)

        # Boundary check
        self.car_x = max(self.x_min, min(self.x_max, self.car_x))
        self.car_y = max(self.y_min, min(self.y_max, self.car_y))

        new_distance = self.get_distance()

        # Collision detection
        collision = any(
            math.sqrt((self.car_x - ox)**2 + (self.car_y - oy)**2) < 2.0
            for ox, oy in self.obstacles
        )

        # Success condition
        success = new_distance < 2.0

        # 🎯 Reward calculation
        reward = self._calculate_reward(old_distance, new_distance, collision, success, action)

        done = success or collision or self.steps >= self.max_steps

        return self.get_state(), reward, done, {
            "x": self.car_x,
            "y": self.car_y,
            "distance": new_distance,
            "success": success,
            "collision": collision
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