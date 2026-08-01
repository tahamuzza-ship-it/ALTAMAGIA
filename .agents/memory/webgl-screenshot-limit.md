---
name: WebGL not available in Screenshot tool
description: The headless screenshot browser cannot create a WebGL context — 3D canvases (three.js) render as a runtime error overlay.
---
The Screenshot tool's browser fails with "THREE.WebGLRenderer: Error creating WebGL context".

**Why:** headless environment lacks GPU/WebGL support.

**How to apply:** don't try to visually verify three.js / react-three-fiber scenes via screenshots. Verify with typecheck + code review, and let the user confirm visuals in their real browser. Avoid flipping UI defaults to 3D just for a screenshot — it won't render.
