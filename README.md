# Foundation Management System

A robust, full-stack Foundation Management System built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **FastAPI**, **SQLAlchemy 2.x**, and **PostgreSQL (Neon)**.

---

## 1. Project Architecture & Setup

### Codebase Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, shadcn/ui component patterns.
- **Backend**: FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, Psycopg 3.
- **Database**: PostgreSQL hosted on Neon DB with atomic sequences.

### Default Paths for Components and Styles
- **UI Components Default Path**: `components/ui/` (aliased as `@/components/ui` and linked via `/components/ui`).
- **Global Styles**: `app/globals.css` (aliased as `@/app/globals.css`).
- **Utility Functions**: `lib/utils.ts` (`cn` helper using `clsx` and `tailwind-merge`).
- **Config**: `components.json` (shadcn CLI configuration).

### Why the `components/ui` Folder is Important
1. **Separation of Concerns**: Differentiates atomic/primitive UI components (buttons, badges, inputs, sidebars) from domain-specific views or complex page business logic.
2. **Standardization with shadcn CLI**: The shadcn CLI specifically expects primitive UI components in `components/ui`. This allows adding or updating components (e.g., `npx shadcn@latest add ...`) without conflicts.
3. **Consistency & Reusability**: All modular pages (Group, Member, Beneficiary, Roles) consume standardized typography, subtle borders, focus rings, and color tokens from a single source of truth.

---

## 2. Integrated Modules

### A. Group Management Module
Integrated into the sidebar under the **Group** menu (with `Users` icon):
1. **Add Group** (`/groups/add`)
   - Mandatory Group Name.
   - Automatic, sequential unique code generation: `G-XXXX` (using Postgres sequence `group_code_seq`).
   - Custom Group Code support with uniqueness validation to prevent collisions.
   - Optional description, Active/Inactive status, automatic timestamp.
   - Protected by `groups.create` permission.
2. **Manage Group** (`/groups/manage`)
   - Responsive table displaying Group Code, Group Name, Description, Member Counts, Status, Created Date, and Actions.
   - Search by name or code; filter by Active/Inactive status; pagination.
   - Edit group details (`groups.update`) and activate/deactivate groups (`groups.deactivate`).
3. **Group Fund** (`/groups/fund`)
   - Audited balances: Group Code, Group Name, Total Funds Received, Total Funds Spent, Available Balance.
   - **Financial Integrity**: Calculated exclusively from actual recorded financial transactions in PostgreSQL (`group_fund_transactions`). Zero balances are shown with an explicit indicator if no transactions exist.
   - Modal transaction ledger with date range filters and pagination (`group_funds.ledger.view`).

### B. Member Management Module
Integrated into the sidebar under the **Member** menu (with `UsersRound` icon):
1. **Add Member** (`/members/add`)
   - Mandatory Member Name.
   - Mandatory Active Group selection from PostgreSQL via searchable dropdown. Inactive groups are disallowed.
   - **Automatic Member ID Allocation**: `M-0001`, `M-0002`, etc. Generated atomically by the backend via `member_id_seq`. No manual ID input is accepted.
   - Optional fields: Phone Number, Email, Address, Joining Date, Notes.
   - Protected by `members.create` permission.
2. **Manage Member** (`/members/manage`)
   - Responsive table: Member ID, Member Name, Group Name, Group Code, Phone, Joining Date, Status, Actions.
   - Search by Member ID or Name; filter by Group; filter by Status.
   - Server-side pagination (10, 25, 50, 100).
   - View details, edit information (allows group reassignment to another active group; Member ID remains strictly immutable), activate/deactivate.
   - Preserves all historical records when a member is deactivated.
3. **Member Due List** (`/members/due-list`)
   - Columns: Member ID, Member Name, Group Name, Group Code, Due Amount.
   - **Financial Integrity**: Does not fabricate or assume dues. Clearly indicates that due calculation will be integrated with the future dues and contributions module.
   - Protected by `members.due_list.view` permission.

### C. Beneficiary Management Module
Integrated into the sidebar under the **Beneficiary** menu (with `HandHeart` icon):
1. **Add Beneficiary** (`/beneficiaries/add`)
   - Mandatory Beneficiary Name.
   - **Automatic Beneficiary ID Allocation**: `B-0001`, `B-0002`, etc. Generated atomically via `beneficiary_id_seq`. No client-supplied ID is accepted.
   - Optional fields: Phone Number, Address, Registration Date, Status, Notes.
   - Protected by `beneficiaries.create` permission.
2. **Beneficiary Ledger** (`/beneficiaries/ledger`)
   - Searchable beneficiary selector displaying Beneficiary ID and Name.
   - Summary cards: Total Received, Total Disbursed, Current Balance.
   - Date range filters, transaction type filters, search, and pagination.
   - Responsive transaction table: Date, Reference, Description, Type, Amount Received, Amount Disbursed, Running Balance.
   - **Financial Integrity**: Running balance calculated chronologically and deterministically using `Decimal`/`NUMERIC` arithmetic.
   - Protected by `beneficiary_ledger.view` permission.
3. **Beneficiary Directory** (`/beneficiaries/manage`)
   - Directory to view, filter, edit, and activate/deactivate beneficiaries (`beneficiaries.view`).

---

## 3. Role-Based Access Control (RBAC)

The system includes granular, database-backed RBAC with permissions enforced on every backend endpoint and dynamically reflected in the frontend sidebar:

| Permission Key | Description | Module |
|---|---|---|
| `groups.view` | View groups and manage groups list | Groups |
| `groups.create` | Create new foundation groups | Groups |
| `groups.update` | Edit group details | Groups |
| `groups.deactivate` | Activate or deactivate groups | Groups |
| `group_funds.view` | View group fund balance summaries | Groups |
| `group_funds.ledger.view` | View group fund transaction ledger | Groups |
| `members.view` | View members and manage members list | Members |
| `members.create` | Register new foundation members | Members |
| `members.update` | Edit member details | Members |
| `members.activate` | Activate inactive members | Members |
| `members.deactivate` | Deactivate active members | Members |
| `members.due_list.view` | View member due list | Members |
| `beneficiaries.view` | View beneficiaries directory | Beneficiaries |
| `beneficiaries.create` | Register new beneficiaries | Beneficiaries |
| `beneficiaries.update` | Edit beneficiary details | Beneficiaries |
| `beneficiaries.activate` | Activate beneficiaries | Beneficiaries |
| `beneficiaries.deactivate` | Deactivate beneficiaries | Beneficiaries |
| `beneficiary_ledger.view` | View and audit beneficiary financial ledger | Beneficiaries |
| `roles.manage` | Configure and assign roles and permissions | Roles |

### Interactive Role Switcher
In the dashboard header and sidebar footer, a live **Role Switcher** allows switching between:
- **System Administrator**: Full access across all modules.
- **Field Officer**: Access to add and manage Groups, Members, Beneficiaries.
- **Finance Officer**: Access to Group Funds, Ledgers, and Due Lists.
- **Viewer**: Read-only directory access.

Submenus dynamically appear or disappear based on the active role's effective permissions. Unauthorized backend requests strictly return **HTTP 401** or **HTTP 403**.

---

## 4. Running the Application

### 1. Run Backend Server
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Run Frontend Development Server
```bash
npm run dev
# Accessible at http://localhost:3000
```

### 3. Run Automated Tests
```bash
python3 -m pytest tests/ -v
```

### 4. Build Production Bundle
```bash
npm run build
```
