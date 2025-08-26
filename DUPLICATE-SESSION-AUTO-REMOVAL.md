# Automatic Duplicate Session Removal System

## Problem Solved

The dashboard was showing React key uniqueness errors when multiple session files existed for the same user ID:

```
Encountered two children with the same key, `61577311965014`. Keys should be unique so that components maintain their identity across updates.
```

This occurred because:
1. Multiple session files could exist for the same `userId` (from different captures)
2. React was using `userId` as the unique key, causing conflicts
3. Users would see duplicate entries in the session list

## Solution Implemented

### 🔧 Automatic Duplicate Detection & Removal

**Location:** `src/utils/sessionHandler.ts`

Added a new function `removeDuplicateSessions()` that:

1. **Groups sessions by `userId`**: Finds all sessions belonging to the same user
2. **Identifies duplicates**: Detects when multiple files exist for the same user
3. **Keeps the newest**: Automatically preserves the most recent session file
4. **Removes older files**: Deletes duplicate session files from disk
5. **Updates active session**: If the active session is removed, updates to the newest one

### 🔄 Automatic Integration

**Location:** `getAllSessions()` function

The duplicate removal runs automatically every time sessions are loaded:

```typescript
// First, remove any duplicate sessions
const deduplicationResult = await removeDuplicateSessions();

if (deduplicationResult.removed > 0) {
  info(`🔄 Deduplicação automática: removidas ${deduplicationResult.removed} sessões duplicadas`);
}
```

### ✅ React Key Fix

**Location:** `panel/src/app/page.tsx`

Fixed the React key uniqueness issue:

```typescript
// Before (causing conflicts):
key={session.userId || index}

// After (always unique):
key={`${session.userId}-${session.id}-${index}`}
```

## How It Works

### 1. Detection Process

When `getAllSessions()` is called, the system:

```
📁 data/sessions/
├── session-2025-08-23T21-24-36-980Z.json (User: 61577311965014)
├── session-2025-08-23T20-59-39-806Z.json (User: 61577311965014) ← DUPLICATE
└── session-61578151491865-2025-08-23T...json (User: 61578151491865)
```

1. **Scans all session files** in `data/sessions/`
2. **Groups by userId**: `61577311965014` has 2 files
3. **Sorts by timestamp**: Newest first
4. **Identifies for removal**: Older duplicate marked for deletion

### 2. Removal Process

```
🔍 Encontradas 2 sessões para usuário 61577311965014:
  1. session-2025-08-23T21-24-36-980Z.json (2025-08-23T21:24:36.980Z) [ATIVA]
  2. session-2025-08-23T20-59-39-806Z.json (2025-08-23T20:59:39.806Z)

✅ Mantendo sessão mais recente: session-2025-08-23T21-24-36-980Z.json
🗑️ Removida sessão duplicada mais antiga: session-2025-08-23T20-59-39-806Z.json
```

### 3. Active Session Management

If the currently active session is removed:

```
🎯 Sessão ativa atualizada de session-old para session-new
```

The system automatically updates the active session to the newest one.

## Benefits

### ✅ For Users
- **No duplicate sessions** in the dashboard
- **Clean interface** with only the latest session per user
- **No manual cleanup** required

### ✅ For Developers
- **No React key conflicts** 
- **Automatic file management**
- **Consistent session state**

### ✅ For System
- **Reduced disk usage** by removing redundant files
- **Faster session loading** with fewer files to process
- **Cleaner data directory** structure

## Logging & Monitoring

The system provides detailed logging for transparency:

```
🔄 Deduplicação automática: removidas 1 sessões duplicadas
🧹 Deduplicação concluída: 1 sessões duplicadas removidas, 2 sessões mantidas
📋 Encontradas 2 sessões disponíveis (após deduplicação)
```

## Safety Features

1. **Always keeps newest session**: Never loses the most recent data
2. **Active session protection**: Automatically updates if active session is removed
3. **Error handling**: Continues processing if individual file operations fail
4. **Detailed logging**: Full audit trail of what was removed and why

## Testing

To test the duplicate removal:

1. **Create duplicates**: Use the extension to capture the same user session multiple times
2. **Check dashboard**: Should see React key error before the fix
3. **Restart dashboard**: Should automatically remove duplicates
4. **Verify logs**: Check console for deduplication messages

## Configuration

The system is **enabled by default** and runs automatically. No configuration needed.

To disable (not recommended), modify `getAllSessions()` to skip the deduplication call.

## Future Enhancements

- Add manual deduplication API endpoint
- Configurable retention policies (keep last N sessions)
- Deduplication metrics in dashboard UI
- Scheduled cleanup jobs