import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { dashboardApi, type DashboardStats, getErrorMessage } from '../services/api';

interface UseDashboardReturn {
  stats: DashboardStats | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboard(): UseDashboardReturn {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFetchedOnce = useRef(false);

  const fetchStats = useCallback(async (showLoading: boolean) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const data = await dashboardApi.getStats();
      setStats(data);
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
        fetchStats(false);
      } else {
        fetchStats(true);
        hasFetchedOnce.current = true;
      }
    }, [fetchStats]),
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchStats(false);
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
