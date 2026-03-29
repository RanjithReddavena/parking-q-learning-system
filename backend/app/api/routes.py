from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models.q_learning_agent import QLearningAgent
from app.models.parking_environment import ParkingEnvironment
from app.services.training_service import TrainingService

router = APIRouter()

# Initialize
agent = QLearningAgent()
env = ParkingEnvironment()
trainer = TrainingService(agent, env)


@router.get("/")
def home():
    return {"message": "API working"}


@router.post("/start-training")
def start_training():
    trainer.start()
    return {"status": "training started"}


@router.post("/stop-training")
def stop_training():
    trainer.stop()
    return {"status": "training stopped"}


@router.post("/reset")
def reset():
    trainer.reset()
    return {"status": "reset done"}


@router.post("/save-model")
def save_model():
    agent.save_model()
    return {"status": "model saved"}


@router.get("/get-qtable")
def get_qtable():
    return {
        "q_table": agent.q_table.tolist(),
        "shape": agent.q_table.shape,
        "episode": trainer.episode_count,
        "epsilon": agent.epsilon
    }


# 🔥 Streaming endpoint
@router.get("/stream")
async def stream():
    return StreamingResponse(
        trainer.training_loop(),
        media_type="text/event-stream"
    )