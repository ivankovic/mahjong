# Turtle Mahjong

Mahjong solitaire on the classic 144-tile turtle layout, in the browser.

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
- `assets/tiles.svg`: the 42 tile faces, one `<symbol>` each

## Deployment

`.github/workflows/pages.yml` publishes the site to GitHub Pages on every
push to `main`. In the repository's Settings → Pages, the source must be
"GitHub Actions".

## License

- Code: [AGPL-3.0-or-later](LICENSE).
- Art (`assets/`): [CC-BY-NC-ND-4.0](LICENSES/CC-BY-NC-ND-4.0.txt).

See [`REUSE.toml`](REUSE.toml) for the per-path license mapping.
