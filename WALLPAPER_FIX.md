# Wallpaper stacking fix

- Live and static wallpapers now render in a dedicated, non-interactive background layer.
- The background is constrained to the main content viewport on desktop and starts below the mobile top bar.
- Navigation, page content, tabs, dialogs and overlays have explicit stacking precedence.
- Wallpaper layers use `pointer-events: none` so they cannot block clicks.
- Static wallpapers and presets use the same safe rendering path as video wallpapers.
- Regression coverage was added to `tests/cloudflare.migration.test.js`.

No D1 migration is required for this update.
