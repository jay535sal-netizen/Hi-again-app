"""
Hi Again — fresh non-letter icon concepts.
Goal: single mark that tells the 'two paths crossed' story
without looking like a hotel/hospital/highway sign.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter

OUT = "/app/marketing/play_assets/concepts"
os.makedirs(OUT, exist_ok=True)

WHITE = (255, 255, 255)
ROSE = (220, 60, 80)
ROSE_DEEP = (185, 35, 60)
ORANGE = (255, 130, 80)
NAVY = (11, 18, 32)
CREAM = (250, 245, 235)


def vgrad(size, top, bottom):
    w, h = size
    base = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        base.putpixel((0, y), (r, g, b))
    return base.resize((w, h))


def stamp_pin(draw, cx, cy, radius, fill, tail_mult=1.45):
    """Map pin: circle head + triangle tail."""
    bbox = (cx - radius, cy - radius, cx + radius, cy + radius)
    tail_h = int(radius * tail_mult)
    tail_tip = (cx, cy + radius + tail_h)
    tail_l = (cx - int(radius * 0.62), cy + int(radius * 0.50))
    tail_r = (cx + int(radius * 0.62), cy + int(radius * 0.50))
    draw.ellipse(bbox, fill=fill)
    draw.polygon([tail_l, tail_r, tail_tip], fill=fill)


def soft_shadow(layer, blur, opacity=120, offset=(0, 8)):
    """Returns shadow image for a given alpha layer."""
    W, H = layer.size
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    alpha = layer.split()[-1]
    shadow_mask = alpha.point(lambda a: min(opacity, a))
    shadow.putalpha(shadow_mask)
    # Fill with black where the alpha is set
    black = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    black.putalpha(shadow_mask)
    return black.filter(ImageFilter.GaussianBlur(blur))


# =========================================================
# E — TWO LINKED PINS  (two paths that crossed)
# =========================================================
def concept_e(size=1024):
    img = vgrad((size, size), (255, 145, 95), (215, 55, 80)).convert("RGBA")
    cx = size // 2
    cy = int(size * 0.40)
    r = int(size * 0.22)
    offset = int(size * 0.13)

    # Two pins side by side, slightly overlapping
    pins = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(pins)
    # Right pin (white)
    stamp_pin(d, cx + offset, cy, r, WHITE)
    # Left pin (slightly darker white for depth)
    stamp_pin(d, cx - offset, cy, r, (245, 240, 230, 255))

    sh = soft_shadow(pins, blur=size * 0.025, opacity=110)
    img.alpha_composite(sh, (0, int(size * 0.02)))
    img.alpha_composite(pins)

    # Inner dots
    d = ImageDraw.Draw(img)
    ir = int(r * 0.32)
    d.ellipse((cx - offset - ir, cy - ir, cx - offset + ir, cy + ir),
              fill=ROSE)
    d.ellipse((cx + offset - ir, cy - ir, cx + offset + ir, cy + ir),
              fill=ROSE_DEEP)
    return img


# =========================================================
# F — PIN + SONAR WAVES  (we just found someone)
# =========================================================
def concept_f(size=1024):
    img = vgrad((size, size), (40, 50, 90), (15, 22, 40)).convert("RGBA")

    cx = size // 2
    cy = int(size * 0.48)
    r = int(size * 0.20)

    # Sonar arcs above pin
    arcs = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ad = ImageDraw.Draw(arcs)
    for i, (radius, alpha) in enumerate([
        (int(size * 0.32), 50),
        (int(size * 0.40), 75),
        (int(size * 0.48), 110),
    ]):
        bbox = (cx - radius, cy - radius, cx + radius, cy + radius)
        ad.arc(bbox, start=200, end=340,
               fill=(255, 165, 90, alpha),
               width=int(size * 0.015))
    img.alpha_composite(arcs)

    # Pin (gradient orange→rose)
    pin_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    stamp_pin(md, cx, cy, r, 255)
    grad = vgrad((size, size), (255, 145, 95), (215, 55, 80)).convert("RGBA")
    pin_layer.paste(grad, (0, 0), mask=mask)

    sh = soft_shadow(pin_layer, blur=size * 0.03, opacity=150)
    img.alpha_composite(sh, (0, int(size * 0.025)))
    img.alpha_composite(pin_layer)

    # White inner dot
    d = ImageDraw.Draw(img)
    ir = int(r * 0.30)
    d.ellipse((cx - ir, cy - ir, cx + ir, cy + ir), fill=WHITE)
    return img


# =========================================================
# G — SPEECH-BUBBLE PIN  (say hi at this location)
# =========================================================
def concept_g(size=1024):
    img = Image.new("RGBA", (size, size), (250, 245, 235, 255))

    cx = size // 2
    cy = int(size * 0.40)
    r = int(size * 0.30)

    # Pin shape but slightly tilted left to feel like a speech bubble
    pin_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    # Make the tail offset to the left for speech-bubble effect
    bbox = (cx - r, cy - r, cx + r, cy + r)
    md.ellipse(bbox, fill=255)
    tail_tip = (int(cx - r * 0.65), int(cy + r * 1.30))
    tail_l = (int(cx - r * 0.45), int(cy + r * 0.55))
    tail_r = (int(cx + r * 0.05), int(cy + r * 0.85))
    md.polygon([tail_l, tail_r, tail_tip], fill=255)

    grad = vgrad((size, size), (255, 130, 90), (220, 50, 80)).convert("RGBA")
    pin_layer.paste(grad, (0, 0), mask=mask)

    sh = soft_shadow(pin_layer, blur=size * 0.03, opacity=120)
    img.alpha_composite(sh, (0, int(size * 0.025)))
    img.alpha_composite(pin_layer)

    # White text-dots inside (3 dots = chat indicator)
    d = ImageDraw.Draw(img)
    dot_r = int(r * 0.10)
    dot_y = cy + int(r * 0.05)
    for dx in [-r * 0.35, 0, r * 0.35]:
        d.ellipse((cx + dx - dot_r, dot_y - dot_r,
                   cx + dx + dot_r, dot_y + dot_r),
                  fill=WHITE)
    return img


# =========================================================
# H — TWO PATHS FORMING A HEART  (reconnection, soft)
# =========================================================
def concept_h(size=1024):
    img = vgrad((size, size), (255, 145, 100), (220, 50, 85)).convert("RGBA")

    # Two curved paths converging into a heart shape
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    line_w = int(size * 0.065)
    # Left curve
    d.arc((int(size * 0.10), int(size * 0.18),
           int(size * 0.55), int(size * 0.62)),
          start=210, end=360, fill=(255, 255, 255, 255), width=line_w)
    # Right curve
    d.arc((int(size * 0.45), int(size * 0.18),
           int(size * 0.90), int(size * 0.62)),
          start=180, end=330, fill=(255, 255, 255, 255), width=line_w)
    # Bottom V to close the heart
    d.line([(int(size * 0.15), int(size * 0.46)),
            (int(size * 0.50), int(size * 0.82))],
           fill=(255, 255, 255, 255), width=line_w)
    d.line([(int(size * 0.85), int(size * 0.46)),
            (int(size * 0.50), int(size * 0.82))],
           fill=(255, 255, 255, 255), width=line_w)

    # Two small dots at the start of each curve (people meeting)
    dot_r = int(size * 0.05)
    for cx, cy in [(int(size * 0.15), int(size * 0.42)),
                   (int(size * 0.85), int(size * 0.42))]:
        d.ellipse((cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r),
                  fill=(255, 255, 255, 255))

    sh = soft_shadow(layer, blur=size * 0.025, opacity=100)
    img.alpha_composite(sh, (0, int(size * 0.02)))
    img.alpha_composite(layer)
    return img


def main():
    for name, fn in [
        ("E_two_pins", concept_e),
        ("F_sonar_pin", concept_f),
        ("G_speech_pin", concept_g),
        ("H_two_paths_heart", concept_h),
    ]:
        img = fn(1024)
        img.save(os.path.join(OUT, f"{name}.png"))
        print(f"  {name}.png")


if __name__ == "__main__":
    main()
