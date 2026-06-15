import { getCustomRulesApi } from "@/src/services/apiClient";

export async function getCustomRules(): Promise<string | null> {
  const res = await getCustomRulesApi().getCustomRulesApiV1CustomRulesGet();
  return res.data.rules ?? null;
}

export async function saveCustomRules(rules: string): Promise<void> {
  await getCustomRulesApi().updateCustomRulesApiV1CustomRulesPut({
    customRulesUpdateRequest: { rules },
  });
}
