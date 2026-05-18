# Redesign List View Create Flow (Salesforce-style)

## Goal

Replace the single monolithic `/list-views/new` page (Definition + Fields + Filters + Preview) with:

1. A minimal **Create modal** (Definition only).
2. A **Saved List View page** that shows the table, with **Gear** and **Filter** icons in the top-right that open the existing Fields / Filters / Visibility / Rename / Duplicate flows in dialogs.

No backend, schema, query, filter engine, permissions, or rendering logic changes — UI reorganization only.

---

## Step 1 — New Create Modal

Trigger: "New List View" button in `ListViewsList.tsx` and `EntityListViewsBar.tsx`.

Instead of `navigate("/list-views/new")`, open a new component `<NewListViewDialog />`.

Fields (Definition only):

- Name (required)
- Description
- Entity (locked if opened from an entity bar)
- Visibility — radio group (Private / Shared) styled like the reference screenshot
- Tags (comma-separated)

Buttons: **Cancel** / **Save**.

On Save:

- Insert into `list_views` with `selected_fields: []`, `filters: []`, `column_order: []`, `created_by: user.id` (same payload shape as today).
- Close modal, `navigate(\`/list-views/{newId})`(or`/list-views/{newId}?entity=...` when launched from an entity page).
- Invalidate `["list-views"]` and `["list-views-by-entity", entity]`.

---

## Step 2 — Saved List View Page

Rework `src/pages/listviews/ListViewBuilder.tsx` when `!isNew`:

Replace the 3-card layout (Definition / Fields / Filters / Preview) with:

```text
┌─────────────────────────────────────────────────────┐
│  ← [List View Name]            [⚙ Gear] [⛛ Filter] │
│  Description • Entity • Visibility badge            │
├─────────────────────────────────────────────────────┤
│  Data Table (uses existing executeListView + cols)  │
└─────────────────────────────────────────────────────┘
```

Reuse the existing `executeListView` call, column ordering, and `Table` rendering already in the file — just move it to be the primary content and drop the Definition/Fields/Filters cards from the page body.

When `isNew` (legacy `/list-views/new` URL): redirect to the listing page and open the Create modal, so the old route still works.

---

## Header Actions

### Gear dropdown (`DropdownMenu`)

- **Duplicate** — same insert logic already in `ListViewsList.tsx duplicateMutation`, then navigate to the new id.
- **Rename** — small dialog with a Name input → `update({ name })`.
- **Select Fields to Display** — opens `<FieldPickerDialog />` (see below).
- **Sharing** — dialog with the existing Visibility select (Private / Shared) → `update({ visibility })`.
- **Delete** (keep for parity) — confirm + delete + navigate back.

### Filter icon button

- Opens `<FiltersDialog />` containing the existing `FilterRow` list, "Add filter" button, and the field-availability rules already in `ListViewBuilder.tsx` (filters limited to selected fields, auto-prune on deselect).
- Save → `update({ filters })` and refetch the table.quic

---

## FieldPickerDialog (two-pane shuttle)

Matches the attached screenshot:

```text
Available Fields           Visible Fields
┌──────────────┐  [ > ]   ┌──────────────┐
│ field a      │  [ < ]   │ field x      │
│ field b      │  [ >> ]  │ field y      │
│ ...          │  [ << ]  │ ...          │
└──────────────┘          └──────────────┘
              [Cancel] [Save]
```

- Source: `ENTITY_SCHEMAS[entity].fields`.
- Left = fields not in `selected_fields`. Right = `selected_fields` in `column_order` order.
- Arrow controls move single / all between panes; up/down reorder visible side (keeps the existing drag-reorder behavior elsewhere).
- Save → `update({ selected_fields, column_order })`; table re-renders with new columns.

---

## Files to Change

- `src/pages/listviews/ListViewBuilder.tsx` — keep create logic only as a fallback; rewrite the edit/view layout to: header + actions + table. Extract Fields, Filters, Rename, Sharing, FieldPicker into dialogs.
- `src/pages/listviews/ListViewsList.tsx` — "New List View" button opens `<NewListViewDialog />` instead of navigating.
- `src/components/transactions/EntityListViewsBar.tsx` — same change for "New List View" button.
- New: `src/components/listviews/NewListViewDialog.tsx`
- New: `src/components/listviews/FieldPickerDialog.tsx`
- New: `src/components/listviews/FiltersDialog.tsx`
- New: `src/components/listviews/RenameListViewDialog.tsx`
- New: `src/components/listviews/SharingDialog.tsx`

## What is NOT Touched

- `src/lib/listViewExecutor.ts`, `src/lib/listViewSchema.ts`
- Supabase tables / RLS / edge functions
- `FilterRow` component internals
- Entity list pages (`LeadsList`, `CustomersList`, …) and their query logic
- Permissions / `useAuth`

## UX Notes

- All transitions via shadcn `Dialog` / `DropdownMenu` — no full reloads.
- Existing React Query keys reused; mutations call `invalidateQueries` to refresh without remount.
- Responsive: header collapses to icon-only buttons on small screens; dialogs already use `max-h-[90vh]` + sticky footer pattern per project memory.