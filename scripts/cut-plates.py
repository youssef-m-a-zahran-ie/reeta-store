"""
Take the background out of the menu plate photos, for the fixed-backdrop plate (src/store/menu/cutouts.ts).

    pip install onnxruntime pillow numpy
    # model: BiRefNet-general-lite (https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx)
    python scripts/cut-plates.py model.onnx <nut>-<sauce|plain>=<photo file> ...

Each photo is the square plate photo as uploaded in the admin (bowl on the pink background).
Writes public/menu/cut/<nut>-<sauce|plain>.webp on the same square canvas, so the bowl sits exactly
where it sat on the photo; then list the keys in CUTOUTS.
"""
import sys
import numpy as np
import onnxruntime as ort
from PIL import Image

model, pairs = sys.argv[1], sys.argv[2:]
opts = ort.SessionOptions()
opts.enable_cpu_mem_arena = False  # keeps memory low enough for small machines
opts.enable_mem_pattern = False
sess = ort.InferenceSession(model, opts, providers=["CPUExecutionProvider"])
name = sess.get_inputs()[0].name

for pair in pairs:
    key, path = pair.split("=", 1)
    im = Image.open(path).convert("RGB")
    w, h = im.size
    x = np.asarray(im.resize((1024, 1024), Image.BICUBIC)).astype(np.float32) / 255
    x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None].astype(np.float32)
    y = 1 / (1 + np.exp(-sess.run(None, {name: x})[0][0, 0]))
    alpha = Image.fromarray((y * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC).point(lambda v: 0 if v < 8 else v)
    out = im.convert("RGBA")
    out.putalpha(alpha)
    out.thumbnail((800, 800), Image.LANCZOS)
    out.save(f"public/menu/cut/{key}.webp", "WEBP", quality=90, method=6)
    print(key, out.size)
