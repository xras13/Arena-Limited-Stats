# Arena Limited Stats

A draft/sealed companion overlay for MTG Arena — an untapped.gg / 17lands
Limited companion clone. When a draft or sealed event is active, an always-on-top
overlay shows every card in the current pack (or your sealed pool) ranked by
17lands data, with your personal 17lands win% / play% per card once connected.

Runs on macOS (Apple Silicon) and Windows. Prebuilt test builds and install
instructions live in [TESTERS.md](TESTERS.md).

## How it works

- Tails Arena's `Player.log` (read-only; the same source untapped.gg uses). No game
  hooks, no ToS-sensitive injection. Per-OS locations live in `src/main/platform.ts`:
  `~/Library/Logs/Wizards Of The Coast/MTGA/` on macOS,
  `%USERPROFILE%\AppData\LocalLow\Wizards Of The Coast\MTGA\` on Windows.
- The tailer polls the file every second in addition to watching it, because macOS
  does not report in-place appends to a file Arena holds open.
- Pack contents arrive via `Draft.Notify` log lines; picks via
  `EventPlayerDraftMakePick`; quick drafts via `BotDraftDraftPick`; sealed pools via
  the event course card pool from `EventGetCoursesV2`.
- Event names are scanned rather than split positionally, so Arena Direct events
  (`ArenaDirect_HOB_Collector_Sealed_20260814`) resolve their format and set correctly.
- Sealed and finished-draft pools merge duplicate copies into a `2x` badge and hide
  basic lands.
- Aggregate ratings come from 17lands' card data API (cached 24h per set/format).
  The payload includes `mtga_id`, which doubles as the card database; Scryfall's
  per-arena-id endpoint is the next fallback, and Arena's own shipped card database
  (`Raw_CardDatabase_*.mtga`, read via `node:sqlite`) is the last one — it knows every
  grpId the game does, including basics and sets Scryfall hasn't mapped yet.
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
npm run dist                    # build Arena Limited Stats.app / dmg into dist/
npm run dist:win                # build the Windows installer + portable zip
npm run dist:all                # both platforms
npm run icon                    # regenerate build/icon.png from build/icon.svg
npx electron out/main/index.js --simulate test/fixtures/pick2draft-msh-player.log
                                # drive the full UI from a captured log, no Arena needed
```

## Overlay behavior

- Always-on-top (`screen-saver` level). On macOS it also joins fullscreen spaces so it
  floats over Arena in fullscreen, which requires the app to have no Dock icon
  (`app.dock.hide()`); quit it with the window's ✕ button or Activity Monitor.
- Windows cannot draw over a game in exclusive fullscreen — run Arena in Windowed or
  Borderless mode there.
- Drag by the title strip; position, size, and opacity persist.

## Column key

GIH WR (games-in-hand win rate, the primary sort), ALSA (average last seen at),
OH (opening-hand win rate). "You W/P" = your personal win% / play% for the card.

## Notes

- `test/fixtures/*.log` are real Arena logs (they contain your account display
  name) and are gitignored. The tests that replay them skip automatically when the
  fixtures are absent, so `npm test` is green on a fresh clone.
- Data courtesy of 17lands.com and Scryfall; this is a personal tool — keep
  request volume low (everything is disk-cached).
