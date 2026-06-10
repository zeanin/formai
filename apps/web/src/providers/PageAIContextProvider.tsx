import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── PageAIContext — shared state between a SchemaPage and its AI assistant ───

export interface PageAIContext {
  appId: string;
  pageSchemaUid: string;
  collectionName: string;
  currentFilters: Record<string, any>;
  selectedRecordIds: string[];
  visibleFields: string[];
  userPermissions: string[];
}

export interface PageAIActions {
  /** Update the current page filter state */
  setFilter: (filter: Record<string, any>) => void;
  /** Update the sort configuration */
  setSort: (sort: { field: string; order: 'asc' | 'desc' }) => void;
  /** Trigger a data refresh */
  refresh: () => void;
  /** Set selected record IDs (for bulk actions) */
  setSelectedRecordIds: (ids: string[]) => void;
}

export interface PageAIContextValue {
  context: PageAIContext;
  actions: PageAIActions;
  updateContext: (partial: Partial<PageAIContext>) => void;
}

const PageAIContextInternal = createContext<PageAIContextValue | null>(null);

interface PageAIContextProviderProps {
  initialContext: Partial<PageAIContext>;
  children: React.ReactNode;
}

/**
 * PageAIContextProvider — wraps each SchemaPage to provide context and actions
 * that the page-level AI assistant can read and execute.
 */
export function PageAIContextProvider({ initialContext, children }: PageAIContextProviderProps) {
  const [context, setContext] = useState<PageAIContext>({
    appId: '',
    pageSchemaUid: '',
    collectionName: '',
    currentFilters: {},
    selectedRecordIds: [],
    visibleFields: [],
    userPermissions: [],
    ...initialContext,
  });

  const [filterState, setFilterState] = useState<Record<string, any>>(initialContext.currentFilters || {});
  const [sortState, setSortState] = useState<{ field: string; order: 'asc' | 'desc' } | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const updateContext = useCallback((partial: Partial<PageAIContext>) => {
    setContext((prev) => ({ ...prev, ...partial }));
  }, []);

  const actions: PageAIActions = {
    setFilter: useCallback((filter) => {
      setFilterState(filter);
      updateContext({ currentFilters: filter });
    }, [updateContext]),

    setSort: useCallback((sort) => {
      setSortState(sort);
    }, []),

    refresh: useCallback(() => {
      setRefreshTick((t) => t + 1);
    }, []),

    setSelectedRecordIds: useCallback((ids) => {
      updateContext({ selectedRecordIds: ids });
    }, [updateContext]),
  };

  return (
    <PageAIContextInternal.Provider value={{ context, actions, updateContext }}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            __pageAIFilter: filterState,
            __pageAISort: sortState,
            __pageAIRefreshTick: refreshTick,
          });
        }
        return child;
      })}
    </PageAIContextInternal.Provider>
  );
}

/**
 * Hook to access the current page's AI context from within a schema component.
 */
export function usePageAIContext(): PageAIContextValue | null {
  return useContext(PageAIContextInternal);
}
