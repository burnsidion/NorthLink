# 🎄 NorthLink

A festive Christmas wish list application that helps families coordinate gift-giving without spoiling surprises. Built with Next.js, Supabase, and holiday magic.

## ✨ Features

### Core Functionality

- **📝 Personal Wish Lists** - Create and manage multiple wish lists with items, prices, and links
- **👨‍👩‍👧‍👦 Family Groups** - Join or create family groups to share lists
- **🎁 Purchase Tracking** - Mark items as purchased without list owners seeing who bought them
- **🔒 Privacy First** - List owners can't see who purchased their items, preserving the surprise

### Advanced Features

- **⭐ Most Wanted** - Flag your must-have items so shoppers know what you really want
- **🏷️ On Sale** - Mark items that are currently discounted
- **🎯 Smart Filtering** - Filter by Most Wanted or On Sale items
- **💰 Price Sorting** - Sort items by price (low to high, high to low)
- **🔔 Activity Notifications** - Get notified when items from your lists are purchased
- **📱 Responsive Design** - Beautiful experience on mobile and desktop

### Festive UI/UX

- **❄️ Snowfall Animation** - Animated snowflakes with occasional shooting meteors
- **🎆 Confetti Celebrations** - Festive animations when items are purchased
- **🎅 Multi-Step Purchase Flow** - Delightful loading states ("Contacting the elves...", "Checking it twice...")
- **🌟 Gradient Cards** - Mobile-optimized gradient backgrounds with spotlight effects
- **⏰ Christmas Countdown** - Live countdown banner to Christmas Day

## 🚀 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router)
- **Language**: TypeScript
- **Database**: [Supabase](https://supabase.com) (PostgreSQL)
- **Authentication**: Supabase Auth (Magic Link)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **UI Components**:
  - Aceternity UI (CardSpotlight, MultiStepLoader)
  - Magic UI (StatefulButton, StatefulCheckbox, Confetti)
  - Custom components (Snowfall, StarsBackground, FestiveGlow)

## 📁 Project Structure

```
northlink/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (authed)/          # Protected routes
│   │   │   ├── landing/       # Dashboard
│   │   │   ├── lists/[id]/    # List detail page
│   │   │   ├── user-lists/    # User's own lists
│   │   │   ├── family-lists/  # Shared family lists
│   │   │   └── purchased-items/ # Purchase history
│   │   ├── login/             # Authentication
│   │   ├── onboarding/        # Profile setup
│   │   └── actions/           # Server actions
│   ├── components/
│   │   ├── family/            # Family group components
│   │   ├── items/             # Item management components
│   │   ├── lists/             # List components
│   │   ├── nav/               # Navigation components
│   │   └── ui/                # Reusable UI components
│   ├── lib/                   # Utilities and helpers
│   │   ├── auth-helpers.ts    # Authentication utilities
│   │   ├── list-helpers.ts    # List management utilities
│   │   ├── family-group-helpers.ts # Family group utilities
│   │   ├── confetti-helpers.ts # Confetti animations
│   │   ├── items-api.ts       # Item CRUD operations
│   │   ├── format.ts          # Formatting utilities
│   │   └── supabase.ts        # Supabase client
│   ├── types/
│   │   └── db.ts              # Database type definitions
│   └── config/
│       └── nav-links.tsx      # Navigation configuration
└── supabase/
    └── migrations/            # Database migrations
```

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+
- npm/yarn/pnpm
- Supabase account

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/burnsidion/NorthLink.git
   cd northlink
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server**

   ```bash
   npm run dev
   ```

5. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000)

### Database Setup

The app requires the following Supabase tables:

- `profiles` - User profiles (display_name, avatar_url)
- `groups` - Family groups (name, invite_code)
- `group_members` - Group membership (user_id, group_id, role)
- `lists` - Wish lists (title, owner_user_id, last_viewed_at)
- `list_shares` - Shared lists (list_id, group_id)
- `items` - List items (title, price_cents, link, notes, purchased, purchased_by, purchased_at, most_wanted, on_sale)

See `supabase/migrations/` for the complete schema.

## 🎨 Key Features Explained

### Purchase Flow

1. Shopper clicks checkbox on an item
2. Multi-step loader appears with festive messages
3. Item is marked as purchased in database
4. Confetti celebration triggers
5. List owner sees increased purchase count (but not who purchased)

### Family Groups

- Create a group and get an invite code
- Share code with family members
- Members can view all shared lists in the group
- Only list owners can edit their lists
- Shoppers can purchase items from any shared list

### Privacy Protection

- `purchased_by` field tracks who bought items
- List owners cannot see this field
- Row Level Security (RLS) policies enforce this
- Prevents gift surprises from being spoiled

## 📦 Build & Deploy

### Build for Production

```bash
npm run build
```

### Deploy to Vercel

The app is configured for Vercel deployment:

```bash
vercel deploy
```

Environment variables must be configured in Vercel dashboard.

## 🧹 Code Quality

The codebase follows these principles:

- **Helper Functions**: Reusable utilities in `src/lib/`
- **Type Safety**: Full TypeScript coverage
- **Component Composition**: Small, focused components
- **Server/Client Separation**: Clear distinction between server and client components
- **Real-time Updates**: Supabase subscriptions for live data

## 🎯 Roadmap

- [ ] Push notifications for purchases
- [ ] List templates (e.g., "Tech Gadgets", "Books")
- [ ] Budget tracking per family member
- [ ] Gift recommendation engine
- [ ] Export lists to PDF
- [ ] Multiple holiday support (birthdays, anniversaries)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is private and not licensed for public use.

## 👏 Acknowledgments

- **UI Components**: Aceternity UI, Magic UI
- **Icons**: Lucide Icons, Ant Design Icons
- **Animations**: Framer Motion, canvas-confetti
- **Backend**: Supabase

---

Built with ❤️ and holiday cheer by the Burnside family
