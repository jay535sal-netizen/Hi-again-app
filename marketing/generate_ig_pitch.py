"""
Hi Again — Instagram moody pitch card (1080×1080).
Adult, magnetic, cinematic. The "mystery" pitch on a dark grain background.
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = "/app/frontend/public/ig_pitch.png"
PACIFICO = "/app/marketing/fonts/Pacifico-Regular.ttf"

W = H = 1080
BG_TOP = (14, 10, 20)
BG_BOT = (28, 12, 24)
ACCENT = (255, 140, 90)
BLUE = (110, 155, 220)
CREAM = (240, 232, 220)


def gradient(size, top, bottom):
    w, h = size
    strip = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / (h - 1)
        strip.putpixel((0, y), tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)))
    return strip.resize((w, h))


def font(size):
    return ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf", size)


img = gradient((W, H), BG_TOP, BG_BOT).convert("RGBA")

# Radial vignette
vg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
vd = ImageDraw.Draw(vg)
vd.ellipse((-200, -200, W + 200, H + 200), fill=(0, 0, 0, 0), outline=None)
vd.ellipse((-200, -200, W + 200, H + 200), fill=None)
for r in range(0, 300, 20):
    vd.ellipse((-r, -r, W + r, H + r), outline=(0, 0, 0, min(6, r // 4)))
vg = vg.filter(ImageFilter.GaussianBlur(60))
img.alpha_composite(vg)

# Warm accent glow top-left
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse((-300, -300, 600, 600), fill=(255, 120, 80, 80))
glow = glow.filter(ImageFilter.GaussianBlur(140))
img.alpha_composite(glow)

# Subtle grain texture (tiny random-ish dots)
grain = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd2 = ImageDraw.Draw(grain)
import random
random.seed(4)
for _ in range(3500):
    x = random.randint(0, W - 1)
    y = random.randint(0, H - 1)
    a = random.randint(4, 22)
    gd2.point((x, y), fill=(255, 255, 255, a))
img.alpha_composite(grain)

draw = ImageDraw.Draw(img)

# --- Text ---
lines = [
    ("Everywhere you've been this year,", 62, CREAM, "italic"),
    ("someone was already there.", 62, ACCENT, "italic"),
    ("", 20, CREAM, "italic"),
    ("Same concert.", 40, CREAM, "italic"),
    ("Same corner booth.", 40, CREAM, "italic"),
    ("Same red-eye flight.", 40, CREAM, "italic"),
    ("", 30, CREAM, "italic"),
    ("Some of them noticed you.", 40, CREAM, "italic"),
    ("All of them are wondering", 40, CREAM, "italic"),
    ("the same thing you are.", 40, ACCENT, "italic"),
]

y = 140
for text, size, color, _style in lines:
    if not text:
        y += size
        continue
    f = font(size)
    bb = draw.textbbox((0, 0), text, font=f)
    tw = bb[2] - bb[0]
    tx = (W - tw) // 2 - bb[0]
    draw.text((tx, y), text, fill=color, font=f)
    y += size + 8

# Bottom: pacifico brand + URL
brand_font = ImageFont.truetype(PACIFICO, 76)
brand = "Hi Again."
bb = draw.textbbox((0, 0), brand, font=brand_font)
tw = bb[2] - bb[0]
draw.text(((W - tw) // 2 - bb[0], H - 260), brand,
          fill=(255, 255, 255, 255), font=brand_font)

sub_font = font(26)
sub = "for the ones who almost said something."
bb = draw.textbbox((0, 0), sub, font=sub_font)
tw = bb[2] - bb[0]
draw.text(((W - tw) // 2 - bb[0], H - 155), sub,
          fill=BLUE, font=sub_font)

url_font = ImageFont.truetype(
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 28
)
url = "hiagain.xyz/invite/JOIN"
bb = draw.textbbox((0, 0), url, font=url_font)
tw = bb[2] - bb[0]
draw.rounded_rectangle(
    ((W - tw) // 2 - 24, H - 90,
     (W - tw) // 2 + tw + 24, H - 40),
    radius=16, fill=(240, 220, 190, 230))
draw.text(((W - tw) // 2 - bb[0], H - 85), url,
          fill=(28, 12, 20), font=url_font)

img.convert("RGB").save(OUT, "PNG", optimize=True)
print(f"Saved {OUT}  ({os.path.getsize(OUT)//1024} KB)")
