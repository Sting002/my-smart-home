// src/api/rules.ts
import { apiClient } from './client';

export interface RuleCondition {
  type: 'power_threshold' | 'time_of_day' | 'device_state' | 'energy_threshold' | 'day_of_week';
  deviceId?: string;
  operator?: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold?: number;
  start?: string | number;
  end?: string | number;
  state?: 'on' | 'off';
  days?: number[];
  durationMinutes?: number;
  mode?: string;
  time?: string;
  uiType?: string;
}

export interface RuleAction {
  type: 'set_device' | 'alert' | 'scene';
  deviceId?: string;
  on?: boolean;
  severity?: 'info' | 'warning' | 'danger';
  message?: string;
  sceneName?: string;
  uiType?: string;
}

export interface Rule {
  id: string;
  user_id: string;
  home_id: string;
  name: string;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  created_at: string;
}

export interface CreateRuleRequest {
  id?: string;
  name: string;
  enabled?: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  homeId?: string;
}

export async function getRules(): Promise<Rule[]> {
  return apiClient('/api/rules');
}

export async function getRule(id: string): Promise<Rule> {
  return apiClient(`/api/rules/${id}`);
}

export async function createRule(rule: CreateRuleRequest): Promise<{ ok: boolean; id: string }> {
  return apiClient('/api/rules', {
    method: 'POST',
    body: JSON.stringify(rule),
  });
}

export async function updateRule(rule: CreateRuleRequest): Promise<{ ok: boolean; id: string }> {
  return apiClient('/api/rules', {
    method: 'POST',
    body: JSON.stringify(rule),
  });
}

export async function toggleRule(id: string): Promise<{ ok: boolean; enabled: boolean }> {
  return apiClient(`/api/rules/${id}/toggle`, {
    method: 'PATCH',
  });
}

export async function deleteRule(id: string): Promise<{ ok: boolean; deleted: number }> {
  return apiClient(`/api/rules/${id}`, {
    method: 'DELETE',
  });
}

export async function bulkDeleteRules(ids: string[]): Promise<{ ok: boolean; deleted: number }> {
  return apiClient('/api/rules/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}
