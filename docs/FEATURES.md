# Waitly — Feature specification

Derived from the 41-second source video (720×1280, narrated). Every sentence of the narration was transcribed and every scene was reviewed frame by frame (2 frames per second). This document records exactly what was said and shown, organises it into features, then elaborates, simplifies and innovates on it for a product restaurants can buy.

## 1. Transcript (verbatim)

> Look at this incredible way restaurants are using AI. It monitors every table in real time. Green means it's free, red means customers are seated, and a timer starts. If customers have been seated for five minutes without a waiter arriving, you get an alert telling you exactly which table needs attention. If a table becomes free but hasn't been cleaned yet, another alert is triggered so staff can prepare it faster for the next customers. And if there's a line at the entrance, staff can see which table will be available first. At the end of the week, managers can review peak hours and schedule the right number of waiters. And the most interesting part is that you don't always need a new camera. Some systems analyze footage from the security cameras the restaurant already has. Follow me to discover more about AI and technology.

## 2. Scene-by-scene map (what was said + what was shown)

| Time | Narration | On screen | Feature | Design notes taken from the frames |
|---|---|---|---|---|
| 0:00–0:03 | "Look at this incredible way restaurants are using AI." | Security-camera footage of a dining room; every empty table carries a small green "Free" tag. Presenter at a mic. | Hook | Overhead/corner CCTV angle. Green tags on tables. |
| 0:03–0:10 | "It monitors every table in real time. Green means it's free, red means customers are seated, and a timer starts." | Eyebrow "AI IN RESTAURANTS", headline "A camera that monitors your tables". A live-video panel with a left sidebar: "TABLES M1–M8", rows "08:02 Available", "02:12 Available", "03:35 Available" with green pills; "● LIVE VIDEO" badge top right. Tables outlined with coloured polygons: red for seated with "M4 14:08", "M2 23:05", "M7 23:05"; green with "M5 Available"; one amber "#F5A623" outline and "M8 6:12". A small radar/clock gauge bottom-left. | Live table status + timers | Dark navy backdrop. Headline white with the key phrase in light blue. Status colours: green = free, red = seated, amber = attention. Table labels are letter+number (M1…M8). Timers in mm:ss. |
| 0:10–0:14 | "If customers have been seated for five minutes without a waiter arriving…" | Eyebrow "DETECTION", headline "Available or occupied", subline "timer starts upon arrival". A dark panel of table cards, each with a coloured left accent bar: "M5 Available" (green), "M4 14:15 #FF4D6D" (red), "M1 18:18 #2BE08A", "M3 0:48". | Table cards | Card = dark slate tile, left accent bar in the status colour, big table ID, big tabular timer, small caption. The hex codes shown are literally the status palette: #FF4D6D (seated red), #2BE08A (free green), #F5A623 (amber). |
| 0:14–0:17 | "…you get an alert telling you exactly which table needs attention." | Eyebrow "WAITER TRACKING", headline "No forgotten customer". iPhone lock screen (20:41, Friday) with a push notification: "SALOON · now — Table 2 — Customers seated for 5 minutes, no waiter". | Service alert (no-greet SLA) | Alert is a plain push notification naming the table and the reason. Arrives on a phone, not just the host stand. |
| 0:17–0:22 | "If a table becomes free but hasn't been cleaned yet, another alert is triggered so staff can prepare it faster for the next customers." | Pill "● 2/6 tables occupied". Eyebrow "ROTATION · TRACKING", headline "Tables ready faster". A 3D table with an amber glowing ring "M5 ● To be cleaned"; a push "Table 5 – Released, to be cleaned"; ring turns green "M5 Free"; guests sit and ring turns red with a timer "M5 0:19 → 1:59"; pill becomes "● 3/6 tables occupied". | Turnover / cleaning alert, occupancy counter | The ring around a table is the status indicator (amber = needs cleaning, green = free, red = seated + timer). Occupancy pill "n/N tables occupied" with a coloured dot. |
| 0:22–0:27 | "And if there's a line at the entrance, staff can see which table will be available first." | Eyebrow "WAITING QUEUE", headline "The next free table". Isometric room, a queue of people at the entrance, concentric blue rings radiating from "M2 24:39" (red, the table sitting longest); green "M5 Free" pills on free tables; caption "Table 2: sitting longest". | Next-free-table prediction for the queue | Blue concentric rings = prediction/"next up". The predicted table is the one seated the longest. |
| 0:27–0:31 | "At the end of the week, managers can review peak hours and schedule the right number of waiters." | Eyebrow "WEEKEND", headline "Your peak times", subline "the right number of waiters at the right time". 3D bar chart by hour (11h, 12h, 13h … 8PM, 9PM); peak bars in amber, others blue; little waiter figures with cloches stacked on top of the peak bars. | Peak-hours analytics + staffing recommendation | Hourly bars, peaks highlighted in amber, staffing shown as a count of waiters per hour. |
| 0:31–0:38 | "And the most interesting part is that you don't always need a new camera. Some systems analyze footage from the security cameras the restaurant already has." | Eyebrow "NO NEW EQUIPMENT", headline "The camera that is already on the ceiling". Floating rings above tables (green free, red seated) with labels "M2 34:09", "M5 16:09", "M5 #FF4D6D"; a ceiling CCTV camera; a ceiling camera casting a light cone over a ring of tables labelled "M1 Free", "M3 Free", "M6 Free". | Works with existing cameras | Reuse of installed CCTV; the camera is a source, the app is the product. |
| 0:38–0:41 | "Follow me to discover more about AI and technology." | Presenter. | Outro | — |

## 3. Feature inventory (organised)

1. **Live floor** — every table, its status and a running timer, in real time, on any device.
   - Statuses seen: Free (green), Seated (red + timer since arrival), Needs cleaning (amber), Next up (blue rings).
   - Occupancy counter "n/N tables occupied".
2. **Service alert — "No forgotten guest"** — a party seated for 5 minutes with no server visit triggers an alert naming the exact table. Delivered as a push notification.
3. **Turnover alert — "Tables ready faster"** — when guests leave, the table becomes "released / to be cleaned" and staff are alerted so it can be reset quickly; cleaned → Free.
4. **Waiting queue — "The next free table"** — when there is a line at the entrance, staff see which table will free up first (the one sitting longest), so they can quote waits and plan seating.
5. **Peak-time insights — "Your peak times"** — weekly review of occupancy by hour, with peak hours highlighted and a recommended number of waiters per hour.
6. **No new equipment** — the system can run on the security cameras a restaurant already has.

## 4. Elaborate — what each feature becomes in Waitly

### 4.1 Live floor
- Floor map with tables drawn as rings (the video's visual language). Ring colour = status; the ring also doubles as the timer dial.
- Every table shows: label, seats, status, elapsed time since the last status change, party size, assigned server, and an "attention" marker when an alert is open.
- Table list view (the video's accent-bar cards) for phones and for staff who prefer lists.
- Filters: all / seated / free / needs cleaning / alerts.
- Tap a table → table sheet with one-tap actions: **Seat party**, **Server arrived**, **Guests left**, **Mark cleaned**, **Hold**, plus notes.
- Occupancy pill in the header; live clock; connection indicator.

### 4.2 Service alert ("No forgotten guest")
- Configurable greet SLA (default 5 minutes, as in the video) and a repeat-visit SLA (e.g. no server visit for 15 minutes mid-meal).
- Alerts show the table, the reason, how long it has been waiting, and who is assigned.
- Acknowledge / resolve from any device. Resolving "no greet" by tapping **Server arrived** also records the greet time for analytics.
- Escalation: alert turns from amber to red after a second threshold.
- Delivery: in-app alert centre, browser push notifications (Web Push with VAPID keys when configured), sound and vibration on the host stand. SMS/pager hooks via webhook.

### 4.3 Turnover alert ("Tables ready faster")
- When a table is released it enters **Needs cleaning**; a cleaning SLA (default 4 minutes) raises an alert if it is not reset in time.
- Bussers get the alert; **Mark cleaned** returns the table to Free and stores the turnaround time.
- Insights report average turnaround and the slowest hour, so managers can staff bussers accordingly.

### 4.4 Waiting queue ("The next free table")
- A real waitlist: party name, size, phone, notes, quoted wait, time waiting, position.
- **Next free table prediction**: for each seated table, Waitly estimates "likely to free in X min" from the venue's own average dining duration by party size and time of day, minus elapsed time (falls back to a sensible default). Tables are ranked; the top candidate for each waiting party's size is shown with a confidence level.
- Quoted wait is suggested automatically from the prediction, not guessed.
- Guests can join the waitlist themselves from a QR code (public page), see their position, and get a "your table is ready" notification.
- When a table turns Free, the host sees "Seat *Party* at M5" as a one-tap suggestion.

### 4.5 Peak-time insights ("Your peak times")
- Occupancy by hour for the selected day, with peak hours highlighted (amber) like the video.
- Day-of-week × hour heat view for the last weeks.
- **Staffing recommendation**: covers per hour ÷ configurable covers-per-server (default 16) → recommended number of servers per hour, with a comparison to the number scheduled.
- Service quality metrics: average time-to-greet, % of parties greeted inside the SLA, average turnaround, average dining duration, table turns per day, average queue wait, walk-aways.
- Export CSV.

### 4.6 No new equipment — input sources
Waitly separates **what happens on the floor** from **how it learns about it**. Table events can come from:
1. **Staff taps** (always available, day one, zero hardware).
2. **Camera AI** — any vision provider that can say "table M4 occupied / empty / staff present" calls Waitly's ingest API with an API key. This is how an existing CCTV system plugs in.
3. **POS** — order opened → seated; check closed → likely to leave soon (improves predictions).
4. **Demo simulation** — a built-in, realistic activity generator for sales demos and training.

The video's promise ("you don't always need a new camera") becomes an architecture decision: Waitly is useful without a camera and gets more automatic with one.

## 5. Simplify — deliberate decisions

- Four table statuses only: **Free**, **Seated**, **Needs cleaning**, **Held**. Everything else is a flag or a timer.
- One tap per action. The table sheet never shows more than five actions.
- Colour means the same thing everywhere: green free, red seated, amber needs cleaning/attention, blue next-up/prediction.
- No per-seat ordering, no payments, no reservations calendar. Waitly is the live floor, the queue and the alerts. It integrates with POS and reservations instead of replacing them.
- The host stand, a server's phone and the manager's laptop all open the same app; the layout adapts.
- Staff identity is lightweight: pick your name and section; no passwords on the floor. The manager area is behind a PIN.

## 6. Innovate — what Waitly adds beyond the video

- **Attention order**: open alerts are ranked by urgency (escalated first, then no greet, long waits, tables to reset, overdue re-visits, oldest first), not just by a single 5-minute rule, and a re-visit rule covers the middle of the meal.
- **Prediction with learning**: dining duration estimates improve from the venue's own history, by party size and hour.
- **Guest self-service queue** by QR, with position and "table ready" notifications.
- **Sections and ownership**: every alert names the server who owns the section, and every device on the floor sees the same alert the moment it opens.
- **Turnaround SLA** for bussers, measured and reported.
- **Staffing planner** that converts peak hours into a recommended servers-per-hour line.
- **Source-agnostic ingestion** with an API key and idempotent events, so camera AI, POS and manual taps coexist; manual taps always win for 60 seconds to avoid fighting a camera.
- **Demo mode** that makes the floor live in sales demos.

## 7. What this prototype implements

Implemented and working end-to-end:
- Live floor (map + list), table sheet actions, timers, occupancy, connection status.
- Alert engine (no-greet SLA, re-visit SLA, cleaning SLA) with acknowledge/resolve, escalation and in-app notifications.
- Waitlist with next-free-table prediction, quoted waits, seat suggestions, guest join page.
- Insights with hourly occupancy, peak highlighting, staffing recommendation, service metrics.
- Settings behind a manager PIN: venue and hours, service rules, a floor-plan editor (drag tables on the map or edit positions), sections and server assignment, staff, integrations (API key and ingest examples), notifications (sound, browser notifications), theme, demo mode and reset.
- Real-time sync between devices via Server-Sent Events; JSON-file persistence; in-app toasts, a chime and browser notifications when a new alert opens.
- Marketing landing page with launch pricing, so the product can be shown and sold from one deploy.
- Ingest API for camera AI / POS events.
- Demo simulation that generates realistic floor activity.

Stubbed (documented in the README): SMS delivery, Web Push delivery, the vision model itself (Waitly consumes events; it does not run computer vision).
