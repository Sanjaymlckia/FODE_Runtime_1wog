from pathlib import Path

import cv2


REFERENCES = {
    "ops-original": Path(r"C:\Users\sanja\Videos\Screen Recordings\OPS Recording 2026-07-12 195436.mp4"),
    "sol-current": Path(r"C:\Users\sanja\Videos\Screen Recordings\SOL Screen Recording 2026-07-12 221238.mp4"),
}

OUTPUT = Path(__file__).resolve().parent / "evidence" / "references"
OUTPUT.mkdir(parents=True, exist_ok=True)

for key, source in REFERENCES.items():
    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open {source}")
    frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    for index, ratio in enumerate((0.08, 0.38, 0.72), start=1):
        capture.set(cv2.CAP_PROP_POS_FRAMES, max(0, min(frames - 1, int(frames * ratio))))
        ok, frame = capture.read()
        if not ok:
            raise RuntimeError(f"Could not read {key} frame {index}")
        cv2.imwrite(str(OUTPUT / f"{key}-{index}.png"), frame)
    capture.release()
    duration = frames / fps if fps else 0
    print(f"{key}: {width}x{height}, {duration:.1f}s, {frames} frames")

print(f"PASS reference frames: {OUTPUT}")
