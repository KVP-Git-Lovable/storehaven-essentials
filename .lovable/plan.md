# List View Builder — Filter Scoping + Column Reorder

Two enhancements to the New/Edit List View page (`/list-views/new`, `/list-views/:id`):

1. **Filters limited to selected fields** — only fields the user picked appear in the filter field dropdown.
2. **Drag-and-drop column reorder** in the Preview table, persisted in a new `column_order` column.

---

## 1. Database migration

Add a nullable JSONB column to `list_views`:

```sql
ALTER TABLE public.list_views
ADD COLUMN column_order jsonb NOT NULL DEFAULT '[]'::jsonb;
```

- Nullable-equivalent via empty default → existing rows are unaffected.
- Fallback at render time: if `column_order` is empty, use `selected_fields` order.

No RLS changes (existing policies cover the new column).

## 2. Filters scoped to selected fields (`ListViewBuilder.tsx`)

- Build `availableFilterFields = entity.fields.filter(f => selectedFields.includes(f.key))`.
- Pass `availableFilterFields` (instead of `entity`) to `FilterRow` via a small refactor: change `FilterRow`'s `entity` prop to `fields: FieldDef[]` (plus `entityLabel` if needed). Adjust internal lookups accordingly.
- "Add filter" button:
  - Disabled with tooltip "Select at least one field first" when `selectedFields.length === 0`.
  - Uses `availableFilterFields[0].key` as the default field.
- When a field is removed from `selectedFields`, auto-prune any filter rows referencing it (with a toast: "Removed N filter(s) on unselected fields").
- If an existing saved view has filters on fields not in `selectedFields`, auto-add those fields back to `selectedFields` on load (so old views never break) — alternatively keep the filters and surface a warning. **Chosen: auto-add to selectedFields on load** to preserve behaviour.

## 3. Column reorder in Preview

Use the already-installed `@dnd-kit/core` + `@dnd-kit/sortable`.

- New state: `const [columnOrder, setColumnOrder] = useState<string[]>([])`.
- Sync rules:
  - On load of an existing view: `columnOrder = existing.column_order?.length ? existing.column_order : existing.selected_fields`.
  - When `selectedFields` changes:
    - Append newly selected fields to the end of `columnOrder`.
    - Remove deselected fields from `columnOrder`.
- Preview table renders headers from `columnOrder` (falls back to `selectedFields` then default first 5).
- Wrap the `<TableHeader>` row in `DndContext` + `SortableContext` (horizontal strategy). Each `<TableHead>` becomes a `SortableHeader` component with a drag handle icon (`GripVertical`) and `useSortable`. On `onDragEnd`, reorder `columnOrder` via `arrayMove`.
- Body cells render in the same `columnOrder` sequence so columns visually move together.
- Small "Reset order" link button next to the Preview title when `columnOrder` differs from `selectedFields` order.

## 4. Save payload

`ListViewBuilder.saveMutation` payload gains `column_order: columnOrder`. Insert and update both include it.

## 5. Rendering saved views elsewhere

`executeListView` already uses `selected_fields` for the SELECT (server-side order doesn't matter for the UI). Consumers that render columns should prefer `column_order` when present. Currently the only consumer rendering tabular results from a saved list view is the Preview itself; `EntityListViewsBar` only applies filters and doesn't pick column order, so no further changes are required for this scope. (If the user later wants entity transaction tables to honour `column_order`, that's a follow-up.)

## 6. Backwards compatibility

- New column has default `'[]'` → old rows load with empty array → fallback to `selected_fields` order. No breakage.
- The Supabase generated types file regenerates automatically post-migration; the code uses `from("list_views" as any)` already, so no manual type changes needed.

---

### Files to change

- `supabase` migration: add `column_order` column.
- `src/pages/listviews/ListViewBuilder.tsx`: state, filter scoping, dnd preview, save payload, load logic.
- `src/components/listviews/FilterRow.tsx`: accept `fields: FieldDef[]` instead of full `entity`.
- New small component (inline or `src/components/listviews/SortablePreviewHeader.tsx`) for the sortable `<TableHead>`.

### Out of scope

- Reordering columns in entity transaction list pages (Customers/Orders/Products tables) — only the builder Preview honours `column_order` in this iteration.
- Per-column width / visibility toggles.
