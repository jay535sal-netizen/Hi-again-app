"""
Hi Again — Play Store icon + feature graphic.
v3 design: stylized map background + smaller pin + cursive Hi again + accent
crossing pins. Built to feel premium and scroll-stoppable on IG / FB.
"""
import os
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = "/app/marketing/play_assets"
os.makedirs(OUT, exist_ok=True)

# --- Palette ---
MAP_BG_TOP = (252, 244, 230)       # warm cream
MAP_BG_BOTTOM = (235, 220, 200)    # warmer beige
STREET_LIGHT = (255, 251, 240)     # near-white streets
BLOCK_FILL = (230, 215, 195)       # soft beige blocks
WATER_BLUE = (180, 215, 230)       # subtle water/park hint
PARK_GREEN = (190, 215, 175)       # subtle green patch

PIN_TOP = (235, 75, 95)            # rose-red top
PIN_BOTTOM = (200, 40, 60)         # deeper rose-red base
PIN_INNER_DOT = (255, 255, 255)
ACCENT_PIN = (255, 165, 80)        # tangerine smaller pins
ACCENT_PIN_2 = (120, 200, 230)     # cool blue smaller pin
WHITE = (255, 255, 255)
NAVY = (11, 18, 32)
TEXT_BLUE = (66, 122, 220)

PACIFICO = "/app/marketing/fonts/Pacifico-Regular.ttf"
DANCING = "/app/marketing/fonts/DancingScript.ttf"
CAVEAT = "/app/marketing/fonts/Caveat.ttf"


def get_font(paths, size):
    fallbacks = [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    ]
    for p in paths + fallbacks:
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


def draw_stylized_map(size, seed=7):
    """A clean, slightly isometric stylized map with city blocks,
    diagonal streets, a park, and a tiny river bend."""
    rng = random.Random(seed)
    canvas = vertical_gradient((size, size), MAP_BG_TOP, MAP_BG_BOTTOM).convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    # --- A soft river bend in upper-left ---
    river = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(river)
    rdraw.polygon([
        (-50, int(size * 0.05)),
        (int(size * 0.30), int(size * 0.10)),
        (int(size * 0.42), int(size * 0.22)),
        (int(size * 0.30), int(size * 0.34)),
        (int(size * 0.05), int(size * 0.32)),
        (-50, int(size * 0.40)),
    ], fill=WATER_BLUE + (180,))
    river = river.filter(ImageFilter.GaussianBlur(radius=size * 0.004))
    canvas.alpha_composite(river)

    # --- A soft park patch in lower-right ---
    park = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(park)
    pdraw.ellipse((
        int(size * 0.62), int(size * 0.70),
        int(size * 1.05), int(size * 1.10),
    ), fill=PARK_GREEN + (200,))
    park = park.filter(ImageFilter.GaussianBlur(radius=size * 0.008))
    canvas.alpha_composite(park)

    # --- City blocks: subtle warm-beige rounded rectangles in a grid ---
    blocks = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(blocks)
    grid_cols, grid_rows = 6, 6
    cell = size / grid_cols
    pad = int(cell * 0.18)
    for r in range(grid_rows):
        for c in range(grid_cols):
            # Skip some blocks for visual variety / streets
            if (r + c) % 5 == 0:
                continue
            if r == 0 and c < 3:        # let the river breathe
                continue
            if r >= 4 and c >= 4:       # park area
                continue
            x0 = int(c * cell + pad)
            y0 = int(r * cell + pad)
            x1 = int((c + 1) * cell - pad)
            y1 = int((r + 1) * cell - pad)
            # Slight randomization for organic feel
            jitter = int(cell * 0.04)
            x0 += rng.randint(-jitter, jitter)
            y0 += rng.randint(-jitter, jitter)
            radius = int(cell * 0.10)
            bdraw.rounded_rectangle((x0, y0, x1, y1),
                                    radius=radius,
                                    fill=BLOCK_FILL + (235,))
    canvas.alpha_composite(blocks)

    # --- Two diagonal "main streets" crossing through the center ---
    streets = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(streets)
    street_w = int(size * 0.045)
    # diagonal NW->SE
    sdraw.line([(-int(size * 0.1), int(size * 0.30)),
                (size + int(size * 0.1), int(size * 0.80))],
               fill=STREET_LIGHT + (255,), width=street_w)
    # diagonal SW->NE
    sdraw.line([(-int(size * 0.1), int(size * 0.80)),
                (size + int(size * 0.1), int(size * 0.20))],
               fill=STREET_LIGHT + (255,), width=street_w)
    # horizontal lower main street
    sdraw.line([(0, int(size * 0.62)),
                (size, int(size * 0.66))],
               fill=STREET_LIGHT + (255,), width=int(street_w * 0.8))
    canvas.alpha_composite(streets)

    # --- Tiny dashed "path" suggesting a user's route through the city ---
    path = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(path)
    dash_color = (200, 95, 110, 200)
    # an arc-ish dashed path that ends near the main pin location
    cx, cy = int(size * 0.50), int(size * 0.50)
    for i in range(14):
        t0 = 0.10 + i * 0.045
        if t0 > 0.50:
            break
        ang = math.pi * 0.85 + t0 * math.pi * 1.2
        radius = size * (0.55 - t0 * 0.6)
        x = cx + math.cos(ang) * radius
        y = cy + math.sin(ang) * radius * 0.6
        r = max(int(size * 0.011), 4)
        pdraw.ellipse((x - r, y - r, x + r, y + r), fill=dash_color)
    canvas.alpha_composite(path)

    return canvas


def draw_pin(target, cx, cy, head_radius, fill_top, fill_bottom,
             outline_white=True, inner_dot=True):
    """Draws a glossy map-pin shape onto `target` (RGBA Image).
    Center cx,cy is the center of the head; tail extends down.
    """
    W, H = target.size
    # Outline layer (slightly larger white pin)
    if outline_white:
        outline = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        odraw = ImageDraw.Draw(outline)
        _stamp_pin(odraw, cx, cy, int(head_radius * 1.08), WHITE)
        # Soft drop shadow beneath whole pin
        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sdraw = ImageDraw.Draw(shadow)
        _stamp_pin(sdraw, cx, cy + int(head_radius * 0.08),
                   int(head_radius * 1.08),
                   (0, 0, 0, 110))
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=W * 0.018))
        target.alpha_composite(shadow)
        target.alpha_composite(outline)

    # Gradient-filled pin via mask
    mask = Image.new("L", (W, H), 0)
    mdraw = ImageDraw.Draw(mask)
    _stamp_pin(mdraw, cx, cy, head_radius, 255)

    grad = vertical_gradient((W, H), fill_top, fill_bottom).convert("RGBA")
    target.paste(grad, (0, 0), mask=mask)

    # Inner white dot
    if inner_dot:
        d = ImageDraw.Draw(target)
        ir = int(head_radius * 0.32)
        d.ellipse((cx - ir, cy - ir, cx + ir, cy + ir), fill=PIN_INNER_DOT)


def _stamp_pin(draw, cx, cy, radius, fill):
    bbox = (cx - radius, cy - radius, cx + radius, cy + radius)
    tail_h = int(radius * 1.45)
    tail_tip = (cx, cy + radius + tail_h)
    tail_l = (cx - int(radius * 0.62), cy + int(radius * 0.50))
    tail_r = (cx + int(radius * 0.62), cy + int(radius * 0.50))
    draw.ellipse(bbox, fill=fill)
    draw.polygon([tail_l, tail_r, tail_tip], fill=fill)


def draw_small_pin(target, cx, cy, radius, fill):
    """Tiny accent pin (no outline) for the 'other people you crossed' dots."""
    W, H = target.size
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    _stamp_pin(sdraw, cx + 2, cy + 3, radius, (0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=3))
    target.alpha_composite(shadow)
    d = ImageDraw.Draw(target)
    _stamp_pin(d, cx, cy, radius, fill + (255,))
    ir = max(int(radius * 0.36), 2)
    d.ellipse((cx - ir, cy - ir, cx + ir, cy + ir), fill=WHITE)


def build_icon(size=1024):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    map_layer = draw_stylized_map(size)
    canvas = Image.alpha_composite(canvas, map_layer)

    # Main pin slightly above center, sized to leave map visible
    head_radius = int(size * 0.20)
    cx = int(size * 0.50)
    cy = int(size * 0.42)
    draw_pin(canvas, cx, cy, head_radius, PIN_TOP, PIN_BOTTOM)

    # Accent crossing pins
    draw_small_pin(canvas, int(size * 0.22), int(size * 0.30),
                   int(size * 0.045), ACCENT_PIN)
    draw_small_pin(canvas, int(size * 0.78), int(size * 0.25),
                   int(size * 0.040), ACCENT_PIN_2)
    draw_small_pin(canvas, int(size * 0.30), int(size * 0.78),
                   int(size * 0.045), ACCENT_PIN)
    draw_small_pin(canvas, int(size * 0.80), int(size * 0.78),
                   int(size * 0.050), ACCENT_PIN_2)

    # --- "Hi" cursive script, sized to sit cleanly above the pin row ---
    draw = ImageDraw.Draw(canvas)
    hi_font = get_font([PACIFICO], int(size * 0.20))
    hi_text = "Hi"
    hb = draw.textbbox((0, 0), hi_text, font=hi_font)
    hw, hh = hb[2] - hb[0], hb[3] - hb[1]
    hx = int(size * 0.18)
    hy = int(size * 0.10)
    # White card behind script text so it pops over the map
    pad_x, pad_y = int(size * 0.04), int(size * 0.02)
    card = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(card)
    again_font = get_font([DANCING, CAVEAT], int(size * 0.10))
    ag = draw.textbbox((0, 0), "again", font=again_font)
    aw, ah = ag[2] - ag[0], ag[3] - ag[1]
    text_block_w = hw + int(size * 0.02) + aw
    card_rect = (
        hx - pad_x,
        hy - pad_y,
        hx - pad_x + text_block_w + pad_x * 2,
        hy + hh + pad_y,
    )
    cdraw.rounded_rectangle(card_rect, radius=int(size * 0.03),
                            fill=(255, 255, 255, 230))
    card = card.filter(ImageFilter.GaussianBlur(radius=1))
    canvas.alpha_composite(card)

    draw = ImageDraw.Draw(canvas)
    draw.text((hx - hb[0], hy - hb[1]), hi_text,
              fill=PIN_BOTTOM, font=hi_font)
    # "again" lowercase in blue cursive, baseline-aligned with "Hi"
    ax = hx + hw + int(size * 0.02) - ag[0]
    ay = hy + hh - ah - ag[1] + int(size * 0.005)
    draw.text((ax, ay), "again", fill=TEXT_BLUE, font=again_font)

    return canvas


def build_feature_graphic():
    W, H = 1024, 500
    img = Image.new("RGB", (W, H), (245, 235, 215))
    # Map background, but stretched
    icon_full = build_icon(800).convert("RGBA")
    # Crop the icon (it's square) onto the right side of the banner
    img.paste(icon_full.resize((500, 500)), (524, 0),
              icon_full.resize((500, 500)))

    # Left side: brand panel
    panel = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Sunset gradient on a 550-wide strip
    grad = vertical_gradient((550, H), (255, 165, 90), (220, 60, 80)).convert("RGBA")
    # Build a fade mask the same size as the gradient
    fade = Image.new("L", (550, H), 255)
    fdraw = ImageDraw.Draw(fade)
    for x in range(460, 550):
        alpha = max(0, 255 - int((x - 460) * 3))
        fdraw.line([(x, 0), (x, H)], fill=alpha)
    grad.putalpha(fade)
    panel.paste(grad, (0, 0), grad)
    img.paste(panel, (0, 0), panel)

    draw = ImageDraw.Draw(img)
    title_font = get_font([PACIFICO], 90)
    sub_font = get_font([], 28)
    cta_font = get_font([DANCING, CAVEAT], 36)

    # Title
    draw.text((50, 95), "Hi", fill=WHITE, font=title_font)
    tb = draw.textbbox((0, 0), "Hi", font=title_font)
    hi_w = tb[2] - tb[0]
    draw.text((60 + hi_w, 130), "again",
              fill=(255, 220, 180), font=cta_font)
    # Subtitle
    draw.text((50, 230),
              "Reconnect with the people",
              fill=WHITE, font=sub_font)
    draw.text((50, 268),
              "you actually crossed paths with.",
              fill=WHITE, font=sub_font)
    # Accent bar
    draw.rectangle((50, 330, 130, 336), fill=WHITE)
    draw.text((50, 350), "By city · By event · By GPS",
              fill=(255, 240, 220), font=sub_font)

    return img


def main():
    icon = build_icon(1024)
    icon.save(os.path.join(OUT, "icon_1024.png"))
    icon.resize((512, 512), Image.LANCZOS).save(
        os.path.join(OUT, "icon_512.png"))
    build_feature_graphic().save(os.path.join(OUT, "feature_1024x500.png"))
    print("Generated:")
    for fn in sorted(os.listdir(OUT)):
        full = os.path.join(OUT, fn)
        print(f"  {full}  ({os.path.getsize(full)//1024} KB)")


if __name__ == "__main__":
    main()
