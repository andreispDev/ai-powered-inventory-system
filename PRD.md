# Product Requirements Document

**Product:** AI-Powered Inventory System (working name)
**Status:** Draft v1, awaiting sign-off before build
**Date:** 2026-11-02
**Companion docs:** [Architectural.md](Architectural.md) · [STRUCTURE.md](STRUCTURE.md) · [Design.md](Design.md)

---

## 1. Summary

A private inventory platform for one organization. Each office manages its own inventory in categories and columns it defines itself, and cannot see any other office's data. Every action is logged. Staff can ask questions about their data in plain language and get forecasts of what will run out. Developers run the platform, monitor it live, and decide which features each admin may control.

### Problems it solves

| Problem today | What the product does |
|---|---|
| Offices track different things, so one fixed spreadsheet format never fits | Each office defines its own categories and detailed columns |
| Nobody can say who changed what, or when | Every change is logged in a record that cannot be edited |
| "Where did this item go?" takes phone calls | Each assignment records the item, office, date and person, and announces it automatically |
| Stock-outs are discovered too late | Forecasts warn before an item runs out |
| Answers require someone to build a report | Ask in plain language and get an answer with links to the source records |
| Offices can see each other's data, or sensitive data is shared too widely | Office separation is enforced by the database, not only by the UI |

### Goals and how we measure them

| Goal | Target |
|---|---|
| Traceability | 100% of data changes have an audit entry, written in the same transaction |
| Isolation | 0 cross-office leaks; an automated test suite covers every office-scoped table and route |
| Availability | 99.9% monthly uptime for the core inventory features |
| Speed | p95 page data under 300 ms; p95 mutation under 500 ms |
| AI answer quality | At least 90% correct on the maintained evaluation set, and every data claim cites a record |
| Forecast usefulness | Beats the seasonal-naive baseline on backtest before a forecast is shown as reliable |
| Adoption | At least 80% of provisioned accounts active monthly, 3 months after rollout |

### Non-goals for v1

- Selling this to other organizations (no billing, no sign-up page, one deployment per organization)
- Login by password, or a "Continue with Google" button (it would need Google Cloud Console, which is not used)
- Offline editing (reads stay visible during an outage; writes wait until the connection returns)
- Native mobile apps (the web app is responsive)
- Purchasing, invoicing, accounting, or barcode hardware integration
- Letting the AI change data (it can only read)

---

## 2. Assumptions to confirm

The build proceeds on these unless changed. The first three would change the architecture if wrong.

| # | Assumption | If wrong |
|---|---|---|
| A1 | **"Isolated" means private to one organization, not air-gapped.** Sign-in codes are sent by email, which needs internet access. AI runs on Ollama on our own machine, so inventory data isn't sent to an outside AI service. | An air-gapped requirement means replacing emailed codes with a self-hosted mail server or another sign-in method |
| A2 | **Each user belongs to exactly one office.** | Multi-office users need a membership table and an office switcher |
| A3 | **Developers can see all offices but do not edit office inventory.** They are read-only on inventory, and every view of office data is logged. | Giving developers write access is a small permission change, but it weakens the audit story |
| A4 | Scale target: 50 offices, 2,000 accounts, 1 million items, 500 concurrent users | The design scales further, but infrastructure sizing changes |
| A5 | Audit logs are kept 2 years online and 7 years in archive | Legal or policy retention rules may require different numbers |
| A6 | Accounts use Gmail or other email addresses, and codes are sent through one Gmail account | A full rollout may exceed Gmail's daily sending limit and need an email service |

---

## 3. Roles

| Role | Who | Scope | Purpose |
|---|---|---|---|
| **Developer** | Platform team | All offices | Runs the platform: offices, admins, permissions, monitoring, announcements |
| **Admin** | Office head or supervisor | Own office | Manages office accounts and oversees everything users do |
| **User** | Office staff | Own office | Does the daily inventory work |

### Default permissions

A role sets the defaults. A Developer can then grant or deny specific permissions per office or per person (FR-PERM).

| Capability | Developer | Admin | User |
|---|---|---|---|
| View own dashboard and own profile | Yes | Yes | Yes |
| View other profiles | All | Own office | No |
| Create and manage offices | Yes | No | No |
| Create admin accounts | Yes | No | No |
| Create user accounts | Yes | Own office | No |
| Grant or deny permissions | Yes | Only if delegated | No |
| View inventory | All, read-only | Own office | Own office |
| Create, edit, delete items and stock movements | No | **Grantable** | Yes |
| Create and edit categories and columns | No | **Grantable** | Yes |
| Archive categories, restore deleted items | No | Yes | No |
| Start or accept transfers between offices | No | Yes | **Grantable** (start only) |
| View audit logs | All | Own office | Own actions only |
| Real-time monitoring | All accounts | Own office | No |
| Send announcements | All accounts or chosen offices | Own office | No |
| Receive notifications | Yes | Yes | Yes |
| AI assistant and predictions | All offices | Own office | Own office |
| Export data | All | Own office | **Grantable** |

---

## 4. Functional requirements

Priority: **P0** is required for launch, **P1** follows soon after launch, **P2** is later.

### 4.1 Authentication (FR-AUTH)

| ID | Requirement | Priority |
|---|---|---|
| AUTH-1 | Sign-in is by a one-time code sent to the person's email (Gmail in normal use), and there is no password anywhere | P0 |
| AUTH-2 | Invite-only: an email can sign in only if it was provisioned first. Unknown emails get the same on-screen response and no email, so the form doesn't reveal who has an account. Sign-in attempts are logged | P0 |
| AUTH-3 | Codes have 6 digits, expire in 5 minutes, are stored hashed, and stop working after 3 wrong tries. An email can request 5 codes per 15 minutes | P0 |
| AUTH-4 | Deactivating an account ends its sessions immediately | P0 |
| AUTH-5 | Sessions end after 8 hours of inactivity or 7 days in total, and users can see and revoke their own sessions | P0 |
| AUTH-6 | Developers must have signed in within the last 15 minutes to perform sensitive actions (permission changes, office deletion, global announcements) | P1 |
| AUTH-7 | The first Developer is created by a command-line step during setup, never through the UI. The last active Developer cannot be deactivated | P0 |

### 4.2 Offices and accounts (FR-ORG)

| ID | Requirement | Priority |
|---|---|---|
| ORG-1 | Developers create, edit and archive office profiles (name, code, address, contact, logo) | P0 |
| ORG-2 | Developers create admin accounts for an office | P0 |
| ORG-3 | Admins create user accounts for their own office only | P0 |
| ORG-4 | Accounts have a status: invited, active, or deactivated. Accounts are never hard-deleted, so the audit trail stays complete | P0 |
| ORG-5 | Profile pages show identity, role, office, last activity, and recent actions, to those allowed to view them | P0 |
| ORG-8 | A category is either Stock items or Custom records, chosen when it is created. Records such as work papers have their own columns and page, and stay out of inventory counts, stock moves, predictions and alerts | P1 |
| ORG-9 | Records can hold files (PDF, Office, text, CSV and images, up to 10 MB each and 20 per record). Files are checked by their contents, only download, and follow office separation | P1 |
| ORG-10 | Inventory, Records and Logs export to CSV and to PDF with a customizable header, following the table's filters, up to 5,000 rows. Exports need the export permission and are logged | P1 |
| ORG-7 | Admins set their office's workspace name and logo in Settings, and everyone can add a profile photo. Images are PNG, JPEG or WebP only | P1 |
| ORG-6 | Moving a user to another office is a Developer action, is audited, and removes access to the old office immediately | P1 |

### 4.3 Permissions (FR-PERM)

Example from the brief: an admin wants control of a specific feature, and the Developer allows it.

| ID | Requirement | Priority |
|---|---|---|
| PERM-1 | The code defines a catalog of named permissions (such as `item.delete`), and each has a role default | P0 |
| PERM-2 | Developers can allow or deny a permission for an office or a person, with a required reason and an optional expiry date | P0 |
| PERM-3 | Precedence: a person's rule beats an office rule, which beats the role default. At the same level, deny beats allow | P0 |
| PERM-4 | Changes apply on the affected user's next request, with no sign-out needed. The UI refreshes itself | P0 |
| PERM-5 | The server enforces every permission on every request. Hiding a button is only for convenience | P0 |
| PERM-6 | Admins can request a permission in the app. Developers approve or reject it, and the admin is notified | P1 |
| PERM-7 | Developers can mark a permission as delegable, so an admin who holds it can pass it to users in their office | P1 |
| PERM-8 | A permission screen shows the effective access for any account, and why (which rule decided) | P0 |

Some permissions can never be granted below Developer, including `office.manage`, `permission.grant`, and global audit access.

### 4.4 Office separation (FR-ISO)

| ID | Requirement | Priority |
|---|---|---|
| ISO-1 | Admins and users can read and write only their own office's data | P0 |
| ISO-2 | The database enforces separation, so a bug in application code still cannot return another office's rows | P0 |
| ISO-3 | Requesting another office's record returns "not found", so the response does not reveal that it exists | P0 |
| ISO-4 | Separation applies to everything: inventory, logs, search, exports, notifications, real-time events, cached data, AI answers and forecasts | P0 |
| ISO-5 | Transfers are the only cross-office action. Both offices see that transfer's record, and nothing else about each other | P0 |

### 4.5 Inventory (FR-INV)

| ID | Requirement | Priority |
|---|---|---|
| INV-1 | Users create, view, edit and delete items. Delete is reversible (soft delete) and restorable by an admin | P0 |
| INV-2 | Every item has standard columns: name, SKU or code, status, quantity, unit, location, condition, serial number, supplier, unit cost, purchase date, warranty expiry, notes. A category can turn off location, supplier, unit cost and purchase date | P0 |
| INV-3 | Users create categories, and each category can add its own custom columns (FR-CAT) | P0 |
| INV-4 | Quantity changes only through recorded stock movements (receive, issue, adjust, return, transfer), each with a reason. The history can always explain the current number | P0 |
| INV-5 | If two people edit one item at once, the second is warned and shown what changed, rather than silently overwriting | P0 |
| INV-6 | Tables have server-side pagination, sorting, filtering, search, column show/hide, and saved views | P0 (saved views P1) |
| INV-7 | Each item page shows its details, stock history, assignment history and activity | P0 |
| INV-8 | CSV/XLSX import with a preview, per-row validation errors, and a mapping step; runs in the background | P1 |
| INV-9 | CSV/XLSX export of the current filter; runs in the background, and the file link expires | P1 |
| INV-10 | Bulk edit, delete and move, with one audit entry per item | P1 |
| INV-11 | Photo and document attachments, virus-scanned | P2 |
| INV-12 | QR/barcode labels and phone-camera scanning | P2 |

### 4.6 Custom categories (FR-CAT)

| ID | Requirement | Priority |
|---|---|---|
| CAT-1 | Each office has its own categories, with nesting up to 3 levels | P0 |
| CAT-2 | Column types: short text, long text, integer, decimal, currency, date, date-time, yes/no, single select, multi-select, URL, email, person. File type is P2 | P0 |
| CAT-3 | Each column has a label, help text, required flag, default, validation (min, max, pattern, allowed options), unit, display order, and whether it is shown, filterable and sortable | P0 |
| CAT-4 | Item forms and tables are generated from these definitions, and the server validates against them | P0 |
| CAT-5 | Columns can be renamed, reordered or retired without losing data. Changes that would break existing data are blocked and explained | P0 |
| CAT-6 | A category holding items can only be archived, not deleted | P0 |
| CAT-7 | Starter templates (IT equipment, office supplies, furniture, medical, vehicles) can be copied and changed | P1 |
| CAT-8 | Limits to protect performance: 50 columns per category, 5 indexed columns per category | P0 |

### 4.7 Assignments and automatic announcements (FR-ASG)

Example from the brief: "This item was given to this office since (date), by (person)".

| ID | Requirement | Priority |
|---|---|---|
| ASG-1 | An item can be assigned to an office or a person, recording who assigned it, the start date, and an optional return date | P0 |
| ASG-2 | Transfers between offices follow start → accept or reject → complete. Stock moves only on accept | P0 |
| ASG-3 | A background job announces each completed assignment or transfer to affected accounts: "*Item X was given to Office Y since 2 Nov 2026, by Maria Santos*" | P0 |
| ASG-4 | Scheduled jobs send reminders: return date near or overdue, out of stock, warranty expiring, transfer awaiting a response | P0 |
| ASG-5 | Item pages show the full custody chain | P0 |

### 4.8 Notifications and announcements (FR-NTF)

| ID | Requirement | Priority |
|---|---|---|
| NTF-1 | In-app notification center with unread count, delivered in real time, and kept for reading later | P0 |
| NTF-2 | Developers send announcements to everyone, chosen offices, or a role. Admins send to their own office | P0 |
| NTF-3 | Announcements can be scheduled, marked urgent, and have read tracking. Urgent ones appear as a banner until acknowledged | P0 |
| NTF-4 | Sending is resilient: if the app restarts mid-send, each person still gets it exactly once | P0 |
| NTF-5 | Users choose which optional notification types they receive. Urgent and security messages cannot be turned off | P1 |
| NTF-6 | Email delivery for urgent items and digests | P1 |

### 4.9 Audit logs and monitoring (FR-LOG)

| ID | Requirement | Priority |
|---|---|---|
| LOG-1 | Every data change, sign-in, failed sign-in, permission change, export, and AI question is logged: who, role, office, action, record, before and after values, time, IP address, and request ID | P0 |
| LOG-2 | A change and its log entry succeed or fail together | P0 |
| LOG-3 | Nobody, including Developers, can edit or delete log entries through the app, and the database rejects it. Tampering is detectable | P0 |
| LOG-4 | Admins see all actions in their office. Developers see everything. Users see their own | P0 |
| LOG-5 | Logs can be filtered by person, action, record, office and date, and each entry shows a before/after comparison | P0 |
| LOG-6 | Log export, itself logged | P1 |
| LOG-7 | Developers can also see system events: errors, job runs and failures, rate-limit hits, AI usage and response times | P0 |
| LOG-8 | A Developer viewing office data is itself logged | P0 |

**Real-time monitoring**

| ID | Requirement | Priority |
|---|---|---|
| MON-1 | Developers see a live activity feed across all accounts, and who is online per office. Admins see the same for their office | P0 |
| MON-2 | The feed can be filtered and paused, and catches up after reconnecting without missing events | P0 |
| MON-3 | A Developer health view shows system status, job queues, error rate, response times, and AI queue length and speed | P0 |
| MON-4 | Alerts for unusual activity such as many failed sign-ins, mass deletes, or large exports | P1 |

### 4.10 Dashboards (FR-DASH)

| Role | Contents | Priority |
|---|---|---|
| **Developer** | Offices, accounts, online now, system health, job status, activity across offices, stock risk by office, AI usage and speed, pending permission requests | P0 |
| **Admin** | Office stock value and counts, charts by status and category, out-of-stock items and predicted stock-outs, live staff activity, pending transfers, recent changes, staff list | P0 |
| **User** | My recent work, items needing attention, assignments to me, announcements, quick actions, predictions for my office | P0 |

Each dashboard loads section by section, so one slow or failed section does not block the others.

### 4.11 AI predictions (FR-PRED)

| ID | Requirement | Priority |
|---|---|---|
| PRED-1 | For items with enough history: expected demand, predicted stock-out date, and suggested reorder quantity and date, with a range | P0 |
| PRED-2 | Items with too little history say "not enough history" instead of a guess | P0 |
| PRED-3 | Other signals: unusual movements, slow or dead stock, items nearing end of warranty | P1 |
| PRED-4 | Every account sees predictions for its own scope. Developers can compare offices | P0 |
| PRED-5 | Every prediction shows its confidence and a plain-language reason. Each is advisory, and nothing changes automatically | P0 |
| PRED-6 | Forecasts refresh nightly in the background, and recorded accuracy is visible to Developers | P0 |

### 4.12 AI assistant (FR-RAG)

| ID | Requirement | Priority |
|---|---|---|
| RAG-1 | A chat panel available from anywhere answers questions from the app's data, with responses that appear as they are written | P0 |
| RAG-2 | It handles exact questions ("how many laptops were issued last month?") and fuzzy ones ("anything like the old projectors?") | P0 |
| RAG-3 | Answers link to the source records. If the data doesn't contain the answer, it says so | P0 |
| RAG-4 | It sees only what the person asking may see: same office and permission rules. Asking it to ignore its rules gives no extra access | P0 |
| RAG-5 | It can read only. Text stored in inventory fields is treated as data, never as instructions | P0 |
| RAG-6 | Every question, the data consulted, and the answer are logged | P0 |
| RAG-7 | Conversation history per user, and per-user daily usage limits | P0 |
| RAG-8 | Thumbs up/down feedback, feeding the evaluation set | P1 |
| RAG-9 | If AI is unavailable, the panel says so, and the rest of the app works normally | P0 |

### 4.13 Interface (FR-UI)

Full specification in [Design.md](Design.md).

| ID | Requirement | Priority |
|---|---|---|
| UI-1 | Enterprise-grade look built from customized shadcn/ui | P0 |
| UI-2 | Light, dark and system modes, with every shadcn color theme selectable | P0 |
| UI-3 | UI scale: Compact 90%, Normal 100%, Large 125%, remembered per user | P0 |
| UI-4 | Collapsible sidebar, top navbar, and centered content that isn't full width | P0 |
| UI-5 | Smooth transitions, and a minimalist font | P0 |
| UI-6 | Loading skeletons shaped like the final content | P0 |
| UI-7 | Clear offline state, with visible last-loaded data and writes paused | P0 |
| UI-8 | Paginated tables everywhere lists can grow | P0 |
| UI-9 | Global search and command palette (Ctrl/Cmd+K) | P0 |
| UI-10 | Keyboard accessible and WCAG 2.2 AA, including at every theme and scale | P0 |
| UI-11 | Usable on tablets and phones; complex tables adapt rather than break | P0 |

---

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| **Availability** | 99.9% monthly for core features. AI, real-time updates and exports can fail without affecting them |
| **Recovery** | At most 5 minutes of data loss (RPO) and 1 hour to restore (RTO). Restores are rehearsed quarterly |
| **Performance** | p95: page data under 300 ms, mutation under 500 ms, real-time event under 2 s. Budgets at the A4 scale. AI speed depends on the machine: on the current PC (CPU only, about 12 tokens per second in a first test), people see their queue position and answers as they are written. The AI speed target is set when the final machine is chosen |
| **Scalability** | App instances are stateless and can be added horizontally. Background work runs separately from web traffic |
| **Rate limiting** | Per user and per IP, with stricter limits on sign-in, AI, and exports. Limited requests get a clear "try again in N seconds" |
| **Security** | OWASP ASVS Level 2 as the target. Security headers, encrypted transport and storage, no secrets in code, dependency scanning, and an external penetration test before launch |
| **Privacy** | Collect only what is needed, redact personal data from system logs, and send the AI only the minimum data for each question |
| **Reliability** | Retried requests can't double-apply, failed jobs retry and then go to a reviewable failure queue, and deployments have no downtime |
| **Observability** | Structured logs, metrics and traces linked by request ID, with on-call alerts |
| **Accessibility** | WCAG 2.2 AA |
| **Browsers** | Current and previous versions of Chrome, Edge, Firefox and Safari |
| **Quality** | Automated unit, integration, isolation and end-to-end tests in CI; a change can't merge if the isolation tests fail |

---

## 6. Key user journeys

**A. Office setup.** A Developer creates an office and its admin account → the admin signs in with an emailed code → the admin creates user accounts → users sign in and start with an empty state that guides them to create a category.

**B. Permission grant.** An admin asks to control item deletion → the Developer sees the request, approves it with an expiry date → the admin gets the feature on their next page load, with a notification → grant and use are both logged.

**C. Daily work.** A user creates "Laptops" with columns for RAM, CPU and warranty → adds items → issues one to a colleague → the admin sees this live, with a before/after log entry.

**D. Transfer.** An admin transfers 10 chairs → the other office's admin accepts → stock moves in one transaction → a background job announces "10 chairs were given to Office B since 2 Nov 2026, by …" to both offices.

**E. Prediction.** A nightly job finds that toner will run out in about 12 days → the admin gets a notification with confidence and reason → they open the item and reorder through their usual process.

**F. Question.** A user asks "which items are under warranty until next quarter?" → the assistant answers with links, using only that user's office data. The same user asking about another office gets no data from it.

**G. Lost connection.** The network drops → a banner appears, the current data stays readable and is marked as possibly stale, and save buttons pause → when the connection returns, the banner clears and data refreshes.

---

## 7. Release plan

**Status on 2026-11-02:** Phases 0, 1 and 2 are built. Your pilot check is still open. See "Not yet built" below.

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Foundation** | Project setup, database, email code sign-in, office separation, permission engine, audit logging, app shell, themes, scaling, CI | Isolation test suite passes; security-header spike resolved |
| **1. Core inventory** | Offices, accounts, categories, items, stock movements, tables, dashboards, profiles, rate limiting, offline state | A pilot office can do real work |
| **2. Operations** | Worker, assignments, transfers, notifications, announcements, real-time monitoring, log viewer, health view | Journeys A–D and G pass end to end |
| **3. Intelligence** | Forecasts, embeddings, AI assistant, AI usage controls and evaluations | Journeys E and F pass; AI quality targets met |
| **4. Hardening and launch** | Load test, penetration test, restore rehearsal, accessibility audit, runbooks, rollout | All section 5 targets verified |
| **5. Post-launch** | P1 and then P2 items | Driven by usage |

**Scope notes:** assignments go to a person, and giving stock to another office is a transfer. Error rate and response times on the health screen need the Phase 4 monitoring tools.

---

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Data leaks between offices | Severe | Database-level enforcement, automated isolation tests that block merges, scoped cache keys |
| Inventory text manipulates the AI (prompt injection) | High | Read-only tools, scope taken from the session and never from the model, no links or images from model output to outside sites, red-team evaluation cases |
| Someone gets into a person's email and can sign in as them | High | 2-Step Verification on email accounts, instant deactivation, sign-in logs, short sessions |
| Developer accounts hold broad access | High | Recent sign-in for sensitive actions, read-only inventory, full logging, a small number of accounts |
| Forecasts are wrong or trusted too much | Medium | Confidence, "not enough history", backtesting, advisory only |
| Local AI is slow when several people use it | High | Queue with visible position, per-user limits, the rest of the app unaffected, a stronger machine before wider rollout |
| The small model gives wrong answers | High | Exact numbers come from database tools, answers cite records, the evaluation set must pass, and the model can be changed by config |
| The machine running the app is off or fails | High | Only suitable for development on one PC. Choose an always-on machine with backups before real offices use it |
| Custom columns become slow at scale | Medium | Column limits, targeted indexes, load tests at target scale |
| Audit data grows large | Medium | Monthly partitions, archiving per retention policy |
| Next.js 16 features change, some being experimental | Low | Pinned versions, thin wrappers around experimental APIs, upgrade testing |

---

## 9. Open decisions for the product owner

1. Confirm assumptions A1, A2 and A3, since they affect the architecture.
2. Provide audit retention rules (A5), if legal or policy requirements exist.
3. Choose the final machine before real offices use the app. Development runs on the current PC for now, and Vercel is not used.
