// src/hooks/useServerRules.ts
import { useState, useEffect, useCallback } from 'react';
import {
  getRules,
  createRule,
  updateRule,
  toggleRule,
  deleteRule,
  type Rule,
  type CreateRuleRequest,
} from '@/api/rules';

export function useServerRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      const data = await getRules();
      setRules(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching rules:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const addRule = useCallback(async (rule: CreateRuleRequest) => {
    try {
      const result = await createRule(rule);
      await fetchRules(); // Refresh list
      return result;
    } catch (err) {
      console.error('Error creating rule:', err);
      throw err;
    }
  }, [fetchRules]);

  const editRule = useCallback(async (rule: CreateRuleRequest) => {
    try {
      const result = await updateRule(rule);
      await fetchRules(); // Refresh list
      return result;
    } catch (err) {
      console.error('Error updating rule:', err);
      throw err;
    }
  }, [fetchRules]);

  const toggleRuleEnabled = useCallback(async (ruleId: string) => {
    try {
      const result = await toggleRule(ruleId);
      
      // Optimistically update local state
      setRules(prev =>
        prev.map(r => (r.id === ruleId ? { ...r, enabled: result.enabled } : r))
      );
      
      return result;
    } catch (err) {
      console.error('Error toggling rule:', err);
      await fetchRules(); // Revert on error
      throw err;
    }
  }, [fetchRules]);

  const removeRule = useCallback(async (ruleId: string) => {
    try {
      await deleteRule(ruleId);
      
      // Optimistically update local state
      setRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (err) {
      console.error('Error deleting rule:', err);
      await fetchRules(); // Revert on error
      throw err;
    }
  }, [fetchRules]);

  return {
    rules,
    loading,
    error,
    addRule,
    editRule,
    toggleRule: toggleRuleEnabled,
    removeRule,
    refresh: fetchRules,
  };
}
