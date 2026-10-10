# Domain Glossary: RailSignal

The single source of truth for RailSignal's domain language and definitions.

## Core Domain Concepts

### Weekend Window
The temporal radar window monitored by the system: **Friday 19:00 to Monday 04:30 UK Local Time** (`Europe/London`). Captures all planned engineering closures and service reductions affecting weekend travellers while taking Daylight Saving Time (GMT/BST) into account.

### TfL Line
A London transit route tracked by the system across four supported modes:
* **Tube**: Bakerloo, Central, Circle, District, Hammersmith & City, Jubilee, Metropolitan, Northern, Piccadilly, Victoria, Waterloo & City.
* **Elizabeth line**: Elizabeth line.
* **Overground**: London Overground routes (Lioness, Mildmay, Windrush, Weaver, Suffragette, Liberty lines).
* **DLR**: Docklands Light Railway.

### Disruption
A service interruption payload ingested from the TfL Unified API (`/Line/Mode/{modes}/Disruption`). Filtered down to disruptions overlapping the upcoming **Weekend Window**. Normalized into severity categories (e.g., "Planned Closure", "Part Closure", "Part Suspended").

### Weekend Disruption Projection
The materialized read-model record stored in the database (`WeekendDisruption`) representing the consolidated closure state of a line for a specific upcoming weekend.

### Subscription
A user record linking a verified email address to a set of monitored **TfL Line** IDs, containing an immutable `unsubscribeToken` and tracking `lastNotifiedWeekendDate` for alert idempotency.

### Weekly Digest
A consolidated transactional email alert delivered on Friday morning to subscribers detailing all weekend disruptions on their monitored lines, rendered with `@react-email` and delivered via Resend.

### Demo Alert
An on-demand test alert triggered through `POST /api/demo/send-test-digest` allowing portfolio visitors to receive an instant sample digest email without creating a persistent subscription.
