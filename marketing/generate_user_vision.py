"""
Hi Again — the USER'S vision.
- Cream background
- Big red glossy map pin
- White cursive 'Hi' overflowing the pin head (Pacifico)
- Blue italic 'again' tucked top-right
- Monopoly-style cityscape silhouette UNDER the pin
- 512x512 square format for Play Store
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = "/app/marketing/play_assets"
os.makedirs(OUT, exist_ok=True)

PACIFICO = "/app/marketing/fonts/Pacifico-Regular.ttf"
DANCING = "/app/marketing/fonts/DancingScript.ttf"

CREAM = (245, 239, 228)
PIN_TOP = (235, 65, 90)
PIN_MID = (220, 45, 75)
PIN_BOTTOM = (190, 30, 60)
PIN_HIGHLIGHT = (255, 130, 145)
WHITE = (255, 255, 255)
BLUE_SCRIPT = (76, 130, 230)
CITY_DARK = (140, 30, 50)     # darker rose for cityscape, matches pin
CITY_MED = (170, 50, 70)
WINDOW = (245, 220, 180)      # warm window glow


def get_font(paths, size):
    for p in paths + [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


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


def draw_pin_path(draw, cx, cy, radius, fill):
    """Plump map-pin with rounded head + tapered tail."""
    bbox = (cx - radius, cy - radius, cx + radius, cy + radius)
    tail_h = int(radius * 1.30)
    tail_tip = (cx, cy + radius + tail_h)
    tail_l = (cx - int(radius * 0.55), cy + int(radius * 0.55))
    tail_r = (cx + int(radius * 0.55), cy + int(radius * 0.55))
    draw.ellipse(bbox, fill=fill)
    draw.polygon([tail_l, tail_r, tail_tip], fill=fill)


def draw_monopoly_skyline(canvas, baseline_y, width, color_dark, color_med):
    """Tiny Monopoly-style building silhouettes along baseline.
    baseline_y = y coord of the ground.
    width = horizontal span across which buildings sit.
    """
    d = ImageDraw.Draw(canvas)
    cx = canvas.size[0] // 2
    left = cx - width // 2
    # Define each building as (x_offset, building_width, height, style)
    # style: 'flat', 'peak' (triangle roof), 'mansion' (stepped)
    buildings = [
        (0.00, 0.10, 0.42, 'peak', color_med),       # small house left
        (0.11, 0.16, 0.78, 'flat', color_dark),      # tall building
        (0.28, 0.13, 0.55, 'peak', color_med),       # medium house
        (0.42, 0.18, 0.90, 'mansion', color_dark),   # tall mansion center-right
        (0.62, 0.11, 0.45, 'flat', color_med),       # small flat
        (0.74, 0.14, 0.65, 'peak', color_dark),      # mid house
        (0.89, 0.10, 0.38, 'flat', color_med),       # small flat right
    ]
    max_h = int(width * 0.42)  # tallest building proportional to skyline width

    for (x_off, w_frac, h_frac, style, color) in buildings:
        bx = left + int(x_off * width)
        bw = max(int(w_frac * width), 4)
        bh = int(h_frac * max_h)
        top = baseline_y - bh
        if style == 'flat':
            d.rectangle((bx, top, bx + bw, baseline_y), fill=color)
        elif style == 'peak':
            # rectangle body + triangle roof
            body_top = top + int(bh * 0.30)
            d.rectangle((bx, body_top, bx + bw, baseline_y), fill=color)
            d.polygon([(bx - 2, body_top),
                       (bx + bw + 2, body_top),
                       (bx + bw // 2, top)], fill=color)
        elif style == 'mansion':
            # two-step Monopoly hotel style
            step = int(bh * 0.30)
            d.rectangle((bx, top + step, bx + bw, baseline_y), fill=color)
            d.rectangle((bx + int(bw * 0.25), top,
                         bx + int(bw * 0.75), top + step + 2),
                        fill=color)

        # Tiny window dots for taller buildings
        if bh > max_h * 0.5:
            win_size = max(2, int(bw * 0.10))
            margin = max(2, int(bw * 0.18))
            wy = top + int(bh * 0.35)
            while wy < baseline_y - margin:
                wx = bx + margin
                while wx + win_size < bx + bw - margin:
                    d.rectangle((wx, wy, wx + win_size, wy + win_size),
                                fill=WINDOW)
                    wx += win_size * 2
                wy += win_size * 2


def build_icon(size=1024):
    # Cream background
    canvas = Image.new("RGBA", (size, size), CREAM + (255,))

    # ----- Pin: composite of base shape + highlight + shadow -----
    pin_radius = int(size * 0.26)
    cx = size // 2
    cy = int(size * 0.42)

    # Drop shadow under pin
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    draw_pin_path(sd, cx, cy + int(size * 0.015), pin_radius,
                  (0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.022))
    canvas.alpha_composite(shadow)

    # Pin fill (gradient via mask)
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    draw_pin_path(md, cx, cy, pin_radius, 255)
    grad = vgrad((size, size), PIN_TOP, PIN_BOTTOM).convert("RGBA")
    pin_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pin_layer.paste(grad, (0, 0), mask=mask)

    # Soft top highlight on the pin (glossy curve)
    highlight = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(highlight)
    hd.ellipse(
        (cx - int(pin_radius * 0.55), cy - int(pin_radius * 0.85),
         cx + int(pin_radius * 0.55), cy - int(pin_radius * 0.15)),
        fill=(255, 255, 255, 65),
    )
    highlight = highlight.filter(ImageFilter.GaussianBlur(size * 0.012))
    # Mask the highlight to inside the pin
    h_alpha = highlight.split()[-1]
    # Multiply highlight's alpha by pin mask so highlight only shows inside the pin
    combined = Image.new("L", (size, size), 0)
    combined.paste(h_alpha, (0, 0), mask=mask)
    highlight.putalpha(combined)
    pin_layer = Image.alpha_composite(pin_layer, highlight)
    canvas.alpha_composite(pin_layer)

    # ----- Monopoly skyline under the pin -----
    pin_tail_bottom = cy + pin_radius + int(pin_radius * 1.30)
    # baseline below the pin's tail, but with some gap
    baseline_y = pin_tail_bottom + int(size * 0.04)
    if baseline_y > int(size * 0.92):
        baseline_y = int(size * 0.92)
    sky_width = int(size * 0.78)
    draw_monopoly_skyline(canvas, baseline_y, sky_width,
                          CITY_DARK, CITY_MED)

    # Soft ground shadow line beneath the city
    d = ImageDraw.Draw(canvas)
    d.ellipse(
        (cx - int(sky_width * 0.50), baseline_y - int(size * 0.012),
         cx + int(sky_width * 0.50), baseline_y + int(size * 0.020)),
        fill=(200, 180, 160, 80),
    )

    # ----- 'Hi' cursive, big, overflowing the pin -----
    draw = ImageDraw.Draw(canvas)
    hi_font = get_font([PACIFICO], int(size * 0.50))
    hi_text = "Hi"
    hb = draw.textbbox((0, 0), hi_text, font=hi_font)
    hw, hh = hb[2] - hb[0], hb[3] - hb[1]
    hx = cx - hw // 2 - hb[0] - int(size * 0.01)
    hy = cy - hh // 2 - hb[1] - int(size * 0.02)

    # Soft drop shadow on "Hi"
    text_sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tsd = ImageDraw.Draw(text_sh)
    tsd.text((hx + int(size * 0.012), hy + int(size * 0.012)),
             hi_text, fill=(0, 0, 0, 110), font=hi_font)
    text_sh = text_sh.filter(ImageFilter.GaussianBlur(size * 0.010))
    canvas.alpha_composite(text_sh)

    draw = ImageDraw.Draw(canvas)
    draw.text((hx, hy), hi_text, fill=WHITE, font=hi_font)

    # ----- 'again' blue cursive, top-right of pin -----
    again_font = get_font([DANCING], int(size * 0.13))
    again_text = "again"
    ab = draw.textbbox((0, 0), again_text, font=again_font)
    aw, ah = ab[2] - ab[0], ab[3] - ab[1]
    ax = cx + int(pin_radius * 0.30) - ab[0]
    ay = cy - int(pin_radius * 0.65) - ab[1]
    # Slight rotation effect by drawing twice with subtle blue blend
    draw.text((ax, ay), again_text, fill=BLUE_SCRIPT, font=again_font)

    return canvas


def ImageOps_composite_alpha(layer, mask):
    """Combine layer's current alpha with mask, returning new alpha band."""
    layer_alpha = layer.split()[-1]
    return Image.eval(
        Image.merge("LL", (layer_alpha, mask)).convert("L"),
        lambda p: p
    )


def build_feature_graphic():
    W, H = 1024, 500
    img = Image.new("RGB", (W, H), CREAM)

    # Soft sunset glow behind the pin area
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-100, -100, 600, 700), fill=(255, 130, 100, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    img.paste(glow, (0, 0), glow)

    # Place icon on left
    icon = build_icon(480).convert("RGBA")
    img.paste(icon, (10, 10), icon)

    # Right side: copy
    draw = ImageDraw.Draw(img)
    title_font = get_font([PACIFICO], 84)
    again_font = get_font([DANCING], 50)
    sub_font = get_font([], 26)
    tag_font = get_font([DANCING], 32)

    draw.text((520, 120), "Hi", fill=PIN_TOP, font=title_font)
    tb = draw.textbbox((520, 120), "Hi", font=title_font)
    draw.text((tb[2] + 14, 155), "again", fill=BLUE_SCRIPT, font=again_font)

    draw.text((520, 250), "Reconnect with the people",
              fill=(60, 35, 45), font=sub_font)
    draw.text((520, 286), "you actually crossed paths with.",
              fill=(60, 35, 45), font=sub_font)
    draw.rectangle((520, 348, 590, 354), fill=PIN_TOP)
    draw.text((520, 370), "By city · By event · By GPS",
              fill=BLUE_SCRIPT, font=tag_font)

    return img


def main():
    icon = build_icon(1024)
    icon.save(os.path.join(OUT, "icon_user_1024.png"))
    icon.resize((512, 512), Image.LANCZOS).save(
        os.path.join(OUT, "icon_user_512.png"))
    feat = build_feature_graphic()
    feat.save(os.path.join(OUT, "feature_user_1024x500.png"))
    print("Generated user-vision assets:")
    for fn in ["icon_user_512.png", "icon_user_1024.png",
               "feature_user_1024x500.png"]:
        p = os.path.join(OUT, fn)
        print(f"  {p}  ({os.path.getsize(p)//1024} KB)")


if __name__ == "__main__":
    main()
