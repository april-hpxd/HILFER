<p align="center"><img src="assets/arwa/logo.webp" alt="HILFER" width="152"></p>

# HILFER Workstation

HILFER is a playable institutional-horror prototype set inside a fictional corporate Windows 98 workstation. Investigate conflicting personnel records, decide what belongs in the official incident report, and watch the desktop react.

## Run the demo

Requires Python 3 and a modern browser. From the repository root:

```sh
python scripts/serve.py --port 8080
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080). The demo runs on local HTML, CSS, vanilla JavaScript and JSON, with no build step or runtime packages. If the port is in use, pass a different port and open the matching URL. Saves are local to the browser and origin.

## What to try

| App | What it does |
| --- | --- |
| **Reconciliation** | Opens the Consolidated Report with a provisional claim. Inspect Jessica's clearance in Records and select **Compare status with report** to compare sources. **Update report** files an accepted correction. |
| **Records** | Browse HR and Occupational Health files, inspect the source fields, and open the comparison from the record itself. |
| **Mail** | Double-click a conversation or press Enter to open its reader. Browse Inbox and Archive, search correspondence, and move threads to Deleted Items or restore them. One message links to Records. Sent has no outgoing mail in this demo. |
| **HILFER Assistant** | The portrait sits above the taskbar. New dialogue opens a balloon without moving keyboard focus. The portrait also opens it manually. If the browser blocks automatic narration, it waits for the first interaction. |
| **Footage** | Play a short, read-only CAM 4 preview. |
| **Display Properties** | Switch between Standard and Archive / Graphite or toggle the desktop logo treatment. |

CASE-001 is the playable investigation. Filing its correction changes the report, unlocks the CASE-002 placeholder, and triggers the first audiovisual anomaly. Reload preserves progress. Use **Start → Reset Demo Progress** before another run.

## Implementation and checks

- [Integration guide](docs/INTEGRATION.md) covers app interfaces, dialogue signals, saves, and browser checks.
- [Project context](docs/PROJECT_CONTEXT.md) and [design decisions](docs/DESIGN_DECISIONS.md) distinguish current behavior from future story and mechanics.
- [Credits](CREDITS.md) and [artwork provenance](assets/arwa/CREDITS.md) identify the template, type, icons and team assets.

Run `node --test` with Node 18 or newer. The optional browser suites use Playwright and Microsoft Edge against the running local server. See the [browser setup](docs/INTEGRATION.md#run-and-checks).
