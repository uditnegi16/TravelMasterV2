from pathlib import Path
import shutil
import tempfile

from fastapi import APIRouter, File, HTTPException, UploadFile

from services.whisper_service import transcribe_audio

router = APIRouter(
    prefix="/voice",
    tags=["voice"],
)


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
):
    suffix = Path(audio.filename or "audio.webm").suffix or ".webm"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(audio.file, tmp)
        temp_path = tmp.name

    try:
        transcript = transcribe_audio(temp_path)

        return {
            "transcript": transcript,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    finally:
        Path(temp_path).unlink(missing_ok=True)