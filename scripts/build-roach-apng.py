from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CANVAS = (100, 150)
MAX_SUBJECT = (96, 144)
ANIMATIONS = {
    "idle": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "idle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "idle-100x150.apng",
        "duration": [460, 460, 460],
    },
    "alert": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "idle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "alert-100x150.apng",
        "duration": [180, 180, 180],
    },
    "walk": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "walk",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "walk-100x150.apng",
        "duration": [145, 145, 145, 145],
    },
    "sprint": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "walk",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "sprint-100x150.apng",
        "duration": [95, 95, 95, 95],
    },
    "flee": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "walk",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "flee-100x150.apng",
        "duration": [70, 70, 70, 70],
    },
    "struggle": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "struggle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "struggle-100x150.apng",
        "duration": [105, 105, 105, 105],
    },
    "grabbed": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "struggle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "grabbed-100x150.apng",
        "duration": [130, 130, 130, 130],
    },
    "dragged": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "struggle",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "dragged-100x150.apng",
        "duration": [85, 85, 85, 85],
    },
    "dropped": {
        "frame_dir": ROOT / "assets" / "roach-topdown" / "frames" / "dropped",
        "out": ROOT / "assets" / "roach-topdown" / "animations" / "dropped-100x150.apng",
        "duration": [120, 120, 100, 100],
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


def build_animation(name: str, config: dict[str, object]) -> None:
    frame_dir = config["frame_dir"]
    out = config["out"]
    durations = config["duration"]
    if not isinstance(frame_dir, Path) or not isinstance(out, Path) or not isinstance(durations, list):
        raise TypeError(f"Invalid configuration for {name}")

    paths = sorted(frame_dir.glob("frame-*.png"))
    if len(paths) < 2:
        raise SystemExit(f"At least two {name} PNG frames are required")
    if len(paths) != len(durations):
        raise SystemExit(f"{name} needs one duration per frame")
    source = [Image.open(path).convert("RGBA") for path in paths]
    crop = union_box([alpha_bbox(frame) for frame in source])
    frames = [compose(frame, crop) for frame in source]
    out.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        out,
        format="PNG",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        disposal=2,
        blend=0,
    )
    print(f"Wrote {out.relative_to(ROOT)} ({len(frames)} frames, {CANVAS[0]}x{CANVAS[1]})")


# The "peek" sprite shows just the two antennae poking from a screen edge after
# the pet is dragged to the edge. Cropped from the idle frames' antennae region
# (tips at y 40, roots at y 285 where they meet the head). The crop is resized
# to a fixed width and pasted at the canvas top-left, so the antennae roots sit
# flush against the bottom edge of the sprite, which sits flush against the
# screen edge when tucked.
PEEK_CROP = (214, 40, 1145, 285)
PEEK_WIDTH = 115
# Electron/Windows will not shrink a window below this height (38 DIP), so the
# peek canvas is padded to it while the antennae stay at their natural scale
# and are pasted against the bottom edge, keeping the roots flush at the edge.
PEEK_MIN_HEIGHT = 38
PEEK_DURATION = [420, 420]


def build_peek() -> None:
    frame_dir = ROOT / "assets" / "roach-topdown" / "frames" / "idle"
    paths = sorted(frame_dir.glob("frame-*.png"))[:2]
    if len(paths) != len(PEEK_DURATION):
        raise SystemExit("peek needs one duration per frame")
    crop_w = PEEK_CROP[2] - PEEK_CROP[0]
    crop_h = PEEK_CROP[3] - PEEK_CROP[1]
    img_h = max(1, round(crop_h * PEEK_WIDTH / crop_w))
    height = max(PEEK_MIN_HEIGHT, img_h)
    canvas_size = (PEEK_WIDTH, height)
    out = ROOT / "assets" / "roach-topdown" / "animations" / f"peek-{PEEK_WIDTH}x{height}.apng"
    frames = []
    for path in paths:
        source = Image.open(path).convert("RGBA")
        subject = source.crop(PEEK_CROP).resize((PEEK_WIDTH, img_h), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
        canvas.alpha_composite(subject, (0, height - img_h))
        frames.append(canvas)
    out.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        out,
        format="PNG",
        save_all=True,
        append_images=frames[1:],
        duration=PEEK_DURATION,
        loop=0,
        disposal=2,
        blend=0,
    )
    print(f"Wrote {out.relative_to(ROOT)} (peek {canvas_size[0]}x{canvas_size[1]})")


def main() -> None:
    for name, config in ANIMATIONS.items():
        build_animation(name, config)
    build_peek()


if __name__ == "__main__":
    main()
