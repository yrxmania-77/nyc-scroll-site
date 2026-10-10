"""Index the journey's raw H.264 streams into video/manifest.json.

The manifest is the container: for every clip and tier it records the codec
string WebCodecs needs, the frame size, and the byte offset of every frame, so
js/journey.js can hand frame i to the decoder as one EncodedVideoChunk without
parsing anything itself.

Frames are found by their access-unit delimiter (NAL type 9), which the encoder
is told to emit in video-pipeline.sh. The script refuses to write a manifest
the player would misread: wrong frame count, a keyframe anywhere but every GOP
boundary, or a GOP that does not open with its own SPS/PPS all fail loudly.

    python3 scripts/video-index.py "<main scroll folder>/video"
"""
import json
import subprocess
import sys
from pathlib import Path

FRAMES = 121
GOP = 12
FPS = 24
TIERS = ("hq", "sm", "lo")   # largest first; journey.js steps down this ladder
CLIPS = ["park-dive", "park-pullup", "bridge-dive", "bridge-pullup",
         "times-dive", "times-pullup", "statue-dive", "statue-pullup"]


def nals(buf):
    """Yield (start_code_offset, nal_type, payload_offset) for every NAL unit."""
    i, n = 0, len(buf)
    while i < n - 3:
        if buf[i] == 0 and buf[i + 1] == 0:
            if buf[i + 2] == 1:
                yield i, buf[i + 3] & 0x1F, i + 3
                i += 3
                continue
            if buf[i + 2] == 0 and i + 3 < n and buf[i + 3] == 1:
                yield i, buf[i + 4] & 0x1F, i + 4
                i += 4
                continue
        i += 1


def index(path):
    buf = path.read_bytes()
    frames, codec = [], None
    for start, kind, payload in nals(buf):
        if kind == 9:                                   # access-unit delimiter
            frames.append({"off": start, "types": set()})
        elif frames:
            frames[-1]["types"].add(kind)
            if kind == 7 and codec is None:             # SPS: profile, flags, level
                codec = "avc1.%02X%02X%02X" % (buf[payload + 1], buf[payload + 2], buf[payload + 3])

    if len(frames) != FRAMES:
        sys.exit(f"{path}: {len(frames)} frames, expected {FRAMES}")
    for i, f in enumerate(frames):
        key = 5 in f["types"]
        if key != (i % GOP == 0):
            sys.exit(f"{path}: frame {i} keyframe={key}, expected an IDR exactly every {GOP}")
        if key and not {7, 8} <= f["types"]:
            sys.exit(f"{path}: GOP at frame {i} has no SPS/PPS of its own")

    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries",
         "stream=width,height", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True).stdout.strip().split(",")
    return {
        "codec": codec,
        "w": int(probe[0]),
        "h": int(probe[1]),
        "bytes": len(buf),
        "off": [f["off"] for f in frames] + [len(buf)],
    }


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "video")
    manifest = {"frames": FRAMES, "gop": GOP, "fps": FPS, "tiers": {}}
    for tier in TIERS:
        clips = {c: index(root / tier / f"{c}.h264") for c in CLIPS}
        manifest["tiers"][tier] = clips
        total = sum(c["bytes"] for c in clips.values())
        print(f"    {tier}: {total / 1e6:.1f}MB, codecs {sorted({c['codec'] for c in clips.values()})}")
    (root / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")))
    print(f"    wrote {root / 'manifest.json'}")


if __name__ == "__main__":
    main()
