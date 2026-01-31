# Sync Error UI Implementation

## Overview

The Sync Error UI provides a comprehensive, user-friendly error handling system for bank synchronization failures. It follows the Neo-Glass design aesthetic and provides actionable feedback to users.

## Design Philosophy: "Critical Clarity"

The error system uses the Neo-Glass glassmorphism aesthetic but introduces sharp color coding to distinguish between different error types:

- **Amber** (warning): Network issues, temporary failures
- **Red** (error): Authentication failures, critical errors
- **Blue** (info): Configuration issues, missing credentials
- **Purple**: Server-side errors
- **Primary**: Demo mode notifications

## Architecture

### Component Hierarchy

```
SyncButton (Smart Trigger)
  └─> Popover
      └─> SyncErrorDetails (Parser/Renderer)
          ├─> Error Icon & Title
          ├─> User-friendly Description
          ├─> Tech Log Well (Raw Error)
          ├─> Action Buttons (Retry, Copy)
          └─> Sync History (Optional)
```

### State Management

**SyncContext** (`src/contexts/sync-context.tsx`)

- Tracks sync status: `idle | syncing | success | error`
- Stores error messages
- Maintains sync history
- Provides `triggerManualSync()` and `refreshSyncStatus()`

## Components

### 1. SyncErrorDetails (`src/components/sync-error-details.tsx`)

**Purpose**: Parses raw error strings and renders user-friendly error UI.

**Key Features**:

- **Error Classification**: Intelligently categorizes errors by analyzing error messages
- **Visual Differentiation**: Uses color-coded icons and backgrounds
- **Tech Log Well**: Monospace glass container for raw error details
- **Copy to Clipboard**: Hover-activated copy button for error logs
- **Sync History**: Collapsible view of recent sync attempts
- **Retry Action**: Direct retry button within the error UI

**Error Categories**:

| Category | Detection Pattern                 | Icon        | Color   | User Guidance                        |
| -------- | --------------------------------- | ----------- | ------- | ------------------------------------ |
| Network  | `network`, `fetch`, `connection`  | WifiOff     | Amber   | Check internet connection            |
| Auth     | `401`, `auth`, `session`, `login` | Lock        | Red     | Re-authenticate or check credentials |
| Config   | `credentials`, `config`           | FileKey     | Blue    | Configure banking.config.json        |
| Server   | `500`, `internal`                 | ServerCrash | Purple  | Bank system error, try later         |
| Demo     | `demo`                            | Database    | Primary | Disable demo mode to sync            |

**Props**:

```typescript
interface SyncErrorDetailsProps {
  error: string; // Raw error message
  onRetry: () => void; // Retry callback
  syncHistory?: SyncMetadata[]; // Recent sync history
  className?: string;
}
```

### 2. SyncButton (`src/components/sync-button.tsx`)

**Updates**:

- Replaced Tooltip with Popover for error states
- Auto-opens popover when sync fails
- Visual states: idle, syncing (spinner), success (green), error (red with ring)
- Passes sync history to error details

**Behavior**:

- **Idle/Success**: Click to sync
- **Error**: Click opens detailed error popover
- **Syncing**: Disabled with spinner animation
- **No Credentials/Demo**: Disabled state

### 3. SyncStatus (`src/components/sync-status.tsx`)

**Updates**:

- Added visual "Sync failed" state with AlertCircle icon
- Red color coding for error state
- Enhanced typography for better visibility

### 4. Layout (`src/app/layout.tsx`)

**Updates**:

- Added Sonner Toaster for toast notifications
- Positioned at bottom-right for non-intrusive feedback

## User Flows

### Error Occurrence Flow

1. **Sync Triggered**: User clicks sync button
2. **Error Occurs**: Server returns error (e.g., network timeout)
3. **State Update**: SyncContext sets `syncStatus = "error"`, `syncError = message`
4. **Visual Feedback**:
   - Sync button turns red with pulsing ring
   - Sync status shows "Sync failed" with icon
   - Popover auto-opens with error details
5. **User Actions**:
   - **Retry**: Closes popover, retries sync
   - **Copy Error**: Copies raw error to clipboard
   - **View History**: Expands sync history panel
   - **Dismiss**: Closes popover (can reopen by clicking button)

### Error Recovery Flow

```
User sees error → Reads friendly message → Takes action
  ↓
Network Error → Checks connection → Retries
Auth Error → Re-authenticates → Retries
Config Error → Adds credentials → Retries
```

## Styling

### Neo-Glass Theme Integration

**Glass Panel** (Error Popover):

```css
backdrop-blur-xl
bg-card/80
border-white/10 dark:border-white/5
shadow-2xl
```

**Error Icon Container**:

```css
backdrop-blur-md
shadow-inner
bg-{color}-500/10
text-{color}-500
```

**Tech Log Well**:

```css
border-border/40
bg-muted/20
backdrop-blur-sm
hover:bg-muted/30
hover:border-border/60
```

**Animations**:

- Popover: `animate-in zoom-in-95 slide-in-from-top-2`
- History: `animate-in fade-in slide-in-from-top-2`
- Spinner: `animate-spin`
- Error Button: `ring-2 ring-destructive/20`

## Accessibility

- **ARIA Labels**: Sync button has descriptive `aria-label`
- **Keyboard Navigation**: Full keyboard support via Radix Popover
- **Focus Management**: Auto-focus on retry button when popover opens
- **Screen Readers**: Semantic HTML with proper heading hierarchy
- **Color Independence**: Icons supplement color coding

## Responsive Design

- **Mobile** (< 640px): Popover width adjusts, history scrollable
- **Desktop**: Fixed 340px width, optimal reading layout
- **Touch Targets**: Minimum 44px for buttons

## Testing Scenarios

### Manual Testing

**Test Network Error**:

```typescript
// In src/actions/sync.actions.ts, add before syncBank():
throw new Error("Network connection failed");
```

**Test Auth Error**:

```typescript
throw new Error("401 Authentication failed - session expired");
```

**Test Config Error**:

```typescript
throw new Error("No credentials found for dkb in banking.config.json");
```

**Test Demo Mode**:

- Enable demo mode in UI
- Attempt sync
- Should see blue "Demo Mode Active" error

### Expected Behaviors

1. **Error appears immediately** after sync failure
2. **Popover auto-opens** without user interaction
3. **Correct icon and color** for error type
4. **Retry button works** and closes popover
5. **Copy button** shows toast confirmation
6. **History displays** recent syncs with status indicators

## Integration Points

### Server Actions (`src/actions/sync.actions.ts`)

Returns structured `SyncMetadata`:

```typescript
{
  institutionId: string;
  lastSyncAt: string;
  accountsSynced: number;
  transactionsFetched: number;
  newTransactions: number;
  status: "success" | "error" | "partial";
  error?: string;  // Raw error message
}
```

### Context API (`src/contexts/sync-context.tsx`)

Provides:

```typescript
{
  syncStatus: "idle" | "syncing" | "success" | "error";
  syncError: string | null;
  syncHistory: SyncMetadata[];
  triggerManualSync: () => Promise<SyncMetadata>;
  // ... other fields
}
```

## Future Enhancements

### Potential Improvements

1. **Error Analytics**: Track error frequency and types
2. **Smart Retry**: Exponential backoff for network errors
3. **Error Notifications**: Desktop notifications for background sync
4. **Help Links**: Context-specific documentation links
5. **Error Translation**: i18n support for multi-language errors
6. **Status Page**: Link to bank service status page
7. **Auto-Recovery**: Automatic retry for transient errors
8. **Error Grouping**: Aggregate similar errors

### Advanced Features

- **Diagnostic Tool**: Built-in connection tester
- **Error Export**: Download error logs for support
- **Live Status**: Real-time bank service status indicator
- **Recovery Wizard**: Step-by-step error resolution guide

## Maintenance

### Adding New Error Types

1. Update `getErrorConfig()` in `sync-error-details.tsx`
2. Add detection pattern and UI config
3. Test with manual error injection
4. Update documentation

### Modifying Error Messages

- Keep messages concise (1-2 sentences)
- Focus on "what happened" and "what to do"
- Avoid technical jargon unless in Tech Log Well
- Provide actionable next steps

## Code Quality

- ✅ TypeScript strict mode
- ✅ ESLint compliant
- ✅ Follows React 19 best practices
- ✅ Server/Client component separation
- ✅ Proper error boundaries
- ✅ Performance optimized (memoization)

## Resources

- [Radix Popover Docs](https://www.radix-ui.com/docs/primitives/components/popover)
- [Sonner Toast Docs](https://sonner.emilkowal.ski/)
- [Neo-Glass Design System](../CLAUDE.md)
- [Sync Architecture](../PRD.md)

---

**Implementation Date**: January 2026  
**Last Updated**: January 31, 2026  
**Version**: 1.0.0
