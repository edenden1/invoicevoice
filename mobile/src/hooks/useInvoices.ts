import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { invoiceApi, type Invoice, type InvoiceStatus, getErrorMessage } from '../services/api';

interface UseInvoicesReturn {
  invoices: Invoice[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  filterByStatus: (status: InvoiceStatus | null) => void;
  activeFilter: InvoiceStatus | null;
}

export function useInvoices(): UseInvoicesReturn {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<InvoiceStatus | null>(null);

  const hasFetchedOnce = useRef(false);

  const fetchInvoices = useCallback(async (showLoading: boolean) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const data = await invoiceApi.getAll();
      setAllInvoices(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (hasFetchedOnce.current) {
        // Silently refresh when returning to screen
        fetchInvoices(false);
      } else {
        // Show loading on first mount
        fetchInvoices(true);
        hasFetchedOnce.current = true;
      }
    }, [fetchInvoices]),
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchInvoices(false);
  }, [fetchInvoices]);

  const filterByStatus = useCallback((status: InvoiceStatus | null) => {
    setActiveFilter(status);
  }, []);

  const invoices = activeFilter
    ? allInvoices.filter((inv) => inv.status === activeFilter)
    : allInvoices;

  return {
    invoices,
    isLoading,
    isRefreshing,
    error,
    refresh,
    filterByStatus,
    activeFilter,
  };
}
