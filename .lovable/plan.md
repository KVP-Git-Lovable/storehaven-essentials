## Goal

Make it obvious and easy to edit any existing journey (Draft, Active, or Paused) — both its top-level details and every node on the canvas — without deleting and recreating components. Execution logic, scheduling APIs, and enrollment behavior are untouched; edits affect only future processing.

## What's already in place (so we don't duplicate)

- `NodePropertyPanel` already supports editing all node types (Message template/free-form, Decision condition, Delay duration/unit, Entry audience hint). Clicking a node on the canvas opens it.
- `JourneyBuilder` already lets users `Save` the canvas regardless of status.
- The problem is purely UX/discoverability: there is no "Edit Journey" entry point from the list, and inside the builder the only way to edit a node is to discover that nodes are clickable.

## Changes

### 1. JourneyList (`src/pages/communication/JourneyList.tsx`)

- Add an **"Edit Journey"** action button (pencil icon) in the row action column, visible for journeys with status `draft`, `active`, or `paused`. Clicking it routes to `/communication/journeys/:id` (the builder) with an `?edit=1` query flag.
- Add an **"Edit Details"** option that opens a small dialog to edit the journey's **Name**, **Description**, and **Audience** (re-uses existing `AudienceBuilder`). On save it updates the `journeys` row — no change to canvas / schedule / execution.
- Keep all existing Play/Pause/Schedule/Analytics/Delete buttons.

### 2. JourneyBuilder header (`src/pages/communication/JourneyBuilder.tsx`)

- Add an **"Edit Journey"** button next to `Analytics` / `Save` / `Pause|Activate`. It opens the same **Edit Details** dialog described above (name, description, audience). Available for `draft`, `active`, and `paused`.
- Show a small status-aware banner when the journey is `active` or `paused`:
  > "You're editing a live journey. Changes apply to future executions only — already-processed contacts are not affected."
- Add a subtle hint on the canvas (small Panel chip): "Click any node to edit its properties." Shown only when no node is currently selected.

### 3. Node editing UX (`src/components/journey/NodePropertyPanel.tsx`)

- No functional change to the editing logic — it already covers Message (template + free-form), Decision (channel-aware condition), Delay (duration + unit), Entry (audience hint).
- Add a small **"Editing — changes saved on Save"** helper line at the top of the panel and a friendlier title (e.g., "Edit Message", "Edit Decision", "Edit Delay") to make the edit affordance explicit.
- For `active`/`paused` journeys, surface an inline note: "Edits will affect future executions only."

### 4. Execution / scheduling

- No changes. `process-journeys`, `journey-actions`, `journey_enrollments`, and `journey_schedules` are not touched. Existing enrollments continue with the canvas state they were enrolled against (current behavior).

## Technical details

- New state in `JourneyBuilder`: `editDetailsOpen: boolean`. Reuses the existing `journey` query and a new `updateDetailsMutation` that does `supabase.from("journeys").update({ name, description, list_view_id, audience_config }).eq("id", id)` then invalidates `["journey", id]` and `["journeys"]`.
- New dialog component (inline) shared between `JourneyList` and `JourneyBuilder`, or simply duplicated — small enough to inline in both. Reuses `AudienceBuilder` for the audience block.
- Routing: list's "Edit Journey" icon simply navigates to the existing builder route. No new route needed.
- No DB migration. No edge-function changes. No `canvas_data` shape change.

## Out of scope

- Versioning/branching of canvases.
- Re-enrolling already-processed contacts after an edit.
- Edits to schedule timings (already handled by the existing Schedule dialog).
