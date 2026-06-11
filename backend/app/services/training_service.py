import asyncio
import json


class TrainingService:
    def __init__(self, agent, env):
        self.agent = agent
        self.env = env
        self.training_active = False
        self.episode_count = 0
        self.num_cars = 1
        self.step_delay = 0.05

    async def training_loop(self):
        # Reset environment for self.num_cars
        self.env.reset(self.num_cars)
        self.training_active = True

        while self.training_active:
            all_done = True
            step_rewards = []

            # Step each active car
            for i in range(self.num_cars):
                car = self.env.cars[i]
                if not car["done"]:
                    all_done = False
                    state = car["state"]
                    action = self.agent.get_action(state)
                    next_state, reward, done, info = self.env.step_car(i, action)
                    self.agent.update(state, action, reward, next_state, done)
                    step_rewards.append(reward)

            # If all cars finished their episodes, decay epsilon and reset
            if all_done:
                self.agent.decay_epsilon()
                self.env.reset(self.num_cars)
                self.episode_count += 1

            # Get optimal path from start zone (10, 10) to goal
            optimal_path = self.env.get_optimal_path(self.agent, 10.0, 10.0)

            # Average reward of the steps taken by active cars in this tick
            avg_reward = sum(step_rewards) / len(step_rewards) if step_rewards else 0.0

            data = {
                "cars": [
                    {
                        "x": car["x"],
                        "y": car["y"],
                        "success": car["success"],
                        "collision": car["collision"],
                        "done": car["done"],
                        "steps": car["steps"],
                        "distance": car["distance"]
                    }
                    for car in self.env.cars
                ],
                "episode": self.episode_count,
                "epsilon": self.agent.epsilon,
                "reward": avg_reward,
                "optimal_path": optimal_path
            }

            yield f"data: {json.dumps(data)}\n\n"

            # Dynamic sleep based on slider setting
            await asyncio.sleep(self.step_delay)

    def start(self):
        self.training_active = True

    def stop(self):
        self.training_active = False

    def reset(self):
        self.env.reset(self.num_cars)
        self.episode_count = 0

    def set_num_cars(self, count):
        self.num_cars = count
        if self.training_active:
            self.env.reset(self.num_cars)

    def set_speed(self, delay):
        self.step_delay = delay