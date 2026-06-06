"""
Polish raw Play Store screenshots:
 - Crop out 'Made with Emergent' badge (bottom 80px)
 - Resize/pad to canonical 1080x1920 for Play Console
 - Add a soft brand headline overlay at the top
"""
import os
from PIL import Image, ImageDraw, ImageFont

SRC = "/app/marketing/play_assets/screenshots"
OUT = "/app/marketing/play_assets/screenshots_final"
os.makedirs(OUT, exist_ok=True)

PACIFICO = "/app/marketing/fonts/Pacifico-Regular.ttf"
DANCING = "/app/marketing/fonts/DancingScript.ttf"

BG = (8, 11, 22)            # match app's midnight bg
ACCENT = (255, 124, 74)     # sunset orange
BLUE = (76, 130, 230)       # cursive 'again' blue
WHITE = (255, 255, 255)

# (source filename, headline, accent-script)
SCREENS = [
    ("01_dashboard.png", "Your serendipity dashboard.", "Hi again."),
    ("02_discover.png", "Swipe right to say hi.", "Real people. Real moments."),
    ("04_premium.png", "Unlock unlimited connections.", "Go Premium."),
    ("05_profile.png", "Earn badges. Build a rep.", "Be a Connector."),
]


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


def process(src_path, headline, accent, out_path):
    img = Image.open(src_path).convert("RGB")
    w, h = img.size
    # Crop out bottom 80px (the Emergent badge)
    img = img.crop((0, 0, w, h - 80))

    # Canonical Play Store phone screenshot: 1080x1920 (9:16)
    target_w, target_h = 1080, 1920
    canvas = Image.new("RGB", (target_w, target_h), BG)

    # Resize the cropped app screenshot to fit, leaving 320px headline area on top
    avail_h = target_h - 380   # 380px reserved for headline at top + small bottom padding
    src_ratio = img.size[0] / img.size[1]
    new_h = avail_h
    new_w = int(new_h * src_ratio)
    if new_w > target_w - 100:
        new_w = target_w - 100
        new_h = int(new_w / src_ratio)
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    # Rounded corner mask for the screenshot panel
    radius = 60
    rounded = Image.new("RGBA", (new_w, new_h), (0, 0, 0, 0))
    mask = Image.new("L", (new_w, new_h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, new_w, new_h), radius=radius, fill=255)
    rounded.paste(resized, (0, 0))
    rounded.putalpha(mask)

    # Drop shadow under the screenshot card
    from PIL import ImageFilter
    shadow = Image.new("RGBA", (new_w + 80, new_h + 80), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((40, 40, new_w + 40, new_h + 40),
                         radius=radius, fill=(0, 0, 0, 160))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))

    screen_x = (target_w - new_w) // 2
    screen_y = 340

    canvas_rgba = canvas.convert("RGBA")
    canvas_rgba.alpha_composite(shadow, (screen_x - 40, screen_y - 20))
    canvas_rgba.alpha_composite(rounded, (screen_x, screen_y))

    # ---- Headline overlay (top) ----
    draw = ImageDraw.Draw(canvas_rgba)
    # Soft accent gradient line at top
    grad = Image.new("RGBA", (target_w, 6), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for x in range(target_w):
        t = abs(x - target_w / 2) / (target_w / 2)
        alpha = int(255 * (1 - t * t))
        r, g, b = ACCENT
        gd.line([(x, 0), (x, 5)], fill=(r, g, b, alpha))
    canvas_rgba.alpha_composite(grad, (0, 100))

    # Big serif headline
    headline_font = get_font([
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    ], 64)
    # Word wrap headline if too long
    lines = []
    words = headline.split()
    cur = ""
    for word in words:
        test = (cur + " " + word).strip()
        bb = draw.textbbox((0, 0), test, font=headline_font)
        if bb[2] - bb[0] > target_w - 140 and cur:
            lines.append(cur)
            cur = word
        else:
            cur = test
    if cur:
        lines.append(cur)

    y = 150
    for line in lines:
        bb = draw.textbbox((0, 0), line, font=headline_font)
        lw = bb[2] - bb[0]
        draw.text(((target_w - lw) // 2 - bb[0], y),
                  line, fill=WHITE, font=headline_font)
        y += 78

    # Accent cursive subtitle
    sub_font = get_font([DANCING, PACIFICO], 56)
    sb = draw.textbbox((0, 0), accent, font=sub_font)
    sw = sb[2] - sb[0]
    draw.text(((target_w - sw) // 2 - sb[0], y + 6),
              accent, fill=BLUE, font=sub_font)

    canvas_rgba.convert("RGB").save(out_path, "PNG", optimize=True)


def main():
    for idx, (fn, headline, accent) in enumerate(SCREENS, 1):
        src = os.path.join(SRC, fn)
        out = os.path.join(OUT, f"screenshot_{idx}_{fn.split('_', 1)[1]}")
        process(src, headline, accent, out)
        size_kb = os.path.getsize(out) // 1024
        print(f"  {out}  ({size_kb} KB)")
    print("DONE")


if __name__ == "__main__":
    main()
