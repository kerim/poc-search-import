import React, { useState } from 'react'
import { Flex, Input, Text, Title, Badge } from '@mantine/core'

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

interface SearchUIProps {
  onImport: (item: ZoteroItem) => Promise<void>
  checkIfInGraph: (item: ZoteroItem) => Promise<boolean>
}

const ZOTERO_API_BASE = 'http://localhost:23119/api/users/0'

function formatCreator(creator: ZoteroCreator): string {
  if (creator.name) return creator.name
  const parts = []
  if (creator.firstName) parts.push(creator.firstName)
  if (creator.lastName) parts.push(creator.lastName)
  return parts.join(' ')
}

function extractYear(dateStr: string | undefined): string {
  if (!dateStr) return 'No date'
  const yearMatch = dateStr.match(/\b(19\d{2}|20\d{2})\b/)
  return yearMatch ? yearMatch[1] : 'No date'
}

export const SearchUI: React.FC<SearchUIProps> = ({ onImport, checkIfInGraph }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<Array<{ item: ZoteroItem; inGraph: boolean }>>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search term')
      return
    }

    setSearching(true)
    setError(null)

    try {
      const response = await fetch(
        `${ZOTERO_API_BASE}/items/top?q=${encodeURIComponent(searchQuery)}&qmode=everything&sort=dateAdded&direction=desc`,
        {
          headers: {
            'Zotero-Allowed-Request': '1'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Zotero API error: ${response.status}`)
      }

      const items: ZoteroItem[] = await response.json()

      if (items.length === 0) {
        setResults([])
        setError('No results found')
        return
      }

      // Check which items are already in graph
      const resultsWithStatus = await Promise.all(
        items.map(async (item) => ({
          item,
          inGraph: await checkIfInGraph(item)
        }))
      )

      setResults(resultsWithStatus)

    } catch (err) {
      console.error('Search error:', err)
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleImport = async (item: ZoteroItem) => {
    try {
      await onImport(item)
      // Refresh the in-graph status after import
      const newResults = await Promise.all(
        results.map(async (r) => ({
          ...r,
          inGraph: r.item.key === item.key ? true : await checkIfInGraph(r.item)
        }))
      )
      setResults(newResults)
    } catch (err) {
      console.error('Import error:', err)
    }
  }

  return (
    <Flex
      direction="column"
      style={{
        width: '600px',
        maxHeight: '500px',
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}
    >
      {/* Search Input */}
      <Flex p="md" style={{ borderBottom: '1px solid #eee' }}>
        <Input
          style={{ flex: 1 }}
          placeholder="Search Zotero..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch()
          }}
          rightSection={
            results.length > 0 && (
              <Text size="xs" c="dimmed">
                {results.length} results
              </Text>
            )
          }
        />
      </Flex>

      {/* Error Message */}
      {error && (
        <Flex p="md" justify="center">
          <Text c="red" size="sm">{error}</Text>
        </Flex>
      )}

      {/* Loading */}
      {searching && (
        <Flex p="md" justify="center">
          <Text size="sm">Searching...</Text>
        </Flex>
      )}

      {/* Results */}
      <Flex
        direction="column"
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '400px'
        }}
      >
        {results.map(({ item, inGraph }) => {
          const data = item.data
          const authors = data.creators
            ? data.creators
                .filter((c) => c.creatorType === 'author')
                .map(formatCreator)
                .join(', ')
            : 'No authors'
          const year = extractYear(data.date)

          return (
            <Flex
              key={item.key}
              direction="row"
              justify="space-between"
              p="md"
              style={{
                borderBottom: '1px solid #eee',
                cursor: inGraph ? 'default' : 'pointer',
                opacity: inGraph ? 0.6 : 1,
                '&:hover': {
                  background: inGraph ? 'transparent' : '#f5f5f5'
                }
              }}
              onClick={() => {
                if (!inGraph) handleImport(item)
              }}
            >
              <Flex direction="column" style={{ flex: 1 }}>
                <Title size="sm" mb={4}>
                  {data.title || 'Untitled'}
                  <Badge
                    ml={8}
                    size="sm"
                    color="gray"
                    variant="outline"
                  >
                    {data.itemType}
                  </Badge>
                </Title>
                <Text size="xs" c="dimmed">
                  {authors} ({year})
                </Text>
              </Flex>
              <Flex align="center" pl="md">
                <Badge
                  size="sm"
                  color={inGraph ? 'green' : 'red'}
                  variant="light"
                >
                  {inGraph ? '✓ In graph' : 'Click to import'}
                </Badge>
              </Flex>
            </Flex>
          )
        })}
      </Flex>
    </Flex>
  )
}
