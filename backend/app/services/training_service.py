import asyncio
import json


class TrainingService:
    def __init__(self, agent, env):
        self.agent = agent
        self.env = env
        self.training_active = False
        self.episode_count = 0

    async def training_loop(self):
        state = self.env.reset()
        self.training_active = True

        while self.training_active:

            action = self.agent.get_action(state)

            next_state, reward, done, info = self.env.step(action)

            self.agent.update(state, action, reward, next_state, done)

            if done:
                self.agent.decay_epsilon()
                state = self.env.reset()
                self.episode_count += 1
            else:
                state = next_state

            data = {
                "x": info["x"],
                "y": info["y"],
                "distance": info["distance"],
                "reward": reward,
                "episode": self.episode_count,
                "epsilon": self.agent.epsilon,
                "success": info.get("success", False),
                "collision": info.get("collision", False),
                "steps": self.env.steps
            }

            yield f"data: {json.dumps(data)}\n\n"

            await asyncio.sleep(0.05)

    def start(self):
        self.training_active = True

    def stop(self):
        self.training_active = False

    def reset(self):
        self.env.reset()
        self.episode_count = 0