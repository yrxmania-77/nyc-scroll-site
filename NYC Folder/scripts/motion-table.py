"""Regenerate MOTION_LUT in js/journey.js from the source clips.

Every clip is a bell curve of motion: the camera eases in, runs, and settles.
Under a linear scroll mapping that ease is replayed on top of the visitor's own
scrolling, so a clip spends as much scroll on frames that barely differ as on
its fast middle — which is what reads as "crawls, then blasts past".

This measures each clip's motion, inverts the cumulative curve, and prints the
table that maps scroll fraction -> frame index so equal scroll buys equal SCREEN
motion. Paste the output over MOTION_LUT in js/journey.js.

    python3 scripts/motion-table.py

Re-run after any change to the 16:9 crop or to which clips ship. Encoder quality
does not affect it — motion is measured on a heavily downscaled grayscale copy,
so -q:v changes are far below the noise floor.
"""
import json
import subprocess
import sys
from pathlib import Path

MEDIA = Path(__file__).resolve().parent.parent / "main scroll folder"
W, H = 240, 135          # motion is a low-frequency signal; full res buys nothing
K = 32                   # LUT samples; sub-frame blending covers between them
N = 121                  # frames per clip
LAST = N - 1

# Floor on a frame's share of scroll, as a fraction of the clip's average.
#
# Without it, frames that barely differ get compressed to almost no scroll at
# all, and the playhead crosses them in bursts: statue-pullup advanced 28 frames
# in 1/32 of its scroll, 7.5x the linear rate. That outruns WARM_AHEAD (22), so
# frames are decoded inline during the scroll and the drop rate went 1% -> 6%.
#
# Measured max advance per LUT step, worst clip:
#   floor 0.00 -> 28.2 frames (7.5x linear)    1% -> 6% dropped
#   floor 0.35 -> 11.4 frames (3.0x)
#   floor 0.50 ->  8.4 frames (2.2x)
#
# The frames this protects are the near-static ones, so spending a little more
# scroll on them costs almost nothing perceptually.
MOTION_FLOOR = 0.5

# Must match media-pipeline.sh, or the motion measured is not the motion shown.
CROP = "crop='min(iw,ih*16/9)':'min(ih,iw*9/16)'"

PLACES = ["park", "bridge", "times", "statue"]
CLIPS = [f"{p}-{k}" for p in PLACES for k in ("dive", "pullup")]


def gray_frames(clip):
    """Decode the whole clip to raw grayscale at W x H, as a list of frames."""
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", str(MEDIA / f"{clip}.mp4"),
         "-vf", f"{CROP},scale={W}:{H}", "-pix_fmt", "gray", "-f", "rawvideo", "-"],
        capture_output=True, check=True).stdout
    sz = W * H
    return [raw[i * sz:(i + 1) * sz] for i in range(len(raw) // sz)]


def motion(frames):
    """Mean absolute frame-to-frame difference, sampled every 7th pixel."""
    out = []
    for a, b in zip(frames, frames[1:]):
        idx = range(0, len(a), 7)
        out.append(sum(abs(a[j] - b[j]) for j in idx) / len(range(0, len(a), 7)))
    return out


def invert(m):
    """Cumulative motion, inverted: scroll fraction -> fractional frame index."""
    avg = sum(m) / len(m)
    m = [max(v, MOTION_FLOOR * avg) for v in m]
    cum, s = [0.0], 0.0
    for v in m:
        s += v
        cum.append(s)
    cum = [c / s for c in cum]
    out, j = [], 0
    for k in range(K + 1):
        t = k / K
        while j < LAST and cum[j + 1] < t:
            j += 1
        lo = cum[j]
        hi = cum[j + 1] if j < LAST else 1.0
        f = j + (0.0 if hi <= lo else (t - lo) / (hi - lo))
        out.append(round(min(f, LAST), 2))
    return out


def main():
    tables, report = {}, []
    for clip in CLIPS:
        frames = gray_frames(clip)
        if len(frames) != N:
            print(f"{clip}: got {len(frames)} frames, expected {N}", file=sys.stderr)
            return 1
        m = motion(frames)
        tables[clip] = invert(m)
        mid = sum(m[55:65]) / 10
        last = sum(m[-5:]) / 5
        report.append((clip, sum(m) / len(m), mid, last, mid / max(last, 0.01)))

    print("# motion profile (mean absolute frame-to-frame difference)\n")
    print(f"# {'clip':<15}{'mean':>7}{'mid':>7}{'last5':>7}{'ratio':>8}")
    for clip, mean, mid, last, ratio in report:
        print(f"# {clip:<15}{mean:>7.1f}{mid:>7.1f}{last:>7.1f}{ratio:>7.1f}x")

    print("\nconst MOTION_LUT = {")
    width = max(len(c) for c in CLIPS) + 3
    for i, (clip, tab) in enumerate(tables.items()):
        comma = "" if i == len(tables) - 1 else ","
        key = f"'{clip}':".ljust(width)
        print(f"  {key}[{', '.join(str(x) for x in tab)}]{comma}")
    print("};")
    return 0


if __name__ == "__main__":
    sys.exit(main())
