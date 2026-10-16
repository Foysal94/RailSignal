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

### Disruption Notice
A parsed, structured domain segment of a raw TfL disruption description. Disentangles a raw narrative text block into a temporal timeframe (e.g., date or time window), a primary corridor impact statement (e.g., stations closed or section affected), and optional secondary guidance (such as replacement bus routes, alternative transit options, and station-specific advice).

### Subscription
A user record linking a verified email address to a set of monitored **TfL Line** IDs, containing an immutable `unsubscribeToken` and tracking `lastNotifiedWeekendDate` for alert idempotency.

### Weekly Digest
A consolidated transactional email alert delivered on Friday morning to subscribers detailing all weekend disruptions on their monitored lines, rendered with `@react-email` and delivered via Resend. Technically represented in the codebase as the **Disruption Digest**.

### Disruption Digest
The technical data model and template representation (`DisruptionDigestProps`, `DisruptionDigestItem`, and `@react-email` template) of the **Weekly Digest** dispatched to subscribers. Encapsulates affected transit corridors, line brand badges, weekend radar temporal boundaries, and RFC 8058 unsubscribe credentials.

### Demo Alert
An on-demand test alert triggered through `POST /api/demo/send-test-digest` allowing portfolio visitors to receive an instant sample digest email without creating a persistent subscription.
