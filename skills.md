# Your Memories - Design & Technical Documentation

## Design Philosophy

### Core Principles

1. **Neutral Professional Aesthetic**
   - The entire application uses a monochromatic neutral palette
   - No colorful gradients or vibrant accent colors
   - Creates a premium, sophisticated feel that lets content stand out
   - Dark theme optimized for extended use

2. **Subtle Premium Effects**
   - White glare effects and soft borders instead of flashy colors
   - Blur-to-clear animations for smooth transitions
   - Progressive blur on scrollable content for depth
   - Animated border beams for visual interest without distraction

3. **No Emojis**
   - Strict rule: no emojis anywhere in the UI
   - Icons and typography convey meaning instead
   - Maintains professional, clean appearance

---

## Color Palette

### Primary Colors (Neutral Scale)
```css
/* Backgrounds */
bg-neutral-950     /* Main app background */
bg-neutral-900/60  /* Card backgrounds */
bg-neutral-900/50  /* Overlay backgrounds */
bg-neutral-800     /* Active states, badges */
bg-neutral-800/60  /* Icon containers */

/* Borders */
border-neutral-800  /* Default borders */
border-neutral-700  /* Hover states */
border-neutral-600  /* Focus states */

/* Text */
text-white          /* Primary text */
text-neutral-200    /* Secondary text */
text-neutral-300    /* Tertiary text */
text-neutral-400    /* Muted text, icons */
text-neutral-500    /* Timestamps, hints */
text-neutral-600    /* Placeholders */
```

### Effect Colors
```css
/* Border Beams */
from-neutral-600/40 via-neutral-500/40 to-neutral-600/40  /* Standard beam */
from-neutral-600/30 via-neutral-500/30 to-neutral-600/30  /* Subtle beam */

/* Hover States */
hover:border-neutral-700
hover:bg-neutral-800/60
hover:bg-neutral-700
```

---

## Animation System

### Page Transitions
Using `AnimatePresence` from motion/react with blur-to-clear effect:

```tsx
initial={{ opacity: 0, filter: 'blur(10px)' }}
animate={{ opacity: 1, filter: 'blur(0px)' }}
exit={{ opacity: 0, filter: 'blur(5px)' }}
transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
```

### Text Generate Effect
Words animate in with staggered blur-to-clear:
- Initial: `opacity: 0, filter: blur(10px)`
- Animate: `opacity: 1, filter: blur(0px)`
- Stagger delay: 0.2s between words

### Card Animations
```tsx
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
whileHover={{ scale: 1.01 }}
transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
```

### Loading States
- Neutral spinner: `border-neutral-600 border-t-transparent animate-spin`
- Pulsing dots: `bg-neutral-500 animate-pulse`

### Number Animations
Animated counter effect for dashboard stats:
- 30 steps over 1 second
- Incremental count-up from 0 to target value

---

## UI Components (Aceternity UI)

### BorderBeam
Animated border effect that travels around card edges:
```tsx
<BorderBeam 
  size={200} 
  duration={10} 
  borderWidth={1.5} 
  className="from-neutral-600/40 via-neutral-500/40 to-neutral-600/40" 
/>
```

### ProgressiveBlur
Fade-out blur effect at the bottom of scrollable content:
```tsx
<ProgressiveBlur
  height="60px"
  position="bottom"
  className="pointer-events-none"
/>
```

### LampContainer
Used exclusively in onboarding for dramatic lighting effect.

### OrbitingCircles
Used in onboarding to show supported AI platforms.

### StarsBackground & ShootingStars
Ambient background effects throughout the app.

### TextGenerateEffect
Staggered word-by-word text reveal animation.

---

## Tech Stack

### Frontend
- **React** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **motion/react** (Framer Motion) - Animations
- **Aceternity UI** - Premium UI components
- **react-markdown** - Markdown rendering
- **Tabler Icons** - Icon library
- **Lucide React** - Additional icons

### Backend (Electron Main Process)
- **Electron** - Desktop application framework
- **better-sqlite3** - SQLite database
- **electron-vite** - Build tooling

### AI Integrations
The app monitors and extracts conversations from:
- Claude (Desktop & Web)
- ChatGPT
- Gemini
- Perplexity
- Grok

---

## Layout Patterns

### Sidebar Navigation
- Collapsible sidebar using Aceternity Sidebar component
- Icon + label with animated show/hide
- Active state: `bg-neutral-800 text-white`
- Hover state: `bg-neutral-800/50 hover:text-white`

### Tab Bar
- Pill-style tabs with spring animation
- Active indicator uses `layoutId="activeTab"` for smooth transitions
- Neutral background: `bg-neutral-800/80 border border-neutral-700`

### Card System
```tsx
className="bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700"
```

### Bento Grid
Used in ChatDetail for flexible content layout:
- Summary takes ~50% height
- Memories and Entities split remaining 50% side-by-side
- Expandable sections with smooth transitions

---

## Scrolling Behavior

### Progressive Blur
All scrollable lists have a `ProgressiveBlur` component at the bottom:
```tsx
<ProgressiveBlur
  className="pointer-events-none absolute bottom-0 left-0 h-[80px] w-full"
/>
```

### Scroll Containers
```tsx
<div className="relative overflow-hidden">
  <div className="absolute inset-0 overflow-y-auto">
    {/* Content */}
  </div>
  <ProgressiveBlur ... />
</div>
```

---

## Component Hierarchy

```
App.tsx
├── StarsBackground
├── ShootingStars
├── Sidebar
│   └── SidebarBody (navigation items)
├── Tab Bar
└── Content Area (AnimatePresence)
    ├── Dashboard
    ├── ChatList → ChatDetail
    ├── MemoryList
    ├── EntityList
    ├── EntityGraph
    └── MemoryChat
```

---

## Badge & Tag Styling

### Standard Badge
```tsx
className="bg-neutral-800 text-neutral-400 border border-neutral-700"
```

### Count Pill
```tsx
className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-700 text-neutral-300"
```

### Type Tag
```tsx
className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded bg-neutral-800 text-neutral-400 border border-neutral-700"
```

---

## Input & Button Styling

### Text Input
```tsx
className="bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
```

### Primary Button
```tsx
className="bg-neutral-800 border border-neutral-700 text-white hover:bg-neutral-700 hover:border-neutral-600"
```

### Icon Button
```tsx
className="p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700"
```

---

## Empty States

Centered layout with muted icon and text:
```tsx
<div className="h-full flex flex-col items-center justify-center text-center px-4">
  <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-4">
    <Icon className="w-8 h-8 text-neutral-600" />
  </div>
  <p className="text-neutral-400 text-lg font-medium mb-2">Title</p>
  <p className="text-neutral-600 text-sm max-w-md">Description</p>
</div>
```

---

## Best Practices

1. **Consistency** - Always use the neutral palette, never introduce colors
2. **Hierarchy** - Use opacity and size to create visual hierarchy, not color
3. **Animations** - Keep animations subtle (0.3-0.5s), use blur-to-clear for polish
4. **Spacing** - Use consistent padding (p-4 for cards, p-6 for page content)
5. **Borders** - Default `border-neutral-800`, hover `border-neutral-700`
6. **Backdrop Blur** - Use `backdrop-blur-xl` or `backdrop-blur-sm` for depth
7. **Z-Index** - Stars at z-0, content at z-10, overlays higher

---

## File Structure

```
src/renderer/src/
├── components/
│   ├── ui/           # Aceternity & shared UI components
│   │   ├── border-beam.tsx
│   │   ├── progressive-blur.tsx
│   │   ├── text-generate-effect.tsx
│   │   ├── sidebar.tsx
│   │   ├── stars-background.tsx
│   │   ├── shooting-stars.tsx
│   │   ├── lamp.tsx
│   │   └── orbiting-circles.tsx
│   ├── Dashboard.tsx
│   ├── ChatList.tsx
│   ├── ChatDetail.tsx
│   ├── MemoryList.tsx
│   ├── MemoryChat.tsx
│   ├── EntityList.tsx
│   ├── EntityGraph.tsx
│   └── Onboarding.tsx
├── lib/
│   └── utils.ts      # cn() utility for classnames
└── assets/
    └── main.css      # Tailwind config
```
