#!/usr/bin/env bash
# Video delivery for the scroll journey: every clip as a raw H.264 stream, two
# sizes, plus one manifest that indexes every frame's byte range.
#
# WHY THIS EXISTS. The journey is delivery-bound, not render-bound. As JPEG
# frame sequences it is 968 files and 389MB (184MB at 1280x720), and measured on
# a ~10 Mbps link only ~1.8 of 8 clips arrive during a 30-second scroll — the
# loader stays up for ~90% of the pin and the page unpins with the journey stuck
# at the first place. On unthrottled localhost the same code is perfect, so the
# renderer was never the problem; the bytes were. Inter-frame compression is the
# only lever big enough:
#
#   tier  size                          journey   was (JPEG)
#   hq    native 16:9 crop, unsharp .6    42.7MB    389MB   SSIM 0.96 vs the q2 JPEGs
#   sm    1280x720, unsharp .5            27.4MB    184MB   SSIM 0.96 vs frames-sm
#   lo    960x540,  unsharp .5, crf 28    14.8MB    —       for links under ~7 Mbps
#
# journey.js picks the largest tier the measured link can deliver in about the
# time a visitor spends scrolling the pin (~30s): hq needs ~11 Mbps, sm ~7,
# lo ~4. A soft journey that plays beats a sharp one that stalls.
#
# Same crop and the same pre-sharpening as media-pipeline.sh's frame export, so
# DESIGN.md's sharpness rules (native size, unsharp before the browser upscales)
# carry over unchanged.
#
# ENCODER SETTINGS ARE LOAD-BEARING. js/journey.js decodes these with WebCodecs
# and relies on each of them:
#   -bf 0            decode order == display order, so frame i is chunk i
#   -g 12 + sc_thr 0 an IDR exactly every 12 frames, so any frame is reachable
#                    by decoding at most 12 chunks from a known keyframe
#   aud=1            an access-unit delimiter opens every frame, which is what
#                    video-index.py splits on
#   repeat-headers=1 SPS/PPS in front of every IDR, so a GOP decodes on its own
#                    after a flush, with nothing carried over from earlier ones
# Raw Annex B (.h264) rather than .mp4 so the browser needs no demuxer library;
# the manifest is the container.
#
# The JPEG frames stay: they are the fallback for browsers without WebCodecs.
set -euo pipefail

MEDIA="/Users/procct/The New York site/main scroll folder"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$MEDIA"

CLIPS=(park-dive park-pullup bridge-dive bridge-pullup times-dive times-pullup statue-dive statue-pullup)
CROP169="crop='min(iw,ih*16/9)':'min(ih,iw*9/16)'"
X264=(-c:v libx264 -preset slow -bf 0 -g 12 -keyint_min 12 -sc_threshold 0
      -x264-params aud=1:repeat-headers=1 -pix_fmt yuv420p -an -f h264)

mkdir -p video/hq video/sm video/lo

echo "==> Encoding clips (hq native, sm 1280x720, lo 960x540)"
for clip in "${CLIPS[@]}"; do
  ffmpeg -nostdin -v error -y -i "$clip.mp4" \
    -vf "${CROP169},unsharp=5:5:0.6:5:5:0.0" "${X264[@]}" -crf 26 "video/hq/$clip.h264" &
  ffmpeg -nostdin -v error -y -i "$clip.mp4" \
    -vf "${CROP169},scale=1280:720:flags=lanczos,unsharp=5:5:0.5:5:5:0.0" "${X264[@]}" -crf 26 "video/sm/$clip.h264" &
  ffmpeg -nostdin -v error -y -i "$clip.mp4" \
    -vf "${CROP169},scale=960:540:flags=lanczos,unsharp=5:5:0.5:5:5:0.0" "${X264[@]}" -crf 28 "video/lo/$clip.h264" &
done
wait

echo "==> Indexing frames"
python3 "$HERE/video-index.py" video

# Seam stills, cut from each tier's OWN decoded stream, for two reasons:
#  - the hold IS the dive's last frame. Cut from the video, the dive -> hold
#    handoff swaps a frame for a byte-near-identical copy of itself; cut from
#    the q2 JPEGs it would swap compression and, below hq, resolution.
#  - size. The JPEG stills are 6.2MB, which at 5 Mbps is ten seconds of the
#    link spent beside a 14.8MB journey. At lo these are ~1MB.
echo "==> Cutting seam stills per tier"
# q2 at full size, matching DESIGN.md's rule for frames the visitor dwells on;
# q4 below it, where the stream itself is softer than the JPEG could be.
for tier in hq sm lo; do
  q=4; [ "$tier" = hq ] && q=2
  mkdir -p "video/$tier/stills"
  for place in park bridge times statue; do
    ffmpeg -nostdin -v error -y -i "video/$tier/$place-dive.h264" -vf "select=eq(n\,120)" -frames:v 1 -q:v $q "video/$tier/stills/$place-hold.jpg"
    ffmpeg -nostdin -v error -y -i "video/$tier/$place-dive.h264" -frames:v 1 -q:v $q "video/$tier/stills/$place-mapstart.jpg"
    ffmpeg -nostdin -v error -y -i "video/$tier/$place-pullup.h264" -vf "select=eq(n\,120)" -frames:v 1 -q:v $q "video/$tier/stills/$place-return.jpg"
  done
done

du -sh video/hq video/sm video/lo video/*/stills
