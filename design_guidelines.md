# ZeySense Hub - Design Guidelines

## Design Approach

**Reference-Based**: Drawing from GameSense, Discord Dashboard, Razer Synapse, and Nvidia GeForce Experience for premium gaming aesthetic. Cyberpunk-meets-modern-UI with heavy emphasis on depth, contrast, and technological sophistication.

## Typography

**Font Families** (Google Fonts):
- Primary: Inter (400, 500, 600, 700) - UI text, body content
- Display: Rajdhani (600, 700) - Headings, stats, numbers
- Monospace: JetBrains Mono (400, 500) - Bot codes, technical data

**Hierarchy**:
- Hero/Display: Rajdhani 700, 72px (desktop) / 48px (mobile)
- H1: Rajdhani 700, 48px / 32px
- H2: Rajdhani 600, 36px / 28px
- H3: Inter 600, 24px / 20px
- Body: Inter 400, 16px
- Small/Caption: Inter 400, 14px
- Code/Technical: JetBrains Mono 400, 14px

## Layout System

**Spacing Units**: Tailwind 2, 4, 6, 8, 12, 16, 24 for consistent rhythm
**Container**: max-w-7xl with px-6 (mobile) / px-8 (desktop)
**Section Padding**: py-16 (mobile) / py-24 (desktop)

## Component Library

### Hero Section (Full viewport with image)
- Full-width dramatic background image with gradient overlays for depth
- Centered content with large display typography
- Primary CTA with backdrop-blur-md background effect
- Floating glass-morphism card displaying "Active Users: 12,453 | Bots Online: 8,721"
- Subtle grid pattern overlay for cyberpunk feel

### Authentication Pages
- Centered card (max-w-md) with glass-morphism effect (backdrop-blur-lg, border with subtle glow)
- Logo at top with glow effect
- Input fields with icon prefixes, full-width with rounded-lg borders
- Invite code input with verification status indicator
- Submit button with full width, elevated with shadow
- Footer links for "Need an invite?" / "Back to home"

### Dashboard Layout
**Sidebar Navigation** (w-64 fixed):
- Logo section with username/avatar at top
- Navigation items with icons (Heroicons), active state with border-l-4 accent indicator
- Bottom section for profile quick-access and logout
- Expandable admin section for Admin/Owner roles

**Main Content Area**:
- Header bar with breadcrumb, search, notifications, profile dropdown
- Grid-based stat cards (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- Each stat card: Icon, large number (Rajdhani), label, trend indicator

### AFK Bot Management Panel
- Table view with alternating row treatment
- Columns: Status indicator (pulsing dot), Bot Name, Server, Uptime, Actions
- Quick action buttons (Play, Pause, Stop, Settings) as icon buttons
- Filtering/sorting toolbar above table
- "Add New Bot" prominent CTA button (top-right)
- Individual bot cards option for mobile (stacked view)

### Profile System
**Profile Header**:
- Large avatar with level ring indicator
- Username with role badge, member since date
- Stats row: Total Runtime, Bots Managed, Servers Connected

**Achievements Section**:
- Grid layout (grid-cols-2 md:grid-cols-3 lg:grid-cols-4)
- Achievement cards with icon, title, description, progress bar
- Locked achievements shown with reduced opacity
- Rarity indicators (Common, Rare, Epic, Legendary)

### Admin/Owner Panels
- User management table with search/filter
- Invite code generator with copy functionality
- System analytics dashboard with charts (use Chart.js placeholders)
- Audit log with timestamp, user, action columns
- Privilege escalation controls with confirmation modals

### Live Chat Support
**Chat Widget** (fixed bottom-right):
- Collapsed: Floating button with unread badge
- Expanded: 400px wide, 600px tall card
- Chat header with minimize/close controls
- Message list with avatar, username, timestamp
- Input field with emoji picker button, attachment button
- Send button with icon
- Online support status indicator at top

### Navigation Patterns
- Dashboard: Persistent sidebar with hamburger menu for mobile
- Landing/Marketing: Fixed top navbar with logo left, nav links center, CTA right
- Mobile: Slide-out drawer navigation

### Modal System
- Centered overlay with backdrop blur
- Content card with header, body, footer sections
- Confirmation modals for destructive actions
- Settings modals for bot configuration with tabbed interface

### Form Elements
- Input fields: Full-width with rounded-lg, icon support, focus states with accent glow
- Switches: Modern toggle design for settings
- Dropdowns: Custom styled with icons and descriptions
- Buttons: Primary (solid), Secondary (outline), Ghost (text-only)
- All inputs include clear error/success states with validation messages

## Images

**Hero Section**: 
- Dramatic Minecraft-themed cyberpunk scene (1920x1080 minimum)
- Show futuristic server room or neon-lit Minecraft world with tech overlays
- Should support gradient overlays (dark to transparent top-to-bottom)
- Buttons placed on image require backdrop-blur-md backgrounds

**Dashboard Illustrations**:
- Empty state illustrations for "No Bots Added Yet"
- Achievement badge icons (64x64, SVG preferred)
- Bot status illustrations for different states

**Profile Avatars**:
- User avatars (circular, 40px-128px various sizes)
- Default avatar generator for new users

**Feature Icons**: Use Heroicons library exclusively for UI icons (dashboard, settings, stats, chat, notifications)

## Key Design Principles

1. **Depth Layering**: Multiple elevation levels using shadows and backdrop blur
2. **Accent Sparingly**: Use accent color for active states, CTAs, status indicators - not everywhere
3. **Cyber Grid**: Subtle grid/pattern overlays in backgrounds for tech aesthetic
4. **Data Visualization**: Charts and graphs with clean, modern styling
5. **Responsive Priority**: Mobile-first approach, touch-friendly targets (min 44px)
6. **Loading States**: Skeleton screens for data-heavy sections, pulse animations
7. **Micro-interactions**: Smooth transitions (150-300ms) for state changes, no excessive animations