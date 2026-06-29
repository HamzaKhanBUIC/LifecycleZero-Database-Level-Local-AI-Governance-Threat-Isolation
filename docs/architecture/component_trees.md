# LifecycleZero: Frontend Component Hierarchies & Trees

This document maps out the React component hierarchies, mounted node structures, and state relationships for the LifecycleZero frontend client.

---

## 🗺️ 1. Multi-Page Component Trees

### 🏠 Tree A: Root Landing & Marketing Page (`/`)
*   **Path**: `src/app/page.tsx`
*   **Role**: Public B2B acquisition portal and initial route selector.

```mermaid
graph TD
    %% Styling Classes
    classDef page fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    classDef component fill:#0f172a,stroke:#475569,stroke-width:1px,color:#cbd5e1
    classDef provider fill:#064e3b,stroke:#10b981,stroke-width:1.5px,color:#fff

    RootLayout[RootLayout - src/app/layout.tsx] -->|Wraps| Providers
    Providers[Providers - ClerkProvider]
    Providers -->|Mounts Route| LandingPage[LandingPage - src/app/page.tsx]
    
    subgraph LandingPage Component Hierarchy
        LandingPage --> Navbar[Header / Marketing Nav]
        Navbar --> Logo[Brand Logo]
        Navbar --> UserActions[Clerk Sign-In / User State]

        LandingPage --> Hero[Hero Visual Section]
        Hero --> LaunchSandboxBtn[Button: Launch Sandbox Demo]
        Hero --> EnterprisePortalBtn[Button: Enterprise Portal]

        LandingPage --> Features[Features Grid Card List]
        Features --> PriceMetric[Price Metrics Card - $8/node/mo]

        LandingPage --> Footer[Public Navigation Footer]
    end

    class RootLayout,LandingPage page
    class Navbar,Logo,UserActions,Hero,LaunchSandboxBtn,EnterprisePortalBtn,Features,PriceMetric,Footer component
    class Providers provider
```

---

### 🔬 Tree B: Live Security Incident Cockpit (`/security`)
*   **Path**: `src/app/security/page.tsx` -> `src/components/Dashboard.tsx`
*   **Role**: Real-time SOC (Security Operations Center) dashboard and threat isolation command.

```mermaid
graph TD
    classDef page fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    classDef component fill:#0f172a,stroke:#475569,stroke-width:1px,color:#cbd5e1
    classDef modal fill:#450a0a,stroke:#ef4444,stroke-dasharray: 5 5,color:#fff

    SecurityPage[SecurityPage - src/app/security/page.tsx] -->|Mounts Client Component| Dashboard[Dashboard - src/components/Dashboard.tsx]
    
    subgraph Dashboard Inner Layout Tree
        Dashboard --> Navbar[Header Navigation]
        Navbar --> TenantSelector[Dropdown: Active Tenant ID]
        Navbar --> MuteButton[Toggle: Audio Mute]
        Navbar --> UserStatus[User Button / ADM Bypass Badge]

        Dashboard --> Marquee[Marquee Live Telemetry Stats Ticker]

        Dashboard --> GridContainer[Grid Dashboard Container]
        
        %% Metrics Row
        GridContainer --> MetricCard1[MetricCard: ASSETS_TRACKED]
        GridContainer --> MetricCard2[MetricCard: ROGUE_MODELS]
        GridContainer --> MetricCard3[MetricCard: ISOLATED_HOSTS]
        GridContainer --> MetricCard4[MetricCard: ACTIVE_THREATS]

        %% Sidebar Column
        GridContainer --> SidebarColumn[Left Sidebar Column]
        SidebarColumn --> NavigationControls[Dashboard Route Navigation Buttons]
        SidebarColumn --> BillingCard[B2B Billing & Quota Progress Card]
        BillingCard --> UpgradeBtn[Button: Upgrade to Enterprise]

        %% Mid Column
        GridContainer --> MidColumn[Middle Content Column]
        MidColumn --> IncidentFeed[Incident Feed Alerts List]
        IncidentFeed --> IncidentCards[Incident Card Nodes]
        IncidentCards --> IsolateBtn[Button: Isolate Host]

        %% Right Column
        GridContainer --> RightColumn[Right Content Column]
        RightColumn --> Canvas3DGrid[Tactical3DGrid - HTML5 Canvas 3D SOC Grid]
        RightColumn --> OllamaConfigCard[Ollama Threat AI Config Form]
        RightColumn --> SandboxCard[Threat Simulation Sandbox panel]
        SandboxCard --> RunSimBtn[Button: Run Threat Simulation]
        SandboxCard --> ConsoleLog[Terminal Simulator Logs Screen]
    end

    subgraph Overlay Modals
        Dashboard -.->|showPaymentModal = true| StripeModal[Stripe Payment Checkout Modal]
        Dashboard -.->|confirmIsolate = Asset| IsolateConfirmModal[Isolation Confirmation Modal]
    end

    class SecurityPage,Dashboard page
    class Navbar,TenantSelector,MuteButton,UserStatus,Marquee,GridContainer,MetricCard1,MetricCard2,MetricCard3,MetricCard4,SidebarColumn,NavigationControls,BillingCard,UpgradeBtn,MidColumn,IncidentFeed,IncidentCards,IsolateBtn,RightColumn,Canvas3DGrid,OllamaConfigCard,SandboxCard,RunSimBtn,ConsoleLog component
    class StripeModal,IsolateConfirmModal modal
```

---

### 🏢 Tree C: Dashboard Layout & Fleet Assets View (`/dashboard/assets`)
*   **Path**: `src/app/dashboard/layout.tsx` -> `/assets/page.tsx`
*   **Role**: Administrative B2B layout wrapping assets grids.

```mermaid
graph TD
    classDef page fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    classDef component fill:#0f172a,stroke:#475569,stroke-width:1px,color:#cbd5e1

    DashboardLayout[DashboardLayout - src/app/dashboard/layout.tsx] -->|Renders Layout Shell| Shell
    
    subgraph Shell Elements
        Shell --> LeftNavSidebar[Left Navigation Panel]
        LeftNavSidebar --> OrgSwitcher[Clerk Organization Switcher]
        LeftNavSidebar --> MenuRoutes[Menu Routes: Assets, Procurement]
        Shell --> ContentPane[Active View Panel]
    end

    ContentPane -->|Mounts Route| AssetsPage[AssetsPage - /assets/page.tsx]
    AssetsPage -->|Mounts Component| AssetFleetView[AssetFleetView - AssetFleetView.tsx]

    subgraph AssetFleetView Nested Children
        AssetFleetView --> FleetHeader[Fleet Search & Status Header]
        AssetFleetView --> AssetTable[Table: Hardware Inventory Grid]
        AssetTable --> TableRows[Row Component: Device Attributes]
        TableRows --> StatusBadge[Status Badge Pill]
        TableRows --> RowIsolateBtn[Action: Quick Isolate Button]
    end

    class DashboardLayout,AssetsPage page
    class Shell,LeftNavSidebar,OrgSwitcher,MenuRoutes,ContentPane,AssetFleetView,FleetHeader,AssetTable,TableRows,StatusBadge,RowIsolateBtn component
```

---

### 📈 Tree D: Asset Historical Detail & Log Timeline (`/dashboard/assets/[id]`)
*   **Path**: `src/app/dashboard/assets/[id]/page.tsx`
*   **Role**: Displays chronological CPU/RAM charts and SOC audit trail for a single workstation.

```mermaid
graph TD
    classDef page fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    classDef component fill:#0f172a,stroke:#475569,stroke-width:1px,color:#cbd5e1

    DashboardLayout[DashboardLayout] -->|Mounts Route| AssetDetailPage[AssetDetailPage - [id]/page.tsx]
    
    subgraph AssetDetailPage Hierarchy
        AssetDetailPage --> DetailHeader[Header: Device Name, Serial, UUID]
        
        %% Recharts Node
        AssetDetailPage --> ChartContainer[Recharts Area Chart Container]
        ChartContainer --> ResponsiveContainer[ResponsiveContainer]
        ResponsiveContainer --> AreaChart[AreaChart: RAM & CPU Telemetry History]
        AreaChart --> Tooltip[Tooltip]
        AreaChart --> AreaNodes[Area Series Nodes]
        
        %% Audit Trail
        AssetDetailPage --> AuditLogsSection[Audit Trail Chronological Log]
        AuditLogsSection --> TimelineNodes[Timeline Log Card Nodes]
        TimelineNodes --> BadgeActor[Badge Actor: System / User Admin]
    end

    class AssetDetailPage page
    class DetailHeader,ChartContainer,ResponsiveContainer,AreaChart,Tooltip,AreaNodes,AuditLogsSection,TimelineNodes,BadgeActor component
```

---

### 📦 Tree E: Procurement Logistics Pipeline Board (`/dashboard/procurement`)
*   **Path**: `src/app/dashboard/procurement/page.tsx` -> `ProcurementQueueView.tsx`
*   **Role**: Handles submission and approvals tracking for B2B fleet logistics.

```mermaid
graph TD
    classDef page fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    classDef component fill:#0f172a,stroke:#475569,stroke-width:1px,color:#cbd5e1

    DashboardLayout[DashboardLayout] -->|Mounts Route| ProcurementPage[ProcurementPage - /procurement/page.tsx]
    ProcurementPage -->|Mounts Component| ProcurementQueueView[ProcurementQueueView - ProcurementQueueView.tsx]

    subgraph ProcurementQueueView Hierarchy
        ProcurementQueueView --> SubmitForm[Form: Submit Logistics Request]
        ProcurementQueueView --> BoardGrid[Flex Grid: Pipeline Board]
        
        %% Kanban Columns
        BoardGrid --> Column1[Kanban Column: PENDING APPROVAL]
        BoardGrid --> Column2[Kanban Column: PROCURING]
        BoardGrid --> Column3[Kanban Column: IN TRANSIT]
        
        %% Cards
        Column1 --> RequestCards[Logistics Request Cards]
        RequestCards --> ActionButtons[Buttons: Approve Request, Reject Request]
    end

    class ProcurementPage page
    class ProcurementQueueView,SubmitForm,BoardGrid,Column1,Column2,Column3,RequestCards,ActionButtons component
```
