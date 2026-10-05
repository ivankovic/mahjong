# Turtle Mahjong

Mahjong solitaire on the classic 144-tile turtle layout, in the browser.

It comes with five tile styles: Classic, and four for kids: Dog Park,
Chameleon Jungle, Coral Reef and Haunted Night. The kids' styles keep the
structure of a real set. There are three suits of 1 to 9 pictures to count,
each tile with its number at the top. There are seven single pictures in
place of the winds and dragons, and two groups of four in place of the
flowers and seasons, where any tile matches any other tile in its group.

Pick two free tiles with the same face to clear them. A tile is free when
nothing rests on it and its left or right side is open. Any flower matches
any flower, and any season matches any season.

Every deal can be cleared. The game deals by playing the board backwards
from full: each pair goes on two tiles that are free at the same moment, so
removing the pairs in reverse order always works. Shuffle uses the same
method on the tiles that are left.

Play it at <https://ivankovic.github.io/mahjong/>.

## Controls

| Key            | Action                                      |
| -------------- | ------------------------------------------- |
| H              | Show a matching pair (press again for another) |
| U, Ctrl+Z      | Undo the last pair or shuffle               |
| S              | Shuffle the remaining tiles                 |
| Esc            | Clear the selection                         |

The current game, your best time and the "shade blocked tiles" setting are
kept in the browser's local storage.

## Running it locally

There is no build. The page fetches `assets/tiles.svg`, so serve the folder
instead of opening `index.html` as a file:

```sh
python3 -m http.server
```

Then open <http://localhost:8000/>.

## Layout

- `index.html`: the page
- `src/game.js`: layout, dealing, rules and the board
- `src/style.css`: the table and the tiles' bodies
- `assets/themes/<style>.svg`: each style's 42 tile faces, one `<symbol>` each
- `assets/themes/themes.json`: the styles, and the names of their tiles
- `assets/src/build.mjs`: draws all of the above

The sprites are generated. To change a picture, edit `assets/src/build.mjs`
and run `node assets/src/build.mjs`, then commit both. The page's colours,
fonts and tile bodies for each style are the `[data-skin]` blocks in
`src/style.css`.

## Deployment

`.github/workflows/pages.yml` publishes the site to GitHub Pages on every
push to `main`. In the repository's Settings → Pages, the source must be
"GitHub Actions".

## License

- Code: [AGPL-3.0-or-later](LICENSE).
- Art (`assets/`, including `assets/src/build.mjs`, which is the source of the drawings): [CC-BY-NC-ND-4.0](LICENSES/CC-BY-NC-ND-4.0.txt).

See [`REUSE.toml`](REUSE.toml) for the per-path license mapping.
