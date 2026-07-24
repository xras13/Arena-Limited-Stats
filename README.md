# MTGA Companion

A macOS draft/sealed companion overlay for MTG Arena — an untapped.gg / 17lands
Limited companion clone. When a draft or sealed event is active, an always-on-top
overlay shows every card in the current pack (or your sealed pool) ranked by
17lands data, with your personal 17lands win% / play% per card once connected.

## How it works

- Tails `~/Library/Logs/Wizards Of The Coast/MTGA/Player.log` (read-only; the same
  source untapped.gg uses). No game hooks, no ToS-sensitive injection.
- Pack contents arrive via `Draft.Notify` log lines; picks via
  `EventPlayerDraftMakePick`; sealed pools via the event course card pool.
- Aggregate ratings come from `17lands.com/card_ratings/data` (cached 24h per
  set/format). The payload includes `mtga_id`, which doubles as the card database;
  Scryfall's per-arena-id endpoint is the fallback for cards 17lands doesn't track.
- If the event's exact 17lands format has too small a sample (e.g. PickTwoDraft),
  ratings fall back to Premier Draft and the header shows `data: PremierDraft`.
- Personal stats (UNOFFICIAL): Settings → "Connect 17lands account" opens a login
  window; the app then aggregates your per-card win%/play% from your 17lands deck
  history using the site's internal endpoints. If 17lands changes their site this
  feature degrades gracefully — the rest of the app is unaffected.

## Commands

```sh
npm run dev                     # run with renderer hot reload
npm test                        # vitest (parser/store/join, uses the real log fixture)
npm run replay -- <Player.log>  # headless: replay any Arena log, print rated tables
npm run build                   # compile main/preload/renderer to out/
npm run dist                    # build MTGA Companion.app / dmg into dist/
npx electron out/main/index.js --simulate test/fixtures/pick2draft-msh-player.log
                                # drive the full UI from a captured log, no Arena needed
```

## Overlay behavior

- Always-on-top (`screen-saver` level) and joins fullscreen spaces, so it floats
  over Arena in fullscreen. This requires the app to have no Dock icon
  (`app.dock.hide()`); quit it from the window's ⚙ pane or Activity Monitor.
- Drag by the title strip; position, size, and opacity persist.

## Column key

GIH WR (games-in-hand win rate, the primary sort), ALSA (average last seen at),
OH (opening-hand win rate). "You W/P" = your personal win% / play% for the card.

## Notes

- `test/fixtures/*.log` are real Arena logs (they contain your account display
  name) and are gitignored.
- Data courtesy of 17lands.com and Scryfall; this is a personal tool — keep
  request volume low (everything is disk-cached).
