import { apiFetch } from "./client";
import type { Rule, RuleStats } from "../types";

export interface RuleCreateInput {
  rule_text: string;
  category: string | null;
  is_active: boolean;
}

export interface RuleUpdateInput {
  rule_text?: string;
  category?: string | null;
  is_active?: boolean;
}

export function listRules(): Promise<Rule[]> {
  return apiFetch<Rule[]>("/rules");
}

export function createRule(input: RuleCreateInput): Promise<Rule> {
  return apiFetch<Rule>("/rules", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateRule(ruleId: number, input: RuleUpdateInput): Promise<Rule> {
  return apiFetch<Rule>(`/rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteRule(ruleId: number): Promise<void> {
  return apiFetch<void>(`/rules/${ruleId}`, { method: "DELETE" });
}

export function getRuleStats(ruleId: number): Promise<RuleStats> {
  return apiFetch<RuleStats>(`/rules/${ruleId}/stats`);
}
