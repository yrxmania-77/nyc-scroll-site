#!/usr/bin/env bash
# Media pipeline for the NEW YORK scroll journey.
#
# Source clips disagree on aspect ratio: dives are 1856x1112 (1.67:1), pull-ups
# are 2196x940 (2.34:1). Left alone, the frame visibly jumps at the dive -> pull-up
# handoff. Everything is centre-cropped to a common 16:9 so the handoff is seamless.
#
# JPEG, not WebP: this ffmpeg build has no libwebp encoder, and JPEG gets
# hardware-accelerated decode, which is what actually matters when swapping a
# frame per scroll tick.
#
# Output (all under "main scroll folder", per CLAUDE.md):
#   frames/<clip>/####.jpg          desktop frames, NATIVE size after the 16:9
#                                   crop: dives 1664x936 / 1856x1044, pull-ups 1670x940
#   frames-sm/<clip>/####.jpg       1280x720 small-screen / save-data sequence
#   stills/<place>-hold.jpg         last dive frame, for the card hold + reduced motion
#   optimized/                      hero and gallery stills, sized
set -euo pipefail

MEDIA="/Users/procct/The New York site/main scroll folder"
cd "$MEDIA"

DIVES=(park-dive bridge-dive times-dive statue-dive)
PULLUPS=(park-pullup bridge-pullup times-pullup statue-pullup)

# Centre-crop to 16:9, then scale. Dives lose ~6% height, pull-ups ~24% width.
CROP169="crop='min(iw,ih*16/9)':'min(ih,iw*9/16)'"

mkdir -p frames frames-sm stills optimized

echo "==> Extracting frame sequences"
for clip in "${DIVES[@]}" "${PULLUPS[@]}"; do
  rm -rf "frames/$clip" "frames-sm/$clip"
  mkdir -p "frames/$clip" "frames-sm/$clip"

  # NATIVE resolution, no downscale, -q:v 2. Dives and pull-ups get identical
  # treatment: a pull-up is motion-blurred, but it is also where the visitor is
  # travelling fastest, and starving it was never measured to save anything.
  #
  # q:v 2 rather than 4: decoded memory is width*height*4 whatever the encoder
  # quality, so this number cannot affect the smoothness budget at all. It only
  # moves download time (~164ms -> ~250ms per clip), and only three clips are
  # ever resident. It buys back high-frequency detail on facades and foliage.
  #
  # Every clip keeps whatever the 16:9 crop leaves it (dives 1664-1856 wide,
  # pull-ups 1671) rather than being resized to a common number. Frames are
  # drawn cover-fit, so they do not need to agree on size, and any downscale
  # here is sharpness that cannot be recovered later.
  #
  # There is no "1920x1080 source" to reach: the clips are 2208x936 and
  # 1856x1112, and the two aspect ratios must share a 16:9 crop, so these
  # numbers ARE full quality for this footage.
  # A mild unsharp mask is applied at NATIVE size, before the browser ever
  # touches the frame. This is the single biggest sharpness win available.
  #
  # The footage is only 936-1044px tall after the 16:9 crop, while a retina
  # 900px-tall viewport needs 1800 device px, so the canvas must upscale it
  # ~1.9x no matter what. Pre-compensating for that upscale scores better on
  # fine detail (7.03) than even a lanczos resize of the original (6.21), at no
  # resolution cost. 0.6 was chosen over 1.0 by eye: 1.0 starts to look
  # over-processed on the tree canopy.
  ffmpeg -nostdin -v error -i "$clip.mp4" \
    -vf "${CROP169},unsharp=5:5:0.6:5:5:0.0" \
    -c:v mjpeg -q:v 2 -pix_fmt yuvj420p \
    "frames/$clip/%04d.jpg"

  ffmpeg -nostdin -v error -i "$clip.mp4" \
    -vf "${CROP169},scale=1280:720:flags=lanczos,unsharp=5:5:0.5:5:5:0.0" \
    -c:v mjpeg -q:v 3 -pix_fmt yuvj420p \
    "frames-sm/$clip/%04d.jpg"

  echo "    $clip -> $(ls frames/$clip | wc -l | tr -d ' ') frames @ native q2"
done

echo "==> Extracting dive freeze-frames (last frame of each dive)"
for clip in "${DIVES[@]}"; do
  place="${clip%-dive}"
  last=$(ls "frames/$clip" | tail -1)
  cp "frames/$clip/$last" "stills/$place-hold.jpg"
  echo "    $place-hold.jpg <- $clip/$last"
  # The pull-up's last frame is the "returned to the map" state. It is the image
  # the NEXT dive crossfades out of, and it must stay resident after its clip is
  # freed from memory, so it is extracted as a still too.
  cp "frames/$place-pullup/0121.jpg" "stills/$place-return.jpg"
  echo "    $place-return.jpg <- $place-pullup/0121.jpg"
  # A dive's FIRST frame is the map state the previous pull-up has to arrive at.
  # The pull-up's blurred tail dissolves into this, so it must stay resident.
  cp "frames/$clip/0001.jpg" "stills/$place-mapstart.jpg"
  echo "    $place-mapstart.jpg <- $clip/0001.jpg"
done

echo "==> Optimizing stills"
# Hero + map: large, high quality. Gallery: sized down, still crisp.
ffmpeg -nostdin -v error -y -i front-main.png   -vf "scale=1920:-2:flags=lanczos"             -c:v mjpeg -q:v 3 -pix_fmt yuvj420p optimized/front-main.jpg
ffmpeg -nostdin -v error -y -i front-main.png   -vf "scale=1100:-2:flags=lanczos"             -c:v mjpeg -q:v 5 -pix_fmt yuvj420p optimized/front-main-sm.jpg
ffmpeg -nostdin -v error -y -i scroll-start.png -vf "${CROP169},scale=1600:900:flags=lanczos" -c:v mjpeg -q:v 4 -pix_fmt yuvj420p optimized/scroll-start.jpg
ffmpeg -nostdin -v error -y -i scroll-start.png -vf "${CROP169},scale=900:506:flags=lanczos"  -c:v mjpeg -q:v 6 -pix_fmt yuvj420p optimized/scroll-start-sm.jpg

# The About section's field, from the file the user supplied. q:v 2/4 rather
# than the gallery's 4/6 — the source is a smooth gradient with no
# high-frequency detail, so it costs ~19KB even at top quality and there is no
# reason to risk banding. The source keeps the name the user gave it, spaces and
# all; only the derivative is kebab-case.
#
# THE TOP AND BOTTOM 16% ARE LEVELLED HORIZONTALLY, and that is not cosmetic.
# site.css fades those bands to --paper-deep so the section lands on the colour
# the journey's melt starts from. The source image has a diagonal bright sweep
# in it — its bottom band runs 155 to 239 across the width — so a perfectly
# level CSS gradient over it faded UP on one side and DOWN on the other, and
# read as a slanted band. Blending each row in those bands toward its own
# horizontal mean drops the spread from 84 to 3 at the bottom and 56 to 1 at the
# top, while leaving the middle of the image (spread 61) exactly as supplied.
#
# maskedmerge picks per-pixel between the original and a horizontally-averaged
# copy, using a vertical ramp as the mask: 255 in the edge bands, 0 in the
# middle. Drop this step and the slant returns immediately.
# The ramp is deliberately NOT the same shape as the CSS fade. Levelling that
# decays while the fade rises leaves a product term that peaks mid-band — that
# measured a 20-29 luma left-to-right spread halfway down. So the image is held
# FULLY level across the whole fade band (to 18%) and only then ramps back to
# the original by 34%, which keeps the spread near zero everywhere the fade is
# actually doing something. The middle third of the image is untouched.
for spec in "1600 686 2 about-texture" "800 343 4 about-texture-sm"; do
  set -- $spec; W=$1; H=$2; Q=$3; NAME=$4
  T1=$(( H * 18 / 100 ))   # fully levelled out to here
  T2=$(( H * 34 / 100 ))   # fully original from here
  ffmpeg -nostdin -v error -y -i "new text image.png" -filter_complex "
      [0:v]scale=${W}:${H}:flags=lanczos,split=3[a][b][c];
      [b]scale=1:${H}:flags=area,scale=${W}:${H}:flags=bilinear[flat];
      [c]geq=lum='255*clip(max((${T2}-Y)/$((T2-T1)),(Y-$((H-T2)))/$((T2-T1))),0,1)':cb=128:cr=128[mask];
      [a][flat][mask]maskedmerge[out]" \
    -map "[out]" -c:v mjpeg -q:v "$Q" -pix_fmt yuvj420p "optimized/${NAME}.jpg"
done

# ---- Contact background -------------------------------------------------
# The source is 1672x941 and carries an editorial layout baked into the pixels
# down its left edge: a vertical NEW YORK label, an "nyc" script, a numeral 28,
# and a small rotated paragraph. That paragraph is NOT copy — it is lorem-style
# nonsense rendered into the image ("Freedoco is not gimen…"), so it cannot be
# corrected in CSS, only framed out. Same rule as the About image: fix the file.
#
# Cropping the left 170px (10.2%) drops the paragraph, the numeral and the
# label, and clips the script so it bleeds off the left edge as a deliberate
# crop rather than a stranded ornament. The statue and the open sky the card
# sits over are untouched.
#
# No upscale — the crop is 1502 wide and that is the derivative's width. q:v 3
# rather than the gallery's 4 because the frame is mostly smooth near-white sky,
# which is exactly the content that bands.
for spec in "1502 3 get-in-touch-bg" "800 5 get-in-touch-bg-sm"; do
  set -- $spec; W=$1; Q=$2; NAME=$3
  ffmpeg -nostdin -v error -y -i "get in touch background pic.png" \
    -vf "crop=in_w-170:in_h:170:0,scale=${W}:-2:flags=lanczos" \
    -c:v mjpeg -q:v "$Q" -pix_fmt yuvj420p "optimized/${NAME}.jpg"
done

for img in street-food.png skyline.png brownstones.jpg subway.jpg crowds.jpg \
           empire-state.jpg flatiron.jpg; do
  name="${img%.*}"
  ffmpeg -nostdin -v error -i "$img" -vf "scale='min(1600,iw)':-2:flags=lanczos" -c:v mjpeg -q:v 4 -pix_fmt yuvj420p -y "optimized/$name.jpg"
  ffmpeg -nostdin -v error -i "$img" -vf "scale='min(800,iw)':-2:flags=lanczos"  -c:v mjpeg -q:v 6 -pix_fmt yuvj420p -y "optimized/$name-sm.jpg"
done

echo "==> Done"
du -sh frames frames-sm stills optimized
