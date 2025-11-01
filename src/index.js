import '@logseq/libs';
/**
 * POC 6: Search, Select, and Import with Duplicate Detection
 *
 * Tests:
 * 1. Search Zotero items by query string
 * 2. Display results for user to select
 * 3. Import selected item
 * 4. Duplicate detection (don't import if already exists)
 */
// Zotero Local HTTP API
const ZOTERO_API_BASE = 'http://localhost:23119/api/users/0';
// Convert HTML to Markdown (from POC 3)
function htmlToMarkdown(html) {
    if (!html)
        return '';
    return html
        .replace(/<i>(.*?)<\/i>/g, '*$1*')
        .replace(/<em>(.*?)<\/em>/g, '*$1*')
        .replace(/<b>(.*?)<\/b>/g, '**$1**')
        .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
        .replace(/<sup>(.*?)<\/sup>/g, '^$1^')
        .replace(/<sub>(.*?)<\/sub>/g, '~$1~')
        .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<\/?p>/g, '\n')
        .trim();
}
// Format creator name
function formatCreator(creator) {
    if (creator.name)
        return creator.name;
    const parts = [];
    if (creator.firstName)
        parts.push(creator.firstName);
    if (creator.lastName)
        parts.push(creator.lastName);
    return parts.join(' ');
}
// Extract year from date string
function extractYear(dateStr) {
    if (!dateStr)
        return null;
    // Try to extract 4-digit year
    const yearMatch = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
        return parseInt(yearMatch[1]);
    }
    return null;
}
// Create page title from item (for duplicate checking)
function createPageTitle(data) {
    return `${data.title || `Zotero Item ${data.key}`} #zot`;
}
// Check if item already exists in Logseq
async function checkIfInGraph(item) {
    const pageTitle = createPageTitle(item.data);
    // Try to get the page (without #zot tag in the lookup)
    const pageName = item.data.title || `Zotero Item ${item.data.key}`;
    const page = await logseq.Editor.getPage(pageName);
    return !!page;
}
// Search Zotero items
async function searchZoteroItems(query) {
    try {
        if (!query || query.trim().length === 0) {
            logseq.UI.showMsg('Please enter a search query', 'warning');
            return [];
        }
        logseq.UI.showMsg(`Searching for: "${query}"...`, 'info');
        // Search using Zotero's search endpoint
        const response = await fetch(`${ZOTERO_API_BASE}/items/top?q=${encodeURIComponent(query)}&qmode=everything&sort=dateAdded&direction=desc`, {
            headers: {
                'Zotero-Allowed-Request': '1'
            }
        });
        if (!response.ok) {
            throw new Error(`Zotero API error: ${response.status} ${response.statusText}`);
        }
        const items = await response.json();
        if (!items || items.length === 0) {
            logseq.UI.showMsg('No results found', 'warning');
            return [];
        }
        logseq.UI.showMsg(`Found ${items.length} results`, 'success');
        return items;
    }
    catch (error) {
        console.error('Search error:', error);
        if (error instanceof Error && error.message.includes('Failed to fetch')) {
            logseq.UI.showMsg('❌ Cannot connect to Zotero. Make sure Zotero is running and HTTP server is enabled.', 'error', { timeout: 10000 });
        }
        else {
            logseq.UI.showMsg(`❌ Search error: ${error instanceof Error ? error.message : String(error)}`, 'error', { timeout: 10000 });
        }
        return [];
    }
}
// Import single Zotero item to Logseq (from POC 5)
async function importZoteroItem(item) {
    try {
        const data = item.data;
        // Check for duplicate FIRST
        const alreadyExists = await checkIfInGraph(item);
        if (alreadyExists) {
            logseq.UI.showMsg(`⚠️ Item already exists in graph: "${data.title || item.key}"`, 'warning', { timeout: 5000 });
            console.log('Item already in graph, skipping import:', data.title);
            return;
        }
        logseq.UI.showMsg(`Importing: ${data.title || item.key}`, 'info');
        // Format authors
        const authors = data.creators
            ? data.creators
                .filter(c => c.creatorType === 'author')
                .map(formatCreator)
                .join(', ')
            : '';
        // Extract year
        const year = extractYear(data.date);
        // Create Zotero link
        const zoteroLink = `zotero://select/library/items/${item.key}`;
        // Create page title with #zot tag
        const pageTitle = createPageTitle(data);
        // Create page with properties (type inference from POC 1)
        const page = await logseq.Editor.createPage(pageTitle, {
            // Types auto-inferred from JavaScript values
            title: data.title || '', // string → text
            authors: authors, // string → text
            year: year, // number | null → number or empty
            itemType: data.itemType, // string → text
            zoteroKey: item.key, // string → text
            zoteroLink: zoteroLink, // string → url (auto-detected)
            url: data.url || '' // string → url (auto-detected)
        }, {
            redirect: false,
            createFirstBlock: false
        });
        if (!page) {
            throw new Error('Page creation returned null');
        }
        // Add abstract if available (nested block from POC 3)
        if (data.abstractNote) {
            const abstractMarkdown = htmlToMarkdown(data.abstractNote);
            await logseq.Editor.insertBatchBlock(page.uuid, [
                {
                    content: '**Abstract:**',
                    children: [
                        {
                            content: abstractMarkdown,
                            children: []
                        }
                    ]
                }
            ]);
        }
        logseq.UI.showMsg(`✓ Imported: ${data.title || item.key}`, 'success');
        console.log('Imported item:', page);
    }
    catch (error) {
        console.error('Import error:', error);
        logseq.UI.showMsg(`✗ Failed to import: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
}
// Store search results globally for UI access
let currentSearchResults = [];
// Display search results and let user select (simplified for POC)
async function displaySearchResults(items) {
    if (items.length === 0) {
        return;
    }
    console.log('Search results:', items);
    currentSearchResults = items;
    // For POC, just import first non-duplicate item automatically
    // In production, this would be a proper UI with selection
    logseq.UI.showMsg(`Checking ${items.length} items for duplicates...`, 'info');
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const data = item.data;
        // Check if already in graph
        const inGraph = await checkIfInGraph(item);
        // Format authors for display
        const authors = data.creators
            ? data.creators
                .filter(c => c.creatorType === 'author')
                .map(formatCreator)
                .join(', ')
            : 'No authors';
        // Extract year
        const year = extractYear(data.date) || 'No date';
        console.log(`Item ${i + 1}:`, {
            title: data.title,
            authors,
            year,
            itemType: data.itemType,
            inGraph: inGraph ? 'YES' : 'NO'
        });
        if (!inGraph) {
            // Found first item not in graph, import it
            logseq.UI.showMsg(`Importing first new item: "${data.title || item.key}"`, 'info');
            await importZoteroItem(item);
            return;
        }
        else {
            logseq.UI.showMsg(`Item ${i + 1} already in graph: "${data.title || item.key}"`, 'info', { timeout: 2000 });
        }
    }
    // All items are duplicates
    logseq.UI.showMsg('All search results are already in your graph!', 'success', { timeout: 5000 });
}
// Main search and import function
async function runSearchAndImport() {
    // For POC simplicity, use a predefined search term
    // In production, this would be a proper search UI
    logseq.UI.showMsg('POC: Enter search term in console or use default "deglobalization"', 'info');
    // For POC testing, let's use a simple prompt-like approach
    // User can modify this constant and rebuild for different searches
    const DEFAULT_SEARCH = 'deglobalization';
    console.log(`POC 6: Searching for "${DEFAULT_SEARCH}"`);
    console.log('To search for different terms, modify DEFAULT_SEARCH in src/index.ts');
    try {
        // Search for items
        const items = await searchZoteroItems(DEFAULT_SEARCH);
        if (items.length === 0) {
            return;
        }
        // Display results and let user select
        await displaySearchResults(items);
    }
    catch (error) {
        console.error('POC Error:', error);
        logseq.UI.showMsg(`❌ Error: ${error instanceof Error ? error.message : String(error)}`, 'error', { timeout: 10000 });
    }
}
async function main() {
    console.log('POC: Search & Import loaded');
    // Register slash command
    logseq.Editor.registerSlashCommand('POC: Search & Import from Zotero', async () => {
        await runSearchAndImport();
    });
    // Register toolbar button
    logseq.provideModel({
        async runSearchAndImport() {
            await runSearchAndImport();
        }
    });
    logseq.App.registerUIItem('toolbar', {
        key: 'poc-search-import',
        template: `
      <a data-on-click="runSearchAndImport"
         class="button"
         title="Search & Import from Zotero">
        <span>🔍</span>
      </a>
    `
    });
    logseq.UI.showMsg('POC: Search & Import loaded! Use 🔍 button or /POC command', 'info');
}
logseq.ready(main).catch(console.error);
