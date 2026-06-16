import { computed, reactive } from 'vue'

const state = reactive({
  owner: null,
  actions: [],
  open: false,
})

function normalizeActions(actions = []) {
  return actions
    .filter(Boolean)
    .map((action, index) => ({
      key: action.key || `action-${index}`,
      label: action.label || '',
      to: action.to || null,
      onSelect: typeof action.onSelect === 'function' ? action.onSelect : null,
      danger: !!action.danger,
      disabled: !!action.disabled,
    }))
    .filter((action) => action.label && (action.to || action.onSelect))
}

export function useMobilePageActions() {
  const owner = Symbol('mobile-page-actions')

  function setActions(actions) {
    state.owner = owner
    state.actions = normalizeActions(actions)
  }

  function clearActions() {
    if (state.owner !== owner) return
    state.owner = null
    state.actions = []
    state.open = false
  }

  return {
    setActions,
    clearActions,
  }
}

export function useMobilePageActionsState() {
  function resetActions() {
    state.owner = null
    state.actions = []
    state.open = false
  }

  function openActions() {
    if (!normalizeActions(state.actions).length) return
    state.open = true
  }

  function closeActions() {
    state.open = false
  }

  return {
    actions: computed(() => normalizeActions(state.actions)),
    isOpen: computed(() => state.open && normalizeActions(state.actions).length > 0),
    hasActions: computed(() => normalizeActions(state.actions).length > 0),
    openActions,
    closeActions,
    resetActions,
  }
}
