import type { VariantGroupViewModel } from "@/lib/api/adapters/menu";

/**
 * Pure selection logic for the customer variant picker, kept out of the dialog so it
 * can be unit-tested without rendering.
 *
 * State is `groupId -> selected option ids`. The flat `selectedOptionIds` list is what
 * `POST /cart/items` takes; the summed `priceDeltaMinor` is added to the item's base
 * price to form the cart line's `unitPrice`, which is how the cart total matches what
 * checkout recomputes from the catalog (`CheckoutContextAssembler` re-resolves every
 * option and re-applies its delta).
 *
 * Note the server validates that each posted option *exists and is available*, but not
 * that required groups were satisfied or that min/max counts hold — those are enforced
 * here only, so this is UX, not a security boundary.
 */
export type VariantSelection = Record<string, string[]>;

/** Pre-select each group's default options, never more than the group allows. */
export function defaultSelection(groups: VariantGroupViewModel[]): VariantSelection {
  const state: VariantSelection = {};
  for (const group of groups) {
    const defaults = group.options
      .filter((option) => option.isDefault && option.isAvailable)
      .map((option) => option.id);
    state[group.id] = defaults.slice(0, Math.max(group.maxSelect, 1));
  }
  return state;
}

function isSingleChoice(group: VariantGroupViewModel): boolean {
  return group.selectionType === "SINGLE" || group.maxSelect <= 1;
}

/**
 * Toggle one option within its group. Single-choice groups replace the selection;
 * deselecting the last option of a required group is refused, so the dialog cannot be
 * driven into a state its own validation rejects. A multi-select at `maxSelect` refuses
 * further additions (the dialog also disables them).
 */
export function toggleOption(
  state: VariantSelection,
  group: VariantGroupViewModel,
  optionId: string,
): VariantSelection {
  const current = state[group.id] ?? [];
  const isSelected = current.includes(optionId);

  if (isSingleChoice(group)) {
    if (isSelected) return group.required ? state : { ...state, [group.id]: [] };
    return { ...state, [group.id]: [optionId] };
  }

  if (isSelected) {
    return { ...state, [group.id]: current.filter((id) => id !== optionId) };
  }
  if (current.length >= group.maxSelect) return state;
  return { ...state, [group.id]: [...current, optionId] };
}

/** Per-group error message, keyed by group id. Empty when the selection is valid. */
export function validateSelection(
  groups: VariantGroupViewModel[],
  state: VariantSelection,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const group of groups) {
    const count = (state[group.id] ?? []).length;
    const minimum = Math.max(group.minSelect, group.required ? 1 : 0);

    if (count > group.maxSelect) {
      errors[group.id] = `Choose at most ${group.maxSelect}`;
    } else if (count < minimum) {
      // An optional group with minSelect > 1 is "all or nothing": zero is fine.
      if (group.required || count > 0) {
        errors[group.id] = `Choose at least ${minimum}`;
      }
    }
  }
  return errors;
}

export function isSelectionValid(
  groups: VariantGroupViewModel[],
  state: VariantSelection,
): boolean {
  return Object.keys(validateSelection(groups, state)).length === 0;
}

/** Flattened option ids in group order — the `selectedOptionIds` wire shape. */
export function selectedOptionIds(
  groups: VariantGroupViewModel[],
  state: VariantSelection,
): string[] {
  return groups.flatMap((group) => state[group.id] ?? []);
}

/** Summed price delta in integer minor units. */
export function selectionDeltaMinor(
  groups: VariantGroupViewModel[],
  state: VariantSelection,
): number {
  let delta = 0;
  for (const group of groups) {
    for (const optionId of state[group.id] ?? []) {
      const option = group.options.find((o) => o.id === optionId);
      if (option) delta += option.priceDeltaMinor;
    }
  }
  return delta;
}
