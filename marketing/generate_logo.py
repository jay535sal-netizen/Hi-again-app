"""
Generates Hi Again Play Store assets based on the user's hand-drawn concept:
  - Map-pin shape (encodes GPS/proximity concept)
  - White "Hi" bold serif inside the pin
  - Blue cursive "Again" tucked top-right
  - Warm sunset gradient instead of flat red

Outputs:
  /app/marketing/play_assets/icon_512.png       (Play Store icon)
  /app/marketing/play_assets/icon_1024.png      (high-res master)
  /app/marketing/play_assets/feature_1024x500.png (Play Store feature graphic)
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = "/app/marketing/play_assets"
os.makedirs(OUT, exist_ok=True)

# --- Brand palette (Sunset Noir) ---
PIN_TOP = (255, 107, 53)       # warm sunset orange
PIN_BOTTOM = (228, 60, 78)     # deep rose-red
PIN_OUTLINE = (255, 255, 255)  # white outline
WHITE = (255, 255, 255)
ACCENT_BLUE = (76, 168, 230)   # the same friendly blue from the sketch
NAVY = (11, 18, 32)            # for feature graphic background
CREAM = (255, 248, 235)        # warm light background


def get_font(name_candidates, size):
    candidates = [
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSerifBoldItalic.ttf",
    ]
    for path in name_candidates + candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def draw_pin_path(draw, cx, cy, radius, fill, outline=None, outline_width=0):
    """Classic map-pin shape: circle on top, triangular point at bottom.
    cx,cy = center of the circular head; radius = head radius.
    """
    # Circle head
    bbox_head = (cx - radius, cy - radius, cx + radius, cy + radius)
    # Triangle tail extending down
    tail_height = int(radius * 1.4)
    tail_tip = (cx, cy + radius + tail_height)
    tail_left = (cx - int(radius * 0.55), cy + int(radius * 0.55))
    tail_right = (cx + int(radius * 0.55), cy + int(radius * 0.55))

    # Draw outline shape first if requested (offset trick)
    if outline and outline_width > 0:
        ow = outline_width
        draw.ellipse((bbox_head[0]-ow, bbox_head[1]-ow, bbox_head[2]+ow, bbox_head[3]+ow), fill=outline)
        draw.polygon([(tail_left[0]-ow, tail_left[1]), (tail_right[0]+ow, tail_right[1]),
                      (tail_tip[0], tail_tip[1]+ow)], fill=outline)

    draw.ellipse(bbox_head, fill=fill)
    draw.polygon([tail_left, tail_right, tail_tip], fill=fill)


def make_gradient(size, color_top, color_bottom):
    """Vertical linear gradient image of given size."""
    w, h = size
    base = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(color_top[0] * (1 - t) + color_bottom[0] * t)
        g = int(color_top[1] * (1 - t) + color_bottom[1] * t)
        b = int(color_top[2] * (1 - t) + color_bottom[2] * t)
        base.putpixel((0, y), (r, g, b))
    return base.resize((w, h))


def build_icon(size=1024):
    """Build the app icon at given size on a transparent background.
    Then we paste it on a solid cream square for Play Store (no alpha allowed for 512).
    """
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Background — solid soft cream square with a hint of warmth.
    # Play accepts alpha for the 512 icon, but a solid bg renders better
    # in launchers and on the Play Store grid.
    bg = Image.new("RGBA", (size, size), CREAM + (255,))
    canvas = Image.alpha_composite(canvas, bg)

    # Compose pin on a separate layer so we can apply a soft drop shadow.
    pin_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(pin_layer)

    # Pin sized to fill most of the canvas with some breathing room.
    head_radius = int(size * 0.34)
    cx = size // 2
    cy = int(size * 0.40)

    # White outline first (slightly larger pin)
    draw_pin_path(pdraw, cx, cy, head_radius + int(size * 0.012),
                  fill=WHITE)
    # Now stamp the gradient-filled pin on top using a mask.
    pin_mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(pin_mask)
    draw_pin_path(mdraw, cx, cy, head_radius, fill=255)

    gradient = make_gradient((size, size), PIN_TOP, PIN_BOTTOM).convert("RGBA")
    pin_layer.paste(gradient, (0, 0), mask=pin_mask)

    # Soft drop shadow under pin
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    draw_pin_path(sdraw, cx, cy + int(size * 0.02), head_radius,
                  fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=size * 0.025))

    canvas = Image.alpha_composite(canvas, shadow)
    canvas = Image.alpha_composite(canvas, pin_layer)

    # --- Text: big white "Hi" inside the circle head ---
    draw = ImageDraw.Draw(canvas)
    hi_font = get_font([], int(size * 0.42))
    text = "Hi"
    bbox = draw.textbbox((0, 0), text, font=hi_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = cx - tw // 2 - bbox[0]
    ty = cy - th // 2 - bbox[1] - int(size * 0.02)
    draw.text((tx, ty), text, fill=WHITE, font=hi_font)

    # --- Cursive "Again" tucked upper-right ---
    again_font = get_font(
        ["/usr/share/fonts/truetype/freefont/FreeSerifBoldItalic.ttf"],
        int(size * 0.11),
    )
    again_text = "Again"
    abbox = draw.textbbox((0, 0), again_text, font=again_font)
    aw, ah = abbox[2] - abbox[0], abbox[3] - abbox[1]
    ax = cx + int(head_radius * 0.55) - aw // 2
    ay = cy - int(head_radius * 0.85)

    # Soft white halo behind "Again" so it reads on the orange.
    halo = Image.new("RGBA", (aw + 80, ah + 80), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(halo)
    hdraw.ellipse((0, 0, aw + 80, ah + 80), fill=(255, 255, 255, 200))
    halo = halo.filter(ImageFilter.GaussianBlur(radius=12))
    canvas.alpha_composite(halo, (ax - 40, ay - 40))

    draw = ImageDraw.Draw(canvas)
    draw.text((ax, ay), again_text, fill=ACCENT_BLUE, font=again_font)

    return canvas


def build_feature_graphic():
    """1024 x 500 Play Store feature graphic. NO alpha allowed."""
    W, H = 1024, 500
    img = Image.new("RGB", (W, H), NAVY)

    # Subtle radial sunset glow behind the pin
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((-100, 100, 500, 700), fill=(255, 107, 53, 110))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=80))
    img.paste(glow, (0, 0), glow)

    # Place a smaller version of the icon on the left side
    icon = build_icon(420).convert("RGBA")
    img.paste(icon, (40, 40), icon)

    draw = ImageDraw.Draw(img)

    title_font = get_font([], 72)
    sub_font = get_font([], 30)
    cta_font = get_font(
        ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"], 24
    )

    # Headline
    draw.text((490, 140), "Hi Again", fill=WHITE, font=title_font)
    # Subhead
    sub_lines = [
        "Reconnect with the people",
        "you actually crossed paths with.",
    ]
    y = 240
    for line in sub_lines:
        draw.text((490, y), line, fill=(220, 220, 220), font=sub_font)
        y += 42

    # Soft accent line
    draw.rectangle((490, 340, 540, 346), fill=PIN_TOP)
    draw.text((490, 360), "By city · By event · By GPS",
              fill=ACCENT_BLUE, font=cta_font)

    return img


def main():
    icon_master = build_icon(1024)
    icon_master.save(os.path.join(OUT, "icon_1024.png"))
    # Play Store icon — must be 512x512 PNG, 32-bit (alpha ok).
    icon_512 = icon_master.resize((512, 512), Image.LANCZOS)
    icon_512.save(os.path.join(OUT, "icon_512.png"))

    feat = build_feature_graphic()
    feat.save(os.path.join(OUT, "feature_1024x500.png"), "PNG")

    print("Generated:")
    for fn in os.listdir(OUT):
        full = os.path.join(OUT, fn)
        print(f"  {full}  ({os.path.getsize(full)//1024} KB)")


if __name__ == "__main__":
    main()
