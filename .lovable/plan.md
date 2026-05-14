# Meridian ATS — Phase 3 Plan

Large multi-section addition. Here's the build order.

## 1. Database (single migration)
- New `notifications` table (user_id, type, title, message, link, is_read, created_at) + RLS (user owns rows)
- DB trigger on `applications` INSERT → fan-out a `new_application` notification to every profile
- Performance indexes: `applications(job_id, candidate_id, current_stage, status)`, `stage_history(application_id)`, `evaluation_notes(application_id)`, `notifications(user_id, is_read)`
- Enable realtime on `notifications`

## 2. Analytics page (`/analytics`)
- Install `recharts`
- Filter bar (sticky): date range buttons (7/30/90/All, default 30) + department dropdown
- 6 KPI cards with trend vs prior period: Open Jobs, Total Candidates, Active Apps, Avg AI Score, Avg Time-to-Hire, Offer Acceptance
- Charts:
  - Pipeline Funnel (horizontal bar, blue→green gradient, from stage_history)
  - Applications Over Time (line+area, granularity by range)
  - Avg Time in Stage (vertical bar, longest = red)
  - AI Score Distribution (1–10 histogram, violet)
  - Hiring by Department (grouped bar)
- Recruiter Activity table (profiles × stage_history × evaluation_notes)
- All TanStack Query keyed on `[range, department]`

## 3. Global search (Cmd/Ctrl+K)
- `CommandPalette` component wired to TopBar search button + global keydown
- Debounced (300ms) parallel ILIKE on jobs (title) and candidates (name/email), 5 each
- Keyboard nav (↑↓ Enter Esc), grouped results, click → navigate

## 4. Notifications
- `NotificationBell` in TopBar: unread badge with pulse, dropdown panel (380px), grouped by read/unread, mark-all-as-read, item click → navigate + mark read
- Realtime subscription per user
- Helper `createNotificationForAll(type, title, message, link)` used after AI scoring + stage moves to Offer/Hired
- Mobile: full-screen modal instead of dropdown

## 5. Polish
- Page fade-in transition (200ms) on route change
- Skeleton loaders with shimmer on every fetching page
- Empty states audit (Dashboard / Jobs / Kanban / Candidates / Analytics / Notes / Timeline)
- Public `/apply/{id}`: "Powered by Meridian" footer, success animation, radial glow background
- Inline SVG favicon (M monogram) in `__root.tsx`, dynamic `<title>` per route via `head()`
- Mobile responsiveness: drawer sidebar w/ hamburger, stack KPIs/charts, kanban horizontal scroll, candidate detail stack

## Constraints
- Do not touch existing design tokens, sidebar layout, or working functionality beyond what's specified
- No edits to `client.ts`/`types.ts`/`.env`
- Keep changes focused on the additions above
