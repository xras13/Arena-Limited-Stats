# Arena Limited Stats — test build 0.1.0

A draft/sealed overlay for MTG Arena. It reads Arena's local `Player.log` and shows
17lands win-rate data for the cards in front of you.

It only ever **reads** the log — it never writes to Arena, sends keystrokes, or
touches your account.

---

## Which file do I want?

| You're on | Download | Notes |
|---|---|---|
| **Windows 10/11** | `Arena-Limited-Stats-0.1.0-win-x64.exe` | Installer. No admin rights needed. |
| **Windows** (no install) | `Arena-Limited-Stats-0.1.0-win-x64.zip` | Unzip anywhere, run `Arena Limited Stats.exe`. |
| **Mac (Apple Silicon)** | `Arena-Limited-Stats-0.1.0-mac-arm64.dmg` | M1/M2/M3/M4 only — not Intel Macs. |

---

## Installing on Windows

1. Run the `.exe`.
2. Windows will show **"Windows protected your PC"** — this build isn't code-signed
   (a signing certificate costs a few hundred dollars a year, which isn't worth it
   for a test build). Click **More info → Run anyway**.
3. Pick an install location and finish. It installs for your user only.

**Important:** Windows can't draw an overlay on top of a game running in
**exclusive fullscreen**. In Arena, go to *Settings → Graphics* and set the display
mode to **Windowed** or **Borderless Window**, or you won't see the overlay.

## Installing on macOS

1. Open the `.dmg` and drag **Arena Limited Stats** to Applications.
2. The first launch will be blocked because the app isn't notarized. Open
   **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**
   next to the Arena Limited Stats message, then launch it again.
3. The app has **no Dock icon** by design, so it can float over Arena's fullscreen
   window. You'll just see the overlay panel itself.

---

## Using it

- Start Arena and join a draft or sealed event. The overlay picks up your current
  pack within about a second of each pick.
- Cards are sorted by **GIH WR** (games-in-hand win rate) from 17lands, best first.
  The columns are `GIH WR`, rarity dot, colors, name, then `ALSA · OH WR`.
- Drag the panel by its title bar to move it; drag an edge to resize. Position and
  size are remembered.
- The **⚙ button** opens settings: overlay opacity, which 17lands format to pull
  ratings from (Auto matches your event), and the 17lands account connection.
- The **✕ button** quits the app.

### Sealed
Your full pool shows automatically once Arena has handed it to you. Duplicates are
merged with a `2×` badge and basic lands are hidden.

### Optional: personal stats
Connecting a 17lands account in settings adds *your own* win% and play% per card
next to the global numbers. This only works if you already upload your games to
17lands with their official client — the overlay reads your stats, it doesn't
upload anything.

---

## What to report back

Especially useful:

- **Windows in general** — this is the first Windows build and it has not been run
  on a real Windows machine yet. Anything from "it won't start" to "the numbers
  look wrong" is worth reporting.
- The overlay stays on "Waiting for a draft or sealed event…" during an event.
- Cards showing as `#123456` instead of a name.
- Any event type that doesn't work (Arena Direct, Alchemy, quick draft, etc.) —
  please include the **event name** Arena shows.
- The overlay not staying on top of Arena.

If something breaks, the most useful thing you can send is your `Player.log`:

- **Windows:** `%USERPROFILE%\AppData\LocalLow\Wizards Of The Coast\MTGA\Player.log`
- **macOS:** `~/Library/Logs/Wizards Of The Coast/MTGA/Player.log`

That file contains your Arena gameplay only — no password or payment information —
but it does identify your Arena account, so only send it to someone you trust.

---

Card data and win rates come from [17lands](https://www.17lands.com). This is an
unofficial fan project and is not affiliated with or endorsed by Wizards of the Coast.
