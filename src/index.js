import { jsx as _jsx } from "react/jsx-runtime";
import '@logseq/libs';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { SearchUI } from './SearchUI';
// Helper functions
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
function extractYear(dateStr) {
    if (!dateStr)
        return null;
    const yearMatch = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
        return parseInt(yearMatch[1]);
    }
    return null;
}
function createPageTitle(data) {
    return `${data.title || `Zotero Item ${data.key}`} #zot`;
}
// Check if item already exists in Logseq
async function checkIfInGraph(item) {
    const zoteroKey = item.key;
    try {
        const query = `(property zoteroKey "${zoteroKey}")`;
        const results = await logseq.DB.q(query);
        return !!(results && results.length > 0);
    }
    catch (error) {
        console.warn('Failed to query for duplicate:', error);
        return false;
    }
}
// Global import lock to prevent concurrent imports
const importingItems = new Set();
// Import Zotero item to Logseq
async function importZoteroItem(item) {
    // Global lock check
    if (importingItems.has(item.key)) {
        console.log(`[GUARD] Already importing ${item.key}, aborting`);
        return;
    }
    try {
        // Acquire lock
        importingItems.add(item.key);
        console.log(`[IMPORT START] ${item.key}`);
        const data = item.data;
        // Check for duplicate FIRST
        const alreadyExists = await checkIfInGraph(item);
        if (alreadyExists) {
            logseq.UI.showMsg(`⚠️ Item already exists: "${data.title || item.key}"`, 'warning', { timeout: 3000 });
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
        // Create page title with #zot tag
        const pageTitle = createPageTitle(data);
        // Create page with properties
        const page = await logseq.Editor.createPage(pageTitle, {
            title: data.title || '',
            authors: authors,
            year: year,
            itemType: data.itemType,
            zoteroKey: item.key,
            zoteroLink: `zotero://select/library/items/${item.key}`,
            url: data.url || ''
        }, {
            redirect: false,
            createFirstBlock: false
        });
        if (!page) {
            throw new Error('Page creation returned null');
        }
        // Add abstract if available
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
        console.log(`[IMPORT SUCCESS] ${item.key}:`, page);
        // Insert link at current block or journal
        await insertLinkToPage(pageTitle);
    }
    catch (error) {
        console.error(`[IMPORT ERROR] ${item.key}:`, error);
        logseq.UI.showMsg(`✗ Failed to import: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
    finally {
        // Always release lock
        importingItems.delete(item.key);
        console.log(`[IMPORT END] ${item.key}`);
    }
}
// Insert link to page at current block or journal
async function insertLinkToPage(pageTitle) {
    try {
        // Remove #zot tag for clean link
        const linkTitle = pageTitle.replace(/ #zot$/, '');
        if (currentBlockUUID) {
            // Insert at current block
            const content = await logseq.Editor.getEditingBlockContent();
            await logseq.Editor.updateBlock(currentBlockUUID, `${content} [[${linkTitle}]]`);
            console.log(`[LINK] Inserted at block ${currentBlockUUID}`);
        }
        else {
            // Insert at today's journal
            const today = new Date();
            const journalDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
            await logseq.Editor.appendBlockInPage(journalDate, `[[${linkTitle}]]`);
            console.log(`[LINK] Inserted in today's journal`);
        }
    }
    catch (error) {
        console.error('[LINK ERROR]:', error);
        // Don't show error to user, link insertion is optional
    }
}
// Store current block UUID for inserting links
let currentBlockUUID = null;
// Main plugin entry
const main = async () => {
    console.log('POC 6: Search & Import with React UI loaded');
    // Get the app div that Logseq provides
    const el = document.getElementById('app');
    if (!el) {
        console.error('App element not found');
        return;
    }
    // Create root once
    const root = createRoot(el);
    // Function to show search UI
    const showSearchUI = async (e) => {
        // Capture current block UUID if provided
        currentBlockUUID = e?.uuid || null;
        root.render(_jsx(MantineProvider, { children: _jsx("div", { style: {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    // No background - let users see context
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }, onClick: (e) => {
                    // Close on backdrop click
                    if (e.target === e.currentTarget) {
                        logseq.hideMainUI();
                    }
                }, children: _jsx(SearchUI, { onImport: importZoteroItem, checkIfInGraph: checkIfInGraph }) }) }));
        logseq.showMainUI();
    };
    // Register slash command: /zot
    logseq.Editor.registerSlashCommand('zot', showSearchUI);
    // Also keep the longer command for discoverability
    logseq.Editor.registerSlashCommand('Search Zotero', showSearchUI);
    // Register toolbar button
    logseq.provideModel({
        showSearchUI
    });
    logseq.App.registerUIItem('toolbar', {
        key: 'zotero-search',
        template: `
      <a data-on-click="showSearchUI"
         class="button"
         title="Search Zotero">
        <span style="font-size: 16px;">📚</span>
      </a>
    `
    });
    logseq.UI.showMsg('Zotero Search loaded! Use /zot or click 📚', 'success', { timeout: 3000 });
};
logseq.ready(main).catch(console.error);
