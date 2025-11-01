import '@logseq/libs'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import { SearchUI } from './SearchUI'

/**
 * POC 6 with React UI: Search, Select, and Import
 */

interface ZoteroCreator {
  creatorType: string
  firstName?: string
  lastName?: string
  name?: string
}

interface ZoteroItemData {
  key: string
  version: number
  itemType: string
  title?: string
  creators?: ZoteroCreator[]
  date?: string
  url?: string
  abstractNote?: string
  [key: string]: any
}

interface ZoteroItem {
  key: string
  version: number
  data: ZoteroItemData
}

// Helper functions
function htmlToMarkdown(html: string): string {
  if (!html) return ''
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
    .trim()
}

function formatCreator(creator: ZoteroCreator): string {
  if (creator.name) return creator.name
  const parts = []
  if (creator.firstName) parts.push(creator.firstName)
  if (creator.lastName) parts.push(creator.lastName)
  return parts.join(' ')
}

function extractYear(dateStr: string | undefined): number | null {
  if (!dateStr) return null
  const yearMatch = dateStr.match(/\b(19\d{2}|20\d{2})\b/)
  if (yearMatch) {
    return parseInt(yearMatch[1])
  }
  return null
}

function createPageTitle(data: ZoteroItemData): string {
  return `${data.title || `Zotero Item ${data.key}`} #zot`
}

// Check if item already exists in Logseq
async function checkIfInGraph(item: ZoteroItem): Promise<boolean> {
  const zoteroKey = item.key
  try {
    const query = `(property zoteroKey "${zoteroKey}")`
    const results = await logseq.DB.q(query)
    return !!(results && results.length > 0)
  } catch (error) {
    console.warn('Failed to query for duplicate:', error)
    return false
  }
}

// Global import lock to prevent concurrent imports
const importingItems = new Set<string>()

// Import Zotero item to Logseq
async function importZoteroItem(item: ZoteroItem): Promise<void> {
  // Global lock check
  if (importingItems.has(item.key)) {
    console.log(`[GUARD] Already importing ${item.key}, aborting`)
    return
  }

  try {
    // Acquire lock
    importingItems.add(item.key)
    console.log(`[IMPORT START] ${item.key}`)

    const data = item.data

    // Check for duplicate FIRST
    const alreadyExists = await checkIfInGraph(item)
    if (alreadyExists) {
      logseq.UI.showMsg(
        `⚠️ Item already exists: "${data.title || item.key}"`,
        'warning',
        { timeout: 3000 }
      )
      return
    }

    logseq.UI.showMsg(`Importing: ${data.title || item.key}`, 'info')

    // Format authors
    const authors = data.creators
      ? data.creators
          .filter(c => c.creatorType === 'author')
          .map(formatCreator)
          .join(', ')
      : ''

    // Extract year
    const year = extractYear(data.date)

    // Create page title with #zot tag
    const pageTitle = createPageTitle(data)

    // Create page with properties
    const page = await logseq.Editor.createPage(
      pageTitle,
      {
        title: data.title || '',
        authors: authors,
        year: year,
        itemType: data.itemType,
        zoteroKey: item.key,
        zoteroLink: `zotero://select/library/items/${item.key}`,
        url: data.url || ''
      },
      {
        redirect: false,
        createFirstBlock: false
      }
    )

    if (!page) {
      throw new Error('Page creation returned null')
    }

    // Add abstract if available
    if (data.abstractNote) {
      const abstractMarkdown = htmlToMarkdown(data.abstractNote)
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
      ])
    }

    logseq.UI.showMsg(`✓ Imported: ${data.title || item.key}`, 'success')
    console.log(`[IMPORT SUCCESS] ${item.key}:`, page)

  } catch (error) {
    console.error(`[IMPORT ERROR] ${item.key}:`, error)
    logseq.UI.showMsg(
      `✗ Failed to import: ${error instanceof Error ? error.message : String(error)}`,
      'error'
    )
  } finally {
    // Always release lock
    importingItems.delete(item.key)
    console.log(`[IMPORT END] ${item.key}`)
  }
}

// Main plugin entry
const main = async () => {
  console.log('POC 6: Search & Import with React UI loaded')

  // Get the app div that Logseq provides
  const el = document.getElementById('app')
  if (!el) {
    console.error('App element not found')
    return
  }

  // Create root once
  const root = createRoot(el)

  // Register slash command to open search
  logseq.Editor.registerSlashCommand('Search Zotero', async () => {
    root.render(
      <MantineProvider>
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            // Close on backdrop click
            if (e.target === e.currentTarget) {
              logseq.hideMainUI()
            }
          }}
        >
          <SearchUI
            onImport={importZoteroItem}
            checkIfInGraph={checkIfInGraph}
          />
        </div>
      </MantineProvider>
    )
    logseq.showMainUI()
  })

  // Register toolbar button
  logseq.provideModel({
    async showSearchUI() {
      root.render(
        <MantineProvider>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={(e) => {
              // Close on backdrop click
              if (e.target === e.currentTarget) {
                logseq.hideMainUI()
              }
            }}
          >
            <SearchUI
              onImport={importZoteroItem}
              checkIfInGraph={checkIfInGraph}
            />
          </div>
        </MantineProvider>
      )
      logseq.showMainUI()
    }
  })

  logseq.App.registerUIItem('toolbar', {
    key: 'zotero-search',
    template: `
      <a data-on-click="showSearchUI"
         class="button"
         title="Search Zotero">
        <span>🔍</span>
      </a>
    `
  })

  logseq.UI.showMsg('Zotero Search loaded! Click 🔍 or use /Search Zotero', 'success', { timeout: 3000 })
}

logseq.ready(main).catch(console.error)
