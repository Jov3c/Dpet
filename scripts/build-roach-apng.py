from pathlib import Path

from PIL import Image, ImageDraw

try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None
    np = None


ROOT = Path(__file__).resolve().parents[1]
CANVAS = (100, 150)
MAX_SUBJECT = (96, 144)
ANIMATIONS = {
    "idle": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "idle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "idle-100x150.apng",
        "frame_duration": 230,
        "inbetweens": 1,
    },
    "alert": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "idle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "alert-100x150.apng",
        "frame_duration": 90,
        "inbetweens": 1,
    },
    "probe": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "idle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "probe-100x150.apng",
        "frame_duration": 70,
        "inbetweens": 1,
    },
    "sleep": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "idle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "sleep-100x150.apng",
        "frame_duration": 520,
        "inbetweens": 1,
    },
    "groom": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "struggle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "groom-100x150.apng",
        "frame_duration": 145,
        "inbetweens": 1,
    },
    "walk": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "walk",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "walk-100x150.apng",
        "frame_duration": 72,
        "inbetweens": 1,
    },
    "sprint": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "walk",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "sprint-100x150.apng",
        "frame_duration": 47,
        "inbetweens": 1,
    },
    "flee": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "walk",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "flee-100x150.apng",
        "frame_duration": 35,
        "inbetweens": 1,
    },
    "turn": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "walk",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "turn-100x150.apng",
        "frame_duration": 58,
        "inbetweens": 1,
    },
    "emerge": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "idle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "emerge-100x150.apng",
        "frame_duration": 82,
        "inbetweens": 1,
    },
    "eat": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "idle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "eat-100x150.apng",
        "frame_duration": 175,
        "inbetweens": 1,
    },
    "struggle": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "struggle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "struggle-100x150.apng",
        "frame_duration": 52,
        "inbetweens": 1,
    },
    "grabbed": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "struggle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "grabbed-100x150.apng",
        "frame_duration": 65,
        "inbetweens": 1,
    },
    "dragged": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "struggle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "dragged-100x150.apng",
        "frame_duration": 42,
        "inbetweens": 1,
    },
    "dropped": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "dropped",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "dropped-100x150.apng",
        "frame_duration": 110,
        "inbetweens": 0,
    },
}


def alpha_bbox(frame: Image.Image) -> tuple[int, int, int, int]:
    box = frame.getchannel("A").getbbox()
    if box is None:
        raise ValueError("Animation frame has no visible pixels")
    return box


def union_box(boxes: list[tuple[int, int, int, int]]) -> tuple[int, int, int, int]:
    return (
        min(box[0] for box in boxes),
        min(box[1] for box in boxes),
        max(box[2] for box in boxes),
        max(box[3] for box in boxes),
    )


def compose(frame: Image.Image, crop: tuple[int, int, int, int]) -> Image.Image:
    subject = frame.crop(crop)
    subject.thumbnail(MAX_SUBJECT, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    x = (CANVAS[0] - subject.width) // 2
    y = (CANVAS[1] - subject.height) // 2
    canvas.alpha_composite(subject, (x, y))
    return canvas


def interpolate(source: Image.Image, target: Image.Image, progress: float) -> Image.Image:
    if cv2 is None or np is None:
        return Image.blend(source, target, progress)
    first = np.array(source)
    second = np.array(target)
    first_gray = cv2.cvtColor(first[:, :, :3], cv2.COLOR_RGB2GRAY)
    second_gray = cv2.cvtColor(second[:, :, :3], cv2.COLOR_RGB2GRAY)
    forward = cv2.calcOpticalFlowFarneback(first_gray, second_gray, None, 0.5, 2, 15, 3, 5, 1.1, 0)
    backward = cv2.calcOpticalFlowFarneback(second_gray, first_gray, None, 0.5, 2, 15, 3, 5, 1.1, 0)
    height, width = first_gray.shape
    grid_x, grid_y = np.meshgrid(np.arange(width, dtype=np.float32), np.arange(height, dtype=np.float32))
    warped_first = cv2.remap(first, grid_x - forward[:, :, 0] * progress, grid_y - forward[:, :, 1] * progress, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    warped_second = cv2.remap(second, grid_x - backward[:, :, 0] * (1 - progress), grid_y - backward[:, :, 1] * (1 - progress), cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    return Image.fromarray(cv2.addWeighted(warped_first, 1 - progress, warped_second, progress, 0), "RGBA")


def smooth_frames(frames: list[Image.Image], inbetweens: int) -> list[Image.Image]:
    if inbetweens == 0:
        return frames
    result = []
    for index, source in enumerate(frames):
        target = frames[(index + 1) % len(frames)]
        result.append(source)
        for step in range(1, inbetweens + 1):
            result.append(interpolate(source, target, step / (inbetweens + 1)))
    return result


def feeding_frames(frame: Image.Image) -> list[Image.Image]:
    """A visible but restrained feeding sequence: crumb, head dip, then no crumb."""
    result = []
    for dip, crumb_width in zip((0, 2, 4, 3, 4, 2, 0, 0), (13, 11, 9, 7, 5, 3, 0, 0)):
        output = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        # Keep the abdomen and legs planted while only the head/antennae lean in.
        output.alpha_composite(frame.crop((0, 51, CANVAS[0], CANVAS[1])), (0, 51))
        if crumb_width:
            left = (CANVAS[0] - crumb_width) // 2
            top = 36
            crumb = ImageDraw.Draw(output)
            crumb.ellipse((left, top, left + crumb_width, top + 6), fill=(119, 77, 34, 255))
            if crumb_width > 4:
                crumb.ellipse((left + 2, top + 1, left + crumb_width - 2, top + 3), fill=(182, 126, 61, 255))
        output.alpha_composite(frame.crop((0, 0, CANVAS[0], 66)), (0, dip))
        result.append(output)
    return result


def force_full_apng_frames(frames: list[Image.Image]) -> list[Image.Image]:
    """Prevent APNG delta-frame optimization from clearing the unchanged abdomen."""
    result = []
    for index, frame in enumerate(frames):
        output = frame.copy()
        alpha = 1 + index % 2
        # Alternating, visually imperceptible corner pixels keep each encoded frame full-canvas.
        output.putpixel((0, 0), (0, 0, 0, alpha))
        output.putpixel((CANVAS[0] - 1, CANVAS[1] - 1), (0, 0, 0, alpha))
        result.append(output)
    return result


def build_animation(name: str, config: dict[str, object]) -> None:
    frame_dir = config["frame_dir"]
    out = config["out"]
    frame_duration = config["frame_duration"]
    inbetweens = config["inbetweens"]
    if not isinstance(frame_dir, Path) or not isinstance(out, Path) or not isinstance(frame_duration, int) or not isinstance(inbetweens, int):
        raise TypeError(f"Invalid configuration for {name}")

    paths = sorted(frame_dir.glob("frame-*.png"))
    if len(paths) < 2:
        raise SystemExit(f"At least two {name} PNG frames are required")
    source = [Image.open(path).convert("RGBA") for path in paths]
    crop = union_box([alpha_bbox(frame) for frame in source])
    composed = [compose(frame, crop) for frame in source]
    frames = force_full_apng_frames(feeding_frames(composed[0])) if name == "eat" else smooth_frames(composed, inbetweens)
    out.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        out,
        format="PNG",
        save_all=True,
        append_images=frames[1:],
        duration=[frame_duration] * len(frames),
        loop=0,
        disposal=0 if name == "eat" else 2,
        blend=0,
    )
    print(f"Wrote {out.relative_to(ROOT)} ({len(frames)} frames, {CANVAS[0]}x{CANVAS[1]})")


def main() -> None:
    for name, config in ANIMATIONS.items():
        build_animation(name, config)


if __name__ == "__main__":
    main()
