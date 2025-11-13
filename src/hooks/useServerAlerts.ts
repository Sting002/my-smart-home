// src/hooks/useServerAlerts.ts
import { useState, useEffect } from 'react';
import { getAlerts, acknowledgeAlert, type Alert } from '@/api/history';

interface UseServerAlertsOptions {
  limit?: number;
  deviceId?: string;
  severity?: string;
  refreshInterval?: number; // milliseconds
  enabled?: boolean;
}

export function useServerAlerts({
  limit = 50,
  deviceId,
  severity,
  refreshInterval = 60000, // 1 minute
  enabled = true,
}: UseServerAlertsOptions = {}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchAlerts = async () => {
      try {
        const data = await getAlerts({ limit, deviceId, severity });

        if (isMounted) {
          setAlerts(data);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching alerts:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchAlerts();

    // Set up refresh interval
    const interval = setInterval(fetchAlerts, refreshInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [limit, deviceId, severity, refreshInterval, enabled]);

  const acknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
      
      // Update local state
      setAlerts(prev =>
        prev.map(alert =>
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        )
      );
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      throw err;
    }
  };

  return { alerts, loading, error, acknowledge };
}
