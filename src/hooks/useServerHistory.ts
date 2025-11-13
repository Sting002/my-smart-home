// src/hooks/useServerHistory.ts
import { useState, useEffect } from 'react';
import { getPowerHistory, type PowerReading } from '@/api/history';

interface UseServerHistoryOptions {
  deviceId: string;
  timeRange?: number; // milliseconds, default 1 hour
  refreshInterval?: number; // milliseconds, default 30 seconds
  enabled?: boolean; // enable/disable fetching
}

export function useServerHistory({
  deviceId,
  timeRange = 3600000, // 1 hour
  refreshInterval = 30000, // 30 seconds
  enabled = true,
}: UseServerHistoryOptions) {
  const [history, setHistory] = useState<PowerReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !deviceId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchHistory = async () => {
      try {
        const end = Date.now();
        const start = end - timeRange;

        const data = await getPowerHistory(deviceId, { start, end, limit: 1000 });

        if (isMounted) {
          setHistory(data);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching server history:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch history');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchHistory();

    // Set up refresh interval
    const interval = setInterval(fetchHistory, refreshInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [deviceId, timeRange, refreshInterval, enabled]);

  return { history, loading, error };
}
