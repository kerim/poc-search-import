import { jsx as _jsx } from "react/jsx-runtime";
import '@logseq/libs';
import React from 'react';
import ReactDOM from 'react-dom/client';
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
// Import Zotero item to Logseq
async function importZoteroItem(item) {
    try {
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
        console.log('Imported item:', page);
    }
    catch (error) {
        console.error('Import error:', error);
        logseq.UI.showMsg(`✗ Failed to import: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
}
// Render React UI
function renderSearchUI() {
    const container = document.getElementById('zotero-search-ui');
    if (!container) {
        console.error('Search UI container not found');
        return;
    }
    const root = ReactDOM.createRoot(container);
    root.render(_jsx(React.StrictMode, { children: _jsx(MantineProvider, { children: _jsx(SearchUI, { onImport: importZoteroItem, checkIfInGraph: checkIfInGraph }) }) }));
}
// Main plugin entry
async function main() {
    console.log('POC 6: Search & Import with React UI loaded');
    // Register slash command to open search
    logseq.Editor.registerSlashCommand('Search Zotero', async () => {
        logseq.showMainUI();
    });
    // Provide UI
    logseq.provideUI({
        key: 'zotero-search-ui',
        path: '#zotero-search-ui',
        template: `
      <div id="zotero-search-modal" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      " data-on-click="hideUI">
        <div id="zotero-search-ui"></div>
      </div>
    `
    });
    // Provide model
    logseq.provideModel({
        hideUI() {
            logseq.hideMainUI();
        }
    });
    // Register toolbar button
    logseq.App.registerUIItem('toolbar', {
        key: 'zotero-search',
        template: `
      <a data-on-click="showSearchUI"
         class="button"
         title="Search Zotero">
        <span>🔍</span>
      </a>
    `
    });
    logseq.provideModel({
        showSearchUI() {
            logseq.showMainUI();
        }
    });
    // Render UI when shown
    logseq.on('ui:visible:changed', ({ visible }) => {
        if (visible) {
            setTimeout(renderSearchUI, 100);
        }
    });
    logseq.UI.showMsg('Zotero Search loaded! Click 🔍 or use /Search Zotero', 'success', { timeout: 3000 });
}
logseq.ready(main).catch(console.error);
