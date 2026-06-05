"""
Hi Again — single-mark icon options (X / Snapchat / Threads aesthetic).
ONE shape, ONE background, no clutter.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = "/app/marketing/play_assets/options"
os.makedirs(OUT, exist_ok=True)

PACIFICO = "/app/marketing/fonts/Pacifico-Regular.ttf"
DANCING = "/app/marketing/fonts/DancingScript.ttf"

WHITE = (255, 255, 255)
BLACK = (15, 15, 18)


def get_font(paths, size):
    for p in paths + ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def vertical_gradient(size, top, bottom):
    w, h = size
    base = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        base.putpixel((0, y), (r, g, b))
    return base.resize((w, h))


def stamp_pin(draw, cx, cy, radius, fill):
    """Map pin: circle head + triangle tail."""
    bbox = (cx - radius, cy - radius, cx + radius, cy + radius)
    tail_h = int(radius * 1.45)
    tail_tip = (cx, cy + radius + tail_h)
    tail_l = (cx - int(radius * 0.62), cy + int(radius * 0.50))
    tail_r = (cx + int(radius * 0.62), cy + int(radius * 0.50))
    draw.ellipse(bbox, fill=fill)
    draw.polygon([tail_l, tail_r, tail_tip], fill=fill)


def squircle_bg(size, color):
    """Plain solid square — Play Store wraps it into a squircle on most launchers."""
    img = Image.new("RGB", (size, size), color)
    return img


def gradient_bg(size, top, bottom):
    return vertical_gradient((size, size), top, bottom)


# =====================================================================
# OPTION A — Solid sunset background + white pin silhouette
#           (mirrors Snapchat: solid bg + white mark)
# =====================================================================
def option_a(size=1024):
    img = gradient_bg(size, (255, 130, 90), (220, 50, 80)).convert("RGBA")
    draw = ImageDraw.Draw(img)
    cx, cy = size // 2, int(size * 0.42)
    radius = int(size * 0.30)
    # White pin
    stamp_pin(draw, cx, cy, radius, WHITE)
    # Negative-space "H" inside the pin head
    h_font = get_font([
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ], int(size * 0.38))
    text = "H"
    bb = draw.textbbox((0, 0), text, font=h_font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    tx = cx - tw // 2 - bb[0]
    ty = cy - th // 2 - bb[1]
    # Draw H in same color as the bg so it appears as a cutout
    draw.text((tx, ty), text, fill=(220, 60, 80), font=h_font)
    return img


# =====================================================================
# OPTION B — Solid navy + sunset-gradient pin with white "H" inside
#           (mirrors Twitch / Discord: solid dark bg + gradient mark)
# =====================================================================
def option_b(size=1024):
    img = squircle_bg(size, (11, 18, 32)).convert("RGBA")
    cx, cy = size // 2, int(size * 0.42)
    radius = int(size * 0.32)
    # Build gradient pin via mask
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    stamp_pin(md, cx, cy, radius, 255)
    grad = vertical_gradient((size, size), (255, 130, 90), (220, 50, 80)).convert("RGBA")
    img.paste(grad, (0, 0), mask=mask)
    # White H
    draw = ImageDraw.Draw(img)
    h_font = get_font([
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ], int(size * 0.32))
    text = "H"
    bb = draw.textbbox((0, 0), text, font=h_font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    tx = cx - tw // 2 - bb[0]
    ty = cy - th // 2 - bb[1]
    draw.text((tx, ty), text, fill=WHITE, font=h_font)
    return img


# =====================================================================
# OPTION C — Single cursive "H" only, no pin, on sunset gradient
#           (mirrors X / Facebook: pure letterform on solid color)
# =====================================================================
def option_c(size=1024):
    img = gradient_bg(size, (255, 130, 90), (220, 50, 80)).convert("RGBA")
    draw = ImageDraw.Draw(img)
    # Huge cursive H
    h_font = get_font([PACIFICO], int(size * 0.78))
    text = "H"
    bb = draw.textbbox((0, 0), text, font=h_font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    tx = size // 2 - tw // 2 - bb[0]
    ty = size // 2 - th // 2 - bb[1]
    # Subtle drop shadow
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.text((tx + int(size * 0.015), ty + int(size * 0.015)),
            text, fill=(0, 0, 0, 90), font=h_font)
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=size * 0.012))
    img.alpha_composite(shadow)
    draw = ImageDraw.Draw(img)
    draw.text((tx, ty), text, fill=WHITE, font=h_font)
    return img


# =====================================================================
# OPTION D — Map pin shape AS the letter, no text inside.
#           Pin shape with a clean white dot/circle cutout in the head
#           (mirrors Pinterest / Reddit: distinctive single silhouette)
# =====================================================================
def option_d(size=1024):
    img = squircle_bg(size, (250, 245, 235)).convert("RGBA")
    cx, cy = size // 2, int(size * 0.42)
    radius = int(size * 0.34)
    # Gradient pin
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    stamp_pin(md, cx, cy, radius, 255)
    grad = vertical_gradient((size, size), (255, 130, 90), (220, 50, 80)).convert("RGBA")
    img.paste(grad, (0, 0), mask=mask)
    # Big clean white circle cutout (Google-pin style)
    draw = ImageDraw.Draw(img)
    cr = int(radius * 0.38)
    draw.ellipse((cx - cr, cy - cr, cx + cr, cy + cr), fill=(250, 245, 235))
    return img


def main():
    for name, fn in [
        ("option_a_sunset_pin_H", option_a),
        ("option_b_navy_pin_H", option_b),
        ("option_c_pure_cursive_H", option_c),
        ("option_d_pin_dot_only", option_d),
    ]:
        img = fn(1024)
        img.save(os.path.join(OUT, f"{name}.png"))
        img.resize((144, 144), Image.LANCZOS).save(
            os.path.join(OUT, f"{name}_thumb.png"))
        print(f"  {name}.png")


if __name__ == "__main__":
    main()
