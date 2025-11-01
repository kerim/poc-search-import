import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { Flex, Input, Text, Title, Badge } from '@mantine/core';
const ZOTERO_API_BASE = 'http://localhost:23119/api/users/0';
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
        return 'No date';
    const yearMatch = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
    return yearMatch ? yearMatch[1] : 'No date';
}
export const SearchUI = ({ onImport, checkIfInGraph }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [importing, setImporting] = useState(null); // Track which item is being imported
    const [error, setError] = useState(null);
    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setError('Please enter a search term');
            return;
        }
        setSearching(true);
        setError(null);
        try {
            const response = await fetch(`${ZOTERO_API_BASE}/items/top?q=${encodeURIComponent(searchQuery)}&qmode=everything&sort=dateAdded&direction=desc`, {
                headers: {
                    'Zotero-Allowed-Request': '1'
                }
            });
            if (!response.ok) {
                throw new Error(`Zotero API error: ${response.status}`);
            }
            const items = await response.json();
            if (items.length === 0) {
                setResults([]);
                setError('No results found');
                return;
            }
            // Check which items are already in graph
            const resultsWithStatus = await Promise.all(items.map(async (item) => ({
                item,
                inGraph: await checkIfInGraph(item)
            })));
            setResults(resultsWithStatus);
        }
        catch (err) {
            console.error('Search error:', err);
            setError(err instanceof Error ? err.message : 'Search failed');
        }
        finally {
            setSearching(false);
        }
    };
    const handleImport = async (item) => {
        // Prevent duplicate imports
        if (importing === item.key) {
            console.log('Already importing this item, skipping...');
            return;
        }
        try {
            setImporting(item.key);
            await onImport(item);
            // Refresh the in-graph status after import
            const newResults = await Promise.all(results.map(async (r) => ({
                ...r,
                inGraph: r.item.key === item.key ? true : await checkIfInGraph(r.item)
            })));
            setResults(newResults);
        }
        catch (err) {
            console.error('Import error:', err);
        }
        finally {
            setImporting(null);
        }
    };
    return (_jsxs(Flex, { direction: "column", style: {
            width: '600px',
            maxHeight: '500px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            background: 'transparent'
        }, children: [_jsx(Flex, { p: "md", style: { borderBottom: '1px solid #eee', background: 'transparent' }, children: _jsx(Input, { style: { flex: 1 }, placeholder: "Search Zotero...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), onKeyDown: (e) => {
                        if (e.key === 'Enter')
                            handleSearch();
                    }, rightSection: results.length > 0 && (_jsxs(Text, { size: "xs", c: "dimmed", children: [results.length, " results"] })) }) }), error && (_jsx(Flex, { p: "md", justify: "center", style: { background: 'transparent' }, children: _jsx(Text, { c: "red", size: "sm", children: error }) })), searching && (_jsx(Flex, { p: "md", justify: "center", style: { background: 'transparent' }, children: _jsx(Text, { size: "sm", children: "Searching..." }) })), _jsx(Flex, { direction: "column", style: {
                    flex: 1,
                    overflowY: 'auto',
                    maxHeight: '400px',
                    background: 'transparent'
                }, children: results.map(({ item, inGraph }) => {
                    const data = item.data;
                    const authors = data.creators
                        ? data.creators
                            .filter((c) => c.creatorType === 'author')
                            .map(formatCreator)
                            .join(', ')
                        : 'No authors';
                    const year = extractYear(data.date);
                    const isImporting = importing === item.key;
                    return (_jsxs(Flex, { direction: "row", justify: "space-between", p: "md", style: {
                            borderBottom: '1px solid #eee',
                            cursor: inGraph || isImporting ? 'default' : 'pointer',
                            opacity: inGraph || isImporting ? 0.6 : 1,
                            pointerEvents: isImporting ? 'none' : 'auto',
                            background: 'transparent'
                        }, onClick: () => {
                            if (!inGraph && !isImporting)
                                handleImport(item);
                        }, children: [_jsxs(Flex, { direction: "column", style: { flex: 1 }, children: [_jsxs(Title, { size: "sm", mb: 4, children: [data.title || 'Untitled', _jsx(Badge, { ml: 8, size: "sm", color: "gray", variant: "outline", children: data.itemType })] }), _jsxs(Text, { size: "xs", c: "dimmed", children: [authors, " (", year, ")"] })] }), _jsx(Flex, { align: "center", pl: "md", children: _jsx(Badge, { size: "sm", color: isImporting ? 'blue' : inGraph ? 'green' : 'red', variant: "light", children: isImporting ? 'Importing...' : inGraph ? '✓ In graph' : 'Click to import' }) })] }, item.key));
                }) })] }));
};
