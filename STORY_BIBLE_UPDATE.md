# Story Bible update

This update adds chapter-based spoiler reveals, a visual relationship graph, richer place/object profiles, and the new **Onde se localiza** view.

## Database migration

The update is incremental. Apply it to the existing D1 database before deploying:

```bash
npm run cf:db:remote
```

Wrangler should offer `0003_story_bible.sql`. It adds columns/tables only and does not recreate books, chapters, users, or existing lore records.

## Deploy

```bash
npm install
npm --prefix client install
npm run cf:db:remote
npm run deploy
```

## New data model

- `lore_field_reveals`: field-level chapter reveals for characters, places, and objects.
- `lore_relationships`: typed, book-scoped links between characters, places, and objects, with optional reveal chapter.
- `lore_locations`: chapter-based location changes for characters and objects. The UI carries the latest known location forward until another location is recorded.
- Places now support region, parent place, atmosphere, population, dangers, rules, and residents.
- Objects now support current/previous owners, current location, origin, creator, powers, limitations, condition, and history.

Reader spoiler rules are enforced server-side. Locked field values are replaced with `???` before the JSON response is sent.
