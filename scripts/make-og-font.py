"""Cuts lib/og/fonts/Cairo-Bold.ttf, the share card's font (lib/og/card.tsx). Run once, by hand:

    python scripts/make-og-font.py      (needs: pip install fonttools)

1. A static Bold instance of the vendored variable Cairo (lib/report/fonts/Cairo.ttf):
   the card renderer can't read a variable font.
2. Subset to Latin, Arabic and the Arabic presentation forms (~70 KB instead of ~600 KB).
3. Map the *isolated* presentation forms (U+FE8D for alef, ...) to the plain letters' glyphs.
   Cairo leaves those code points out because a shaping engine never needs them, but
   lib/og/bidi.ts shapes Arabic itself, into presentation forms only, so the renderer
   never sees a plain Arabic letter it would try to reorder (see the notes there).

Cairo is under the SIL Open Font License with no Reserved Font Name (lib/og/fonts/OFL.txt).
"""

import os
import subprocess
import sys
import tempfile

from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "lib", "report", "fonts", "Cairo.ttf")
TARGET = os.path.join(ROOT, "lib", "og", "fonts", "Cairo-Bold.ttf")

UNICODES = "U+0020-007E,U+00A0-00FF,U+2010-2027,U+200C-200F,U+0600-06FF,U+FB50-FDFF,U+FE70-FEFF"

# Isolated presentation form -> the plain letter whose glyph is that form.
ISOLATED = {
    0xFE80: 0x0621, 0xFE81: 0x0622, 0xFE83: 0x0623, 0xFE85: 0x0624, 0xFE87: 0x0625,
    0xFE89: 0x0626, 0xFE8D: 0x0627, 0xFE8F: 0x0628, 0xFE93: 0x0629, 0xFE95: 0x062A,
    0xFE99: 0x062B, 0xFE9D: 0x062C, 0xFEA1: 0x062D, 0xFEA5: 0x062E, 0xFEA9: 0x062F,
    0xFEAB: 0x0630, 0xFEAD: 0x0631, 0xFEAF: 0x0632, 0xFEB1: 0x0633, 0xFEB5: 0x0634,
    0xFEB9: 0x0635, 0xFEBD: 0x0636, 0xFEC1: 0x0637, 0xFEC5: 0x0638, 0xFEC9: 0x0639,
    0xFECD: 0x063A, 0xFED1: 0x0641, 0xFED5: 0x0642, 0xFED9: 0x0643, 0xFEDD: 0x0644,
    0xFEE1: 0x0645, 0xFEE5: 0x0646, 0xFEE9: 0x0647, 0xFEED: 0x0648, 0xFEEF: 0x0649,
    0xFEF1: 0x064A,
    0xFB56: 0x067E, 0xFB7A: 0x0686, 0xFB8A: 0x0698, 0xFB6A: 0x06A4, 0xFB8E: 0x06A9,
    0xFB92: 0x06AF, 0xFBFC: 0x06CC,
}


def run(*args):
    subprocess.run([sys.executable, "-m", *args], check=True)


def main():
    with tempfile.TemporaryDirectory() as tmp:
        bold = os.path.join(tmp, "bold.ttf")
        run("fontTools.varLib.instancer", SOURCE, "wght=700", "slnt=0", "-o", bold)
        run(
            "fontTools.subset", bold, f"--unicodes={UNICODES}", "--layout-features=*",
            f"--output-file={TARGET}",
        )

    font = TTFont(TARGET)
    added = 0
    for table in font["cmap"].tables:
        if not table.isUnicode():
            continue
        for form, letter in ISOLATED.items():
            if form not in table.cmap and letter in table.cmap:
                table.cmap[form] = table.cmap[letter]
                added += 1
    font.save(TARGET)

    missing = [hex(f) for f, l in ISOLATED.items() if f not in font.getBestCmap()]
    if missing:
        sys.exit(f"isolated forms still unmapped: {missing}")
    print(f"{TARGET}: {os.path.getsize(TARGET)} bytes, {added} cmap entries added")


if __name__ == "__main__":
    main()
