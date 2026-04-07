# NovaKart Architecture Document

## 1. System Goal

NovaKart simulates a production-style e-commerce order lifecycle using deterministic multi-agent orchestration.
The architecture enforces strict role boundaries, reproducible behavior via seed-driven logic, and traceable state transitions.

## 2. Runtime Components

- `React Dashboard` (`demo-app`)
  - Live Tracking view (agent handoffs and stage timeline)
  - System Console view (raw protocol logs + quantitative metrics)
  - Inventory Sheet (catalog cards with images and stock signals)
- `FastAPI Service` (`run.py`)
  - `POST /api/run` to trigger asynchronous pipeline execution
  - `GET /api/logs/{run_id}` to fetch transition history
- `PipelineOrchestrator`
  - Controls state-machine sequence and retry logic
  - Emits protocol messages to logger on every transition
- `SQLite RunLogger`
  - Persists transition history in `runs.db`

## 3. Agent Responsibilities

- `OrderAgent`
  - Generates base `OrderData` (customer, item, quantity, amount)
  - Establishes `ORDER_PLACED` stage payload
- `InventoryAgent`
  - Computes stock confidence and stock status
  - Builds inventory catalog payload with image metadata
  - Sets `selected_sku` for currently ordered product
- `PaymentAgent`
  - Calculates fraud risk and transaction status
  - Supports retry-aware verification behavior
- `DeliveryAgent`
  - Applies pass/fail criteria
  - Assigns shipping partner and delivery estimate

## 4. State Machine

`IDLE -> ORDER_PLACED -> VERIFIED -> PACKED -> SHIPPED -> DELIVERED | FAILED`

Transition control is centralized in `PipelineOrchestrator`; no single agent bypasses state ordering.

## 5. Data Contracts

### 5.1 MessageProtocol (logged event)

```json
{
  "run_id": "uuid",
  "agent": "InventoryAgent",
  "state": "VERIFIED",
  "order_id": "1",
  "payload": {},
  "timestamp": "UTC datetime"
}
```

### 5.2 InventoryAgent payload additions

`VERIFIED` payload now includes:
- `stock_status`
- `confidence`
- `selected_sku`
- `inventory_catalog[]`

Each `inventory_catalog` item includes:
- `sku`
- `name`
- `category`
- `image`
- `price`
- `stock_units`
- `stock_status`

## 6. Failure Handling and Retry

- `PaymentAgent` + `DeliveryAgent` run in a bounded retry loop (`max_retries=2`).
- If pass conditions are not met, the orchestrator retries until success or exhaustion.
- Final system states:
  - `DELIVERED` with execution metrics
  - `FAILED` with terminal reason

## 7. UI/UX Architecture Notes

- Dashboard branding: `NovaKart`
- Cinematic transition system:
  - Agent-to-agent handoff animations
  - System Console entry transitions
  - Inventory sheet open transition inspired by mobile app motion
- Inventory sheet is data-driven by `InventoryAgent` payload, not static-only UI data.
