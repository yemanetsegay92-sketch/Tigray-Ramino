TIGRAY RAMINO – FIXED 10-FILE VERSION

The previous ZIP accidentally contained only the README/snippet and not the
actual JavaScript files. This ZIP contains the real 10 JavaScript files.

Folder:
js/
  config.js
  state.js
  cards.js
  validation.js
  joker.js
  monte.js
  game.js
  render.js
  drag.js
  main.js

HTML:
Remove the old:
<script src="script.js"></script>

Then use the exact script order in script-order.txt.

IMPORTANT:
If your HTML is in the same folder as the js folder, use:
<script src="js/config.js"></script>
...
<script src="js/main.js"></script>

The drag/drop implementation cleans up the drag ghost BEFORE opening,
adding, or discarding, so the ghost cards should not remain on screen.

The code uses window.TigrayRamino internally so the ten files can share the
same game state without ES-module configuration.
