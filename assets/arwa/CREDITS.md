# HILFER visual assets

Graphics: **Arwa**. Source visual implementation: **Altynai / april-hpxd**.

Imported selectively from [april-hpxd/WIN98-template](https://github.com/april-hpxd/WIN98-template), commit `4be592205ce2d6d3c29f604ba5af41adc78a0b08` (2026-10-26 integration). The source repository's [LICENSE](LICENSE) is preserved here; original template attribution to pollygon-dev and HTML5-Templates.com remains in the project.

| Runtime derivative | Source path | Output |
| --- | --- | --- |
| `logo.webp` | `assets/hilfer logo/hilfer_logo.png` | 512 x 512, lossless WebP |
| `wallpaper.webp` | `assets/wallpaper/aaaa.png` | 1920 x 1080, WebP quality 86 |
| `reconciliation.webp` | `assets/icons/clean version/tasks.png` | 128 x 128, lossless WebP |
| `records.webp` | `assets/icons/clean version/folder.png` | 128 x 128, lossless WebP |
| `settings.webp` | `assets/icons/clean version/settings.png` | 128 x 128, lossless WebP |
| Shell icon pairs | Matching PNGs in `assets/arwa/saturated/` and `assets/arwa/not saturated/`, including `logo_pixelated.png` | Standard and Archive / Graphite theme variants referenced directly |
| Short glitch cue | `assets/sounds/glitch.mp3` | First 1.5 seconds used after the first case is filed |

The five WebP derivatives were resized with Lanczos and encoded using Pillow/WebP; originals were not modified. Those files total **46,890 bytes**, compared with **1,872,905 bytes** for their source PNGs. The saturated shell icons are referenced directly from their supplied PNG files.

Asset paths and clean/distorted aliases live in `css/assets.css`. Matching distorted artwork is not supplied for these five resources, so distorted paths currently fall back to the same artwork; the existing milestone-driven CSS contamination remains active. Camera distortion images were deliberately excluded because the prototype has no Security application.

`css/arwa.css` selectively adapts the source's burgundy title bars, rose window frames, desktop composition, shell icons, taskbar and Start menu. The wallpaper's embedded OS label is part of the artwork, not a game version declaration. To match the supplied desktop reference, the shell covers its original upper-left placement and renders the same label at the upper right. No dedicated Safety Alerts or Downloads icons are supplied yet; Safety Alerts uses the document icon with a CSS alert badge, and Downloads currently reuses the employee-records folder icon.

No source mockup JavaScript, application data, employee identities, case definitions, mail, assistant or security screens were imported. The personnel portrait remains the original neutral placeholder.
