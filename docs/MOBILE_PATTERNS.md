# Mobile-First Patterns & Best Practices

> Purpose: practical patterns for mobile-responsive components (layout, forms, tables, modals, navigation) and common pitfalls. Breakpoints, touch-size and safe-area utilities are listed in `DESIGN-SYSTEM.md` section 5; live examples at `/app/mobile-demo`.
> Last verified: 2026-09-20 (`client/tailwind.config.mjs`, `client/src/app/styles/mobile-responsive-utilities.css`).

## Table of Contents

1. [Responsive Layout Patterns](#responsive-layout-patterns)
2. [Component Patterns](#component-patterns)
3. [Typography Patterns](#typography-patterns)
4. [Navigation Patterns](#navigation-patterns)
5. [Form Patterns](#form-patterns)
6. [Table Patterns](#table-patterns)
7. [Modal & Dialog Patterns](#modal--dialog-patterns)
8. [Common Pitfalls](#common-pitfalls)

---

## Responsive Layout Patterns

### 1. Stack on Mobile, Row on Desktop

```jsx
// Hero section with CTAs
<div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
  <Button>Primary Action</Button>
  <Button variant="outline">Secondary</Button>
</div>

// Stats or cards
<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
  <div>Content</div>
  <div>Actions</div>
</div>
```

### 2. Responsive Grid Layouts

```jsx
// 1 column → 2 → 3 → 4
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>

// Auto-fit responsive grid
<div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-auto-fit">
  {items.map(item => <Card key={item.id} />)}
</div>

// Using utility classes
<div className="mobile-grid-stack">
  {/* 1 col on mobile, 2 on tablet, 3 on desktop */}
</div>
```

### 3. Full-Bleed on Mobile, Contained on Desktop

```jsx
<section className="mobile-full-bleed">
  {/* Extends to edges on mobile, contained on desktop */}
</section>

// Or manually:
<section className="-mx-4 px-4 sm:mx-0">
  <div className="container">Content</div>
</section>
```

### 4. Responsive Padding

```jsx
// Section padding
<section className="section-padding-mobile">
  {/* px-4 py-8 sm:px-6 sm:py-12 md:px-8 lg:py-16 */}
</section>

// Card padding
<Card className="mobile-card-padding">
  {/* p-4 sm:p-6 lg:p-8 */}
</Card>

// Manual responsive padding
<div className="p-4 sm:p-6 lg:p-8">
  Content
</div>
```

---

## Component Patterns

### 1. Responsive Card

```jsx
<Card className="flex flex-col gap-4 p-4 sm:p-6">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <h3 className="text-lg sm:text-xl font-semibold">Title</h3>
    <Badge>Status</Badge>
  </div>
  
  <p className="text-sm sm:text-base text-muted-foreground">
    Description text
  </p>
  
  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-auto">
    <Button className="w-full sm:w-auto">Primary</Button>
    <Button variant="outline" className="w-full sm:w-auto">
      Secondary
    </Button>
  </div>
</Card>
```

### 2. Responsive Stats Card

```jsx
<Card>
  <CardContent className="p-4 sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm text-muted-foreground mb-1">
          Total Revenue
        </p>
        <p className="text-2xl sm:text-3xl font-bold truncate">
          $45,234
        </p>
        {/* Trend indicator */}
        <div className="flex items-center gap-1 mt-2">
          <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
          <span className="text-xs sm:text-sm text-green-600">
            +12.5%
          </span>
        </div>
      </div>
      {/* Icon */}
      <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
        <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
      </div>
    </div>
  </CardContent>
</Card>
```

### 3. Responsive List Items

```jsx
<ul className="space-y-3 sm:space-y-4">
  {items.map(item => (
    <li key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border hover:bg-accent">
      {/* Icon/Avatar */}
      <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm sm:text-base font-medium truncate">
          {item.title}
        </h4>
        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
          {item.description}
        </p>
      </div>
      
      {/* Action */}
      <Button size="sm" className="w-full sm:w-auto">
        View
      </Button>
    </li>
  ))}
</ul>
```

---

## Typography Patterns

### 1. Responsive Headings

```jsx
// Page title
<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold">
  Page Title
</h1>

// Section heading
<h2 className="text-xl sm:text-2xl md:text-3xl font-semibold">
  Section Title
</h2>

// Card heading
<h3 className="text-base sm:text-lg md:text-xl font-medium">
  Card Title
</h3>

// Using fluid typography
<h1 className="text-3xl-fluid font-bold">
  Fluid Page Title
</h1>
```

### 2. Responsive Body Text

```jsx
// Standard paragraph
<p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
  Body text that's readable on all devices
</p>

// Small text
<p className="text-xs sm:text-sm text-muted-foreground">
  Caption or helper text
</p>

// Large text
<p className="text-base sm:text-lg md:text-xl">
  Featured content
</p>
```

### 3. Truncation & Line Clamping

```jsx
// Single line truncate
<p className="truncate">
  This text will truncate with ellipsis on overflow
</p>

// Multi-line clamp
<p className="line-clamp-2 sm:line-clamp-3">
  This text will show 2 lines on mobile, 3 on desktop
</p>
```

---

## Navigation Patterns

### 1. Hamburger Menu (Mobile)

```jsx
const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

return (
  <>
    {/* Desktop nav */}
    <nav className="hidden md:flex items-center gap-4">
      <Link to="/home">Home</Link>
      <Link to="/about">About</Link>
    </nav>
    
    {/* Mobile hamburger */}
    <button
      className="md:hidden"
      onClick={() => setMobileMenuOpen(true)}
      aria-label="Open menu"
    >
      <Menu className="h-6 w-6" />
    </button>
    
    {/* Mobile drawer */}
    {mobileMenuOpen && (
      <div className="fixed inset-0 z-50 md:hidden">
        <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
        <div className="fixed inset-y-0 right-0 w-full max-w-xs bg-background p-6">
          <nav className="flex flex-col gap-4">
            <Link to="/home" onClick={() => setMobileMenuOpen(false)}>
              Home
            </Link>
            <Link to="/about" onClick={() => setMobileMenuOpen(false)}>
              About
            </Link>
          </nav>
        </div>
      </div>
    )}
  </>
)
```

### 2. Tabs (Scrollable on Mobile)

```jsx
<Tabs defaultValue="tab1">
  <TabsList className="w-full justify-start overflow-x-auto scrollbar-none">
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
    <TabsTrigger value="tab3">Tab 3</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content</TabsContent>
</Tabs>
```

---

## Form Patterns

### 1. Responsive Form Layout

```jsx
<form className="space-y-4 sm:space-y-5">
  {/* Single column on mobile */}
  <FormField label="Full Name" required>
    <Input placeholder="John Doe" />
  </FormField>
  
  {/* Two columns on desktop */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <FormField label="First Name">
      <Input />
    </FormField>
    <FormField label="Last Name">
      <Input />
    </FormField>
  </div>
  
  {/* Full width textarea */}
  <FormField label="Message">
    <Textarea rows={4} />
  </FormField>
  
  {/* Buttons */}
  <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-2 sm:justify-end">
    <Button variant="outline" className="w-full sm:w-auto">
      Cancel
    </Button>
    <Button className="w-full sm:w-auto">
      Submit
    </Button>
  </div>
</form>
```

### 2. Inline Form (Search)

```jsx
<div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
  <Input
    placeholder="Search..."
    className="flex-1"
  />
  <Button className="w-full sm:w-auto">
    Search
  </Button>
</div>
```

---

## Table Patterns

### 1. Using MobileTable Component

```jsx
<MobileTable
  columns={[
    { key: 'name', label: 'Name', primary: true },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status', render: (val) => <Badge>{val}</Badge> },
    { key: 'date', label: 'Date', hideOnMobile: true }
  ]}
  data={users}
  onRowClick={(row) => navigate(`/user/${row.id}`)}
/>
```

### 2. Horizontal Scroll Table

```jsx
<div className="mobile-table-wrapper">
  <table className="w-full">
    <thead>
      <tr>
        <th>Column 1</th>
        <th>Column 2</th>
        <th>Column 3</th>
      </tr>
    </thead>
    <tbody>
      {data.map(row => (
        <tr key={row.id}>
          <td>{row.col1}</td>
          <td>{row.col2}</td>
          <td>{row.col3}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

## Modal & Dialog Patterns

### 1. Responsive Modal

```jsx
<Modal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  description="Optional description"
  size="md"
  fullScreenMobile={true}
  footer={
    <>
      <Button variant="outline" className="w-full sm:w-auto">
        Cancel
      </Button>
      <Button className="w-full sm:w-auto">
        Confirm
      </Button>
    </>
  }
>
  <p className="text-sm sm:text-base">Modal content</p>
</Modal>
```

### 2. Bottom Sheet (Mobile)

```jsx
<div className="mobile-bottom-sheet" data-open={isOpen}>
  <div className="p-4 sm:p-6">
    <h3 className="text-lg font-semibold mb-4">Bottom Sheet</h3>
    <p className="text-sm sm:text-base">Content</p>
  </div>
</div>
```

---

## Common Pitfalls

### ❌ Don't: Desktop-First Approach

```jsx
// Bad - starts large, shrinks down
<div className="p-8 md:p-6 sm:p-4">
```

### ✅ Do: Mobile-First Approach

```jsx
// Good - starts small, grows up
<div className="p-4 sm:p-6 md:p-8">
```

---

### ❌ Don't: Fixed Widths on Mobile

```jsx
// Bad - can cause horizontal scroll
<div className="w-[500px]">
```

### ✅ Do: Responsive Widths

```jsx
// Good - responsive with max width
<div className="w-full max-w-lg">
```

---

### ❌ Don't: Small Touch Targets

```jsx
// Bad - too small to tap on mobile
<button className="h-6 w-6">
  <Icon className="h-4 w-4" />
</button>
```

### ✅ Do: Touch-Friendly Targets

```jsx
// Good - meets WCAG 2.5.5 (44x44px)
<button className="h-11 w-11 flex items-center justify-center">
  <Icon className="h-5 w-5" />
</button>

// Or use utility
<button className="touch-target">
  <Icon className="h-5 w-5" />
</button>
```

---

### ❌ Don't: Ignore iOS Zoom

```jsx
// Bad - iOS will zoom in on focus
<input className="text-sm" />
```

### ✅ Do: Prevent iOS Zoom

```jsx
// Good - 16px minimum prevents zoom
<Input className="text-base" />
// or use the Input component which handles this
<Input />
```

---

### ❌ Don't: Forget Safe Areas (Notched Devices)

```jsx
// Bad - content hidden by notch
<div className="fixed top-0">
```

### ✅ Do: Use Safe Area Insets

```jsx
// Good - respects notch
<div className="fixed top-0 safe-padding-top">
```

---

### ❌ Don't: Nest Horizontal Scrolls

```jsx
// Bad - confusing scroll behavior
<div className="overflow-x-auto">
  <div className="overflow-x-auto">
```

### ✅ Do: Single Scroll Container

```jsx
// Good - clear scroll direction
<div className="mobile-scroll-x">
  <div className="flex gap-4">
    {items.map(item => <Card />)}
  </div>
</div>
```

---

## Quick Reference

### Breakpoints
- `xs`: 480px (large phones)
- `sm`: 640px (tablets portrait)
- `md`: 768px (tablets landscape)
- `lg`: 1024px (laptops)
- `xl`: 1280px (desktops)
- `2xl`: 1536px (large desktops)

### Common Responsive Patterns
- Stack: `flex flex-col sm:flex-row`
- Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Text: `text-sm sm:text-base md:text-lg`
- Padding: `p-4 sm:p-6 lg:p-8`
- Gap: `gap-3 sm:gap-4 lg:gap-6`

### Touch Targets (WCAG 2.5.5)
- Minimum: 44x44px
- Use: `min-h-touch min-w-touch` or `h-11 w-11`

### Typography
- Base: 16px (prevents iOS zoom)
- Headings: Progressive scaling (2xl → 3xl → 4xl)
- Body: sm:text-base for readability

---

**See also**: 
- `DESIGN-SYSTEM.md` section 5 for the breakpoint and utility reference
- `MobileResponsiveDemo.jsx` for live examples
- `/src/index.css` for all mobile utility classes
