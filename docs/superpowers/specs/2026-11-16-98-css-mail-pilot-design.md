# 98.css pilot in HILFER Mail

Use 98.css for the main Mail window's toolbar controls, search field, folder tree, table headers, and status bar. Keep the current DOM hooks, keyboard behavior, and desktop window manager. The conversation windows retain their document layout and readable message text. Records, Reconciliation, Assistant, Display Properties, Start, and the taskbar stay outside the pilot.

Pin an upstream release and keep the small set of CSS rules the pilot uses in a separate local file. Scope each adopted selector under #emails-app. Record the upstream version, source, and adaptations in CREDITS.md and preserve the upstream license beside the CSS. Use HILFER's existing fonts and assets. The static demo must work without a CDN or build step.

Map the adopted control surfaces, highlights, shadows, and focus treatment to HILFER's existing theme values. Remove the equivalent declarations in emails.css where upstream rules replace them. Keep Mail's existing spacing, column layout, scrolling, and selected and unread states where those express app behavior.

Use the existing HILFER folders and envelope art for the pilot. Alex Meub's gallery can guide the choice of glyphs. Include external icon files only when redistribution terms for the specific files are documented.

Compare before and after in Standard and Graphite at desktop and narrow widths. Check focus visibility, disabled buttons, table scroll, and folder selection. Run the Mail browser suite and node --test. Confirm the existing thread windows, whole-thread receipts, search, and HR-014 link still work. Spot-check that the pilot has no visual effect on Records or the desktop shell. Evaluate shared window frames separately after the pilot.
