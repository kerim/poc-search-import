# POC 6: Search, Select, and Import with Duplicate Detection

**Purpose:** Test search functionality, user selection, and duplicate detection for Zotero import.

## What This Tests

1. **Search Functionality**: Can we search Zotero items using query strings?
2. **Result Display**: Can we show search results to the user?
3. **User Selection**: Can the user choose which item to import?
4. **Duplicate Detection**: Can we detect if an item is already in Logseq?
5. **Conditional Import**: Do we skip importing duplicates?

## Why This Matters

This POC completes the core workflow for the production plugin:
1. User searches for a citation
2. System shows matching results
3. User selects specific item to import
4. System checks if it already exists
5. System imports only if new

## Features Tested

### 1. Search API Integration
- Endpoint: `/items/top?q=QUERY&qmode=everything`
- Query parameters: `sort=dateAdded&direction=desc`
- Search modes: `everything` (searches all fields)

### 2. Search Results Display
Shows for each item:
- Status badge: ✅ IN GRAPH or ⬜ NOT IN GRAPH
- Title
- Authors and year
- Item type

### 3. Duplicate Detection
- Checks if page already exists using `logseq.Editor.getPage()`
- Based on page title (without #zot tag)
- Shows warning if item already exists
- Skips import for duplicates

### 4. User Selection
- Shows numbered list of results (max 10 displayed)
- User enters number to import
- Import only selected item

## Installation

1. **Prerequisites:**
   - Zotero must be running
   - Zotero HTTP server must be enabled
   - Test on a DB graph (not MD graph)

2. Build the plugin:
```bash
cd /Users/niyaro/Documents/Code/poc-search-import
pnpm install
pnpm build
```

3. Load in Logseq:
   - Settings → Plugins → Load unpacked plugin
   - Select this directory

4. Test using toolbar button (🔍) or slash command `/POC: Search & Import from Zotero`

## Usage Flow

**Note:** For POC simplicity, this version searches for a default term and automatically imports the first non-duplicate item found. Full search UI will be implemented in production plugin.

1. Click 🔍 button or use slash command
2. System searches for "deglobalization" (hardcoded in `DEFAULT_SEARCH`)
3. System checks each result for duplicates
4. System automatically imports first item NOT in graph
5. Results logged to console with status:
   - ✅ IN GRAPH (skipped)
   - ⬜ NOT IN GRAPH (imported)

**To test different search terms:**
- Edit `DEFAULT_SEARCH` constant in `src/index.ts`
- Rebuild with `pnpm build`
- Reload plugin in Logseq

## Test Scenarios

### Scenario 1: Search and Import New Item
1. Search for item not yet in graph
2. Verify status shows "⬜ NOT IN GRAPH"
3. Select item to import
4. Verify successful import

### Scenario 2: Duplicate Detection
1. Search for item already in graph
2. Verify status shows "✅ IN GRAPH"
3. Try to import item
4. Verify warning message: "Item already exists in graph"
5. Verify no duplicate page created

### Scenario 3: Search with No Results
1. Search for non-existent term
2. Verify "No results found" message

### Scenario 4: Multiple Results
1. Search for common term
2. Verify multiple results displayed
3. Verify can select any item

## Test Results

- [ ] Can search Zotero items by query string
- [ ] Search results display correctly
- [ ] Status badges show "IN GRAPH" vs "NOT IN GRAPH"
- [ ] Can select specific item to import
- [ ] Duplicate detection works (checks existing pages)
- [ ] Duplicate import is prevented with warning
- [ ] New items import successfully
- [ ] Import uses POC 5 functionality (properties, abstract, etc.)

## Key Findings

_To be filled in after testing_

### What Worked

### What Needs Improvement

### Implementation Notes

## Comparison with Original Plugin

**Original Plugin:**
- Uses React UI with Mantine components
- Real-time debounced search as user types
- Scrollable results panel
- Click card to import
- `inGraph` property calculated during search

**POC 6:**
- Simplified approach: hardcoded search term
- Automatic import of first non-duplicate
- Console logging for results inspection
- Focuses on testing core functionality (search API, duplicate detection, import)
- UI complexity deferred to production

**For Production Plugin:**
- Will use React UI similar to original plugin
- Full search input and result selection
- This POC proves the underlying functionality works

## Next Steps

After POC 6 success:
- Decide on UI approach (React vs native)
- Add more properties (tags, collections, notes)
- Add annotations import
- Add settings for customization
- Build production plugin

## Technical Details

### Duplicate Check Logic
```typescript
// Check if item already exists in Logseq
async function checkIfInGraph(item: ZoteroItem): Promise<boolean> {
  // Get page title without #zot tag for lookup
  const pageName = item.data.title || `Zotero Item ${item.data.key}`
  const page = await logseq.Editor.getPage(pageName)
  return !!page
}
```

### Search API Format
```typescript
const response = await fetch(
  `${ZOTERO_API_BASE}/items/top?q=${encodeURIComponent(query)}&qmode=everything&sort=dateAdded&direction=desc`,
  {
    headers: {
      'Zotero-Allowed-Request': '1'
    }
  }
)
```

### Import Flow
1. Search → 2. Display Results → 3. User Selects → 4. Check Duplicate → 5. Import (if new)

## Integration with Previous POCs

- **POC 1**: Type inference ✅ (used for property creation)
- **POC 2**: Page tagging ✅ (using `#zot` in title)
- **POC 3**: Nested blocks & HTML ✅ (abstract insertion)
- **POC 4**: No schema needed ✅ (type inference works)
- **POC 5**: Import functionality ✅ (reused import code)
- **POC 6**: Search + Select + Duplicate Detection ✅ (NEW)
