<template>
  <div class="market-rules-page">
    <section class="rules-hero">
      <div>
        <div class="hero-kicker">{{ t('marketDataRules.heroKicker') }}</div>
        <p class="hero-subtitle">{{ t('marketDataRules.heroSubtitle') }}</p>
      </div>
      <div class="hero-actions">
        <button class="btn" :disabled="loading" @click="loadAll">{{ t('common.refresh') }}</button>
        <button class="btn btn-primary" :disabled="linting" @click="runLint">{{ t('marketDataRules.actions.lint') }}</button>
      </div>
    </section>

    <div class="mode-tabs" role="tablist" :aria-label="t('marketDataRules.tabsLabel')">
      <button v-for="tab in tabs" :key="tab.key" class="mode-tab" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
        <span class="tab-index">{{ tab.index }}</span>
        <span><strong>{{ tab.label }}</strong><small>{{ tab.desc }}</small></span>
      </button>
    </div>

    <section v-if="activeTab === 'resolve'" class="rules-panel">
      <div class="panel-header">
        <div><h2>{{ t('marketDataRules.resolve.title') }}</h2><p>{{ t('marketDataRules.resolve.desc') }}</p></div>
        <button class="btn btn-primary" :disabled="resolving" @click="resolveAsset">{{ resolving ? t('marketDataRules.resolve.running') : t('marketDataRules.resolve.run') }}</button>
      </div>
      <div class="resolve-grid">
        <label>{{ t('marketDataRules.fields.symbol') }}<input v-model.trim="resolveForm.symbol" class="form-input" placeholder="AU9999 / BTC / XAUUSD" /></label>
        <label>{{ t('marketDataRules.fields.type') }}<select v-model="resolveForm.type" class="form-select"><option value="gold">gold</option><option value="crypto">crypto</option><option value="equity">equity</option><option value="forex">forex</option></select></label>
        <label>{{ t('marketDataRules.fields.currency') }}<input v-model.trim="resolveForm.currency" class="form-input" placeholder="CNY / USD" /></label>
        <label>{{ t('marketDataRules.fields.unit') }}<input v-model.trim="resolveForm.unit" class="form-input" placeholder="g / oz / coin / share" /></label>
        <label>{{ t('marketDataRules.fields.assetId') }}<input v-model.trim="resolveForm.asset_id" class="form-input" :placeholder="t('marketDataRules.fields.assetIdPlaceholder')" /></label>
      </div>
      <div v-if="resolveResult" class="result-grid">
        <article class="result-card">
          <h3>{{ t('marketDataRules.resolve.profile') }}</h3>
          <pre>{{ pretty(resolveResult.profile) }}</pre>
          <div class="resolved-actions">
            <button class="btn btn-primary" type="button" :disabled="savingResolved === 'mapping'" @click="saveResolvedMapping">{{ savingResolved === 'mapping' ? t('marketDataRules.resolve.savingMapping') : t('marketDataRules.resolve.saveMapping') }}</button>
            <button class="btn" type="button" :disabled="savingResolved === 'profile'" @click="saveResolvedProfile">{{ savingResolved === 'profile' ? t('marketDataRules.resolve.savingProfile') : t('marketDataRules.resolve.saveProfile') }}</button>
          </div>
        </article>
        <article class="result-card">
          <h3>{{ t('marketDataRules.resolve.candidates') }}</h3>
          <div class="candidate-list">
            <div v-for="item in resolveResult.candidates" :key="item.source" class="candidate" :class="item.status">
              <strong>{{ item.source }}</strong>
              <span>{{ item.status }}</span>
              <small v-if="item.provider_symbol">{{ t('marketDataRules.resolve.provider') }}: {{ item.provider_symbol }}</small>
              <small v-if="item.reason">{{ item.reason }}</small>
              <small v-if="item.adapter">{{ item.adapter.adapter_type }} / {{ item.adapter.parser_type }}</small>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section v-else-if="activeTab === 'lint'" class="rules-panel">
      <div class="panel-header">
        <div><h2>{{ t('marketDataRules.lint.title') }}</h2><p>{{ t('marketDataRules.lint.desc') }}</p></div>
        <button class="btn btn-primary" :disabled="linting" @click="runLint">{{ linting ? t('marketDataRules.lint.running') : t('marketDataRules.lint.run') }}</button>
      </div>
      <div class="issue-summary">
        <span class="issue-pill error">{{ t('marketDataRules.lint.error') }} {{ issueCount('error') }}</span>
        <span class="issue-pill warning">{{ t('marketDataRules.lint.warning') }} {{ issueCount('warning') }}</span>
        <span class="issue-pill info">{{ t('marketDataRules.lint.info') }} {{ issueCount('info') }}</span>
      </div>
      <div class="issue-list">
        <article v-for="(issue, index) in lintIssues" :key="index" class="issue-card" :class="issue.severity">
          <strong>{{ issue.code }}</strong>
          <p>{{ issue.message }}</p>
          <pre>{{ pretty(issue.details) }}</pre>
        </article>
        <div v-if="!lintIssues.length" class="empty-card">{{ t('marketDataRules.lint.empty') }}</div>
      </div>
    </section>

    <section v-else-if="activeTab === 'rules'" class="rules-panel">
      <div class="panel-header">
        <div><h2>{{ t('marketDataRules.rules.title') }}</h2><p>{{ t('marketDataRules.rules.desc') }}</p></div>
        <div class="header-controls"><select v-model="activeKind" class="form-select" @change="loadRules"><option v-for="kind in ruleKinds" :key="kind" :value="kind">{{ kind }}</option></select><button class="btn" @click="loadRules">{{ t('marketDataRules.actions.load') }}</button></div>
      </div>
      <div class="rules-help-strip">
        <span><b>mappings</b>{{ t('marketDataRules.rules.helpMappings') }}</span>
        <span><b>capabilities</b>{{ t('marketDataRules.rules.helpCapabilities') }}</span>
        <span><b>symbol-rules</b>{{ t('marketDataRules.rules.helpSymbolRules') }}</span>
        <span><b>adapters</b>{{ t('marketDataRules.rules.helpAdapters') }}</span>
      </div>
      <div class="rules-editor-grid">
        <article class="rules-table-card">
          <div class="table-scroll"><table><thead><tr><th>ID/Key</th><th>{{ t('marketDataRules.rules.summary') }}</th><th>{{ t('marketDataRules.rules.status') }}</th><th></th></tr></thead><tbody><tr v-for="row in rules" :key="ruleKey(row)"><td>{{ ruleKey(row) }}</td><td><code>{{ ruleSummary(row) }}</code></td><td>{{ row.enabled === 0 ? t('marketDataRules.rules.disabled') : t('marketDataRules.rules.enabled') }}</td><td><button class="btn btn-sm" @click="editRule(row)">{{ t('common.edit') }}</button></td></tr></tbody></table></div>
        </article>
        <article class="json-editor-card">
          <h3>{{ editingKey ? t('marketDataRules.rules.editTitle', { kind: activeKind, id: editingKey }) : t('marketDataRules.rules.createTitle', { kind: activeKind }) }}</h3>
          <textarea v-model="ruleJson" class="json-textarea" spellcheck="false"></textarea>
          <div class="editor-actions"><button class="btn" @click="resetEditor">{{ t('marketDataRules.rules.newRule') }}</button><button class="btn btn-primary" :disabled="savingRule" @click="saveRule">{{ savingRule ? t('common.saving') : t('marketDataRules.rules.saveRule') }}</button><button v-if="editingKey" class="btn danger" :disabled="savingRule" @click="disableRule">{{ t('marketDataRules.rules.disableOrDelete') }}</button></div>
        </article>
      </div>
    </section>

    <section v-else class="rules-panel">
      <div class="panel-header"><div><h2>{{ t('marketDataRules.io.title') }}</h2><p>{{ t('marketDataRules.io.desc') }}</p></div><div class="header-controls"><button class="btn" @click="exportRules">{{ t('marketDataRules.io.export') }}</button><button class="btn" @click="loadChanges">{{ t('marketDataRules.io.refreshChanges') }}</button></div></div>
      <div class="import-grid">
        <article class="json-editor-card"><h3>{{ t('marketDataRules.io.importJson') }}</h3><textarea v-model="importJson" class="json-textarea" :placeholder="t('marketDataRules.io.importPlaceholder')"></textarea><div class="editor-actions"><button class="btn" @click="importRules(true)">{{ t('marketDataRules.io.preview') }}</button><button class="btn btn-primary" @click="importRules(false)">{{ t('marketDataRules.io.applyImport') }}</button></div><pre v-if="importResult">{{ pretty(importResult) }}</pre></article>
        <article class="rules-table-card"><h3>{{ t('marketDataRules.io.recentChanges') }}</h3><div class="change-list"><div v-for="change in changes" :key="change.id" class="change-item"><strong>#{{ change.id }} {{ change.rule_kind }} / {{ change.action }}</strong><small>{{ change.rule_id }} · {{ change.created_at }}</small></div></div></article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'

const toast = useToast()
const { t } = useI18n()
const loading = ref(false)
const activeTab = ref('resolve')
const tabs = computed(() => [
  { key: 'resolve', index: '1', label: t('marketDataRules.tabs.resolve'), desc: t('marketDataRules.tabs.resolveDesc') },
  { key: 'lint', index: '2', label: t('marketDataRules.tabs.lint'), desc: t('marketDataRules.tabs.lintDesc') },
  { key: 'rules', index: '3', label: t('marketDataRules.tabs.rules'), desc: t('marketDataRules.tabs.rulesDesc') },
  { key: 'io', index: '4', label: t('marketDataRules.tabs.io'), desc: t('marketDataRules.tabs.ioDesc') },
])

const resolveForm = reactive({ symbol: 'AU9999', type: 'gold', currency: 'CNY', unit: 'g', asset_id: '' })
const resolving = ref(false)
const resolveResult = ref(null)
const savingResolved = ref('')
const linting = ref(false)
const lintIssues = ref([])
const ruleKinds = ref([])
const activeKind = ref('mappings')
const rules = ref([])
const ruleJson = ref('{}')
const editingKey = ref('')
const savingRule = ref(false)
const importJson = ref('')
const importResult = ref(null)
const changes = ref([])

function pretty(value) { return JSON.stringify(value || {}, null, 2) }
function issueCount(severity) { return lintIssues.value.filter(issue => issue.severity === severity).length }
function ruleKey(row) { return row.id ?? row.source_key ?? row.key }
function ruleSummary(row) { return row.input_symbol || row.source_key || row.key || row.canonical_symbol || row.symbol_template || row.adapter_type || JSON.stringify(row).slice(0, 80) }
function parseEditorJson() { try { return JSON.parse(ruleJson.value || '{}') } catch { throw new Error(t('marketDataRules.errors.invalidJson')) } }

async function requestJson(url, options = {}) {
  const res = await api(url, options)
  const contentType = res.headers.get('content-type') || ''
  const bodyText = await res.text()
  let json
  try {
    json = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    const looksLikeHtml = bodyText.trim().startsWith('<')
    const hint = looksLikeHtml
      ? t('marketDataRules.errors.htmlResponse')
      : t('marketDataRules.errors.nonJsonResponse', { type: contentType || 'unknown' })
    throw new Error(`${hint}: ${url}`)
  }
  if (!json.success) throw new Error(json.error || t('marketDataRules.errors.requestFailed'))
  return json.data
}
async function loadKinds() { ruleKinds.value = await requestJson('/api/market/data/rules'); if (!ruleKinds.value.includes(activeKind.value)) activeKind.value = ruleKinds.value[0] || 'mappings' }
async function loadRules() { rules.value = await requestJson(`/api/market/data/rules/${activeKind.value}`) }
async function runLint({ silent = false } = {}) { linting.value = true; try { lintIssues.value = await requestJson('/api/market/data/lint'); if (!silent) toast.success(t('marketDataRules.messages.lintDone')) } catch (e) { if (!silent) toast.error(e.message); else throw e } finally { linting.value = false } }
async function resolveAsset() { resolving.value = true; try { resolveResult.value = await requestJson('/api/market/data/resolve-test', { method: 'POST', body: JSON.stringify(resolveForm) }) } catch (e) { toast.error(e.message) } finally { resolving.value = false } }
function buildResolvedRule(kind) {
  const profile = resolveResult.value?.profile
  if (!profile) throw new Error(t('marketDataRules.errors.noResolveResult'))
  const base = {
    asset_class: profile.assetClass,
    instrument_type: profile.instrumentType,
    base_symbol: profile.baseSymbol,
    quote_currency: profile.quoteCurrency,
    unit: profile.unit,
    market: profile.market,
    exchange: profile.exchange,
    region: profile.region,
    canonical_symbol: profile.canonicalSymbol || profile.symbol || resolveForm.symbol,
    identifiers_json: profile.identifiers || {},
    rules_json: profile.rules || {},
    enabled: true,
  }
  if (kind === 'mappings') {
    return { ...base, input_symbol: profile.symbol || resolveForm.symbol, priority: 10 }
  }
  const assetId = Number(profile.assetId || resolveForm.asset_id)
  if (!Number.isFinite(assetId) || assetId <= 0) throw new Error(t('marketDataRules.errors.assetIdRequired'))
  return { ...base, asset_id: assetId, profile_source: 'configured' }
}
async function upsertResolvedRule(kind, payload, findExisting) {
  const rows = await requestJson(`/api/market/data/rules/${kind}`)
  const existing = rows.find(findExisting)
  if (existing) await requestJson(`/api/market/data/rules/${kind}/${encodeURIComponent(ruleKey(existing))}`, { method: 'PUT', body: JSON.stringify(payload) })
  else await requestJson(`/api/market/data/rules/${kind}`, { method: 'POST', body: JSON.stringify(payload) })
  activeKind.value = kind
  await Promise.all([loadRules(), loadChanges(), runLint({ silent: true })])
}
async function saveResolvedMapping() {
  savingResolved.value = 'mapping'
  try {
    const payload = buildResolvedRule('mappings')
    await upsertResolvedRule('mappings', payload, row => row.asset_class === payload.asset_class && String(row.input_symbol || '').toUpperCase() === String(payload.input_symbol || '').toUpperCase())
    toast.success(t('marketDataRules.messages.mappingSaved'))
  } catch (e) { toast.error(e.message) } finally { savingResolved.value = '' }
}
async function saveResolvedProfile() {
  savingResolved.value = 'profile'
  try {
    const payload = buildResolvedRule('profiles')
    await upsertResolvedRule('profiles', payload, row => Number(row.asset_id) === Number(payload.asset_id))
    toast.success(t('marketDataRules.messages.profileSaved'))
  } catch (e) { toast.error(e.message) } finally { savingResolved.value = '' }
}
function editRule(row) { editingKey.value = String(ruleKey(row)); ruleJson.value = pretty(row) }
function resetEditor() { editingKey.value = ''; ruleJson.value = '{}' }
async function saveRule() { savingRule.value = true; try { const body = parseEditorJson(); if (editingKey.value) await requestJson(`/api/market/data/rules/${activeKind.value}/${encodeURIComponent(editingKey.value)}`, { method: 'PUT', body: JSON.stringify(body) }); else await requestJson(`/api/market/data/rules/${activeKind.value}`, { method: 'POST', body: JSON.stringify(body) }); await loadRules(); resetEditor(); toast.success(t('marketDataRules.messages.ruleSaved')) } catch (e) { toast.error(e.message) } finally { savingRule.value = false } }
async function disableRule() { if (!editingKey.value) return; savingRule.value = true; try { await requestJson(`/api/market/data/rules/${activeKind.value}/${encodeURIComponent(editingKey.value)}`, { method: 'DELETE' }); await loadRules(); resetEditor(); toast.success(t('marketDataRules.messages.ruleDisabled')) } catch (e) { toast.error(e.message) } finally { savingRule.value = false } }
async function exportRules() { try { const data = await requestJson('/api/market/data/export'); const blob = new Blob([pretty(data)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `market-data-rules-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url) } catch (e) { toast.error(e.message) } }
async function importRules(dryRun) { try { const body = JSON.parse(importJson.value || '{}'); importResult.value = await requestJson(`/api/market/data/import${dryRun ? '?dry_run=1' : ''}`, { method: 'POST', body: JSON.stringify(body) }); if (!dryRun) { await Promise.all([loadRules(), runLint(), loadChanges()]) } toast.success(dryRun ? t('marketDataRules.messages.importPreviewDone') : t('marketDataRules.messages.importDone')) } catch (e) { toast.error(e.message) } }
async function loadChanges() { changes.value = await requestJson('/api/market/data/changes') }
async function loadAll() { loading.value = true; try { await loadKinds(); await Promise.all([loadRules(), runLint({ silent: true }), resolveAsset(), loadChanges()]) } catch (e) { toast.error(e.message) } finally { loading.value = false } }

onMounted(loadAll)
</script>

<style scoped>
.market-rules-page { width:100%; max-width:1180px; min-width:0; overflow-x:hidden; padding-bottom:36px; }
.market-rules-page * { box-sizing:border-box; }
.rules-hero { display:flex; justify-content:space-between; gap:20px; min-width:0; padding:24px; border:1px solid var(--border); border-radius:22px; background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 12%,var(--bg-card)),var(--bg-card)); margin-bottom:16px; }
.hero-kicker { color:var(--primary); font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
.hero-subtitle { color:var(--text-dim); line-height:1.6; }
.hero-actions,.header-controls,.editor-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; min-width:0; }
.mode-tabs { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; min-width:0; margin-bottom:16px; }
.mode-tab { display:flex; align-items:flex-start; gap:12px; min-width:0; text-align:left; border:1px solid var(--border); border-radius:16px; padding:14px; background:var(--bg-card); color:var(--text); cursor:pointer; }
.mode-tab.active { border-color:var(--primary); background:color-mix(in srgb,var(--blue) 12%,var(--bg-card)); }
.tab-index { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:10px; background:var(--bg-hover); color:var(--primary); font-weight:900; flex-shrink:0; }
.mode-tab strong,.mode-tab small { display:block; } .mode-tab small { color:var(--text-dim); margin-top:4px; }
.rules-panel { min-width:0; overflow:hidden; border:1px solid var(--border); border-radius:22px; padding:18px; background:var(--bg-card); }
.panel-header { display:flex; justify-content:space-between; gap:16px; min-width:0; align-items:flex-start; margin-bottom:16px; padding-bottom:14px; border-bottom:1px solid var(--border); }
.panel-header h2 { margin:0 0 4px; } .panel-header p { margin:0; color:var(--text-dim); font-size:13px; }
.resolve-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.resolve-grid label { display:flex; flex-direction:column; gap:6px; color:var(--text-dim); font-size:12px; font-weight:700; }
.result-grid,.rules-editor-grid,.import-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; align-items:start; min-width:0; }
.rules-help-strip { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-bottom:14px; }
.rules-help-strip span { padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:var(--bg); color:var(--text-dim); font-size:12px; line-height:1.45; }
.result-card,.rules-table-card,.json-editor-card { min-width:0; overflow:hidden; border:1px solid var(--border); border-radius:16px; padding:14px; background:var(--bg); }
pre { width:100%; min-width:0; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word; max-height:440px; overflow:auto; padding:12px; border-radius:12px; background:var(--bg-card); border:1px solid var(--border); font-size:12px; }
.candidate-list,.issue-list,.change-list { display:flex; flex-direction:column; gap:10px; }
.candidate,.issue-card,.change-item { border:1px solid var(--border); border-radius:14px; padding:12px; background:var(--bg-card); display:flex; flex-direction:column; gap:4px; }
.resolved-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
.candidate.matched { border-color:color-mix(in srgb,var(--green) 50%,var(--border)); } .candidate.skipped { opacity:.75; }
.issue-summary { display:flex; gap:10px; margin-bottom:14px; } .issue-pill { padding:6px 10px; border-radius:999px; font-size:12px; font-weight:800; border:1px solid var(--border); background:var(--bg); } .issue-pill.error,.issue-card.error { color:var(--red); border-color:var(--danger-border); background:var(--danger-soft); } .issue-pill.warning,.issue-card.warning { color:var(--warning); border-color:color-mix(in srgb,var(--warning) 42%,var(--border)); background:var(--warning-soft); } .issue-pill.info,.issue-card.info { color:var(--primary); border-color:color-mix(in srgb,var(--primary) 36%,var(--border)); background:var(--info-soft); }
.table-scroll { width:100%; min-width:0; overflow:auto; max-height:520px; -webkit-overflow-scrolling:touch; } table { width:100%; min-width:520px; border-collapse:collapse; font-size:13px; } th,td { padding:10px; border-bottom:1px solid var(--border); text-align:left; } code { color:var(--text-dim); overflow-wrap:anywhere; }
.json-textarea { width:100%; min-width:0; min-height:360px; resize:vertical; padding:12px; border:1px solid var(--border); border-radius:12px; background:var(--bg-card); color:var(--text); font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }
.btn.danger { border-color:var(--danger-border); color:var(--red); background:var(--danger-soft); }
.empty-card { padding:28px; border:1px dashed var(--border); border-radius:16px; text-align:center; color:var(--text-dim); }
@media (max-width: 900px) {
  .rules-hero,.panel-header { flex-direction:column; }
  .mode-tabs { display:grid; grid-template-columns:1fr 1fr; overflow:visible; gap:10px; padding-bottom:0; scroll-snap-type:none; }
  .mode-tab { min-width:0; scroll-snap-align:none; padding:12px; }
  .resolve-grid,.result-grid,.rules-editor-grid,.import-grid,.rules-help-strip { grid-template-columns:1fr; }
  .hero-actions,.header-controls,.editor-actions { width:100%; }
  .hero-actions .btn,.header-controls .btn,.editor-actions .btn,.header-controls .form-select { flex:1 1 100%; min-width:0; width:100%; }
  .json-textarea { min-height:260px; }
  .table-scroll { max-height:360px; }
}
@media (max-width: 520px) {
  .market-rules-page { width:100%; padding:0 0 112px; }
  .rules-hero,.rules-panel { width:100%; border-radius:18px; padding:12px; }
  .hero-subtitle,.panel-header p { overflow-wrap:anywhere; }
  .mode-tabs { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .mode-tab { width:100%; padding:10px; gap:8px; }
  .mode-tab small { font-size:11px; line-height:1.25; }
  .tab-index { width:24px; height:24px; border-radius:8px; }
  .resolve-grid { gap:10px; }
  .result-card,.rules-table-card,.json-editor-card { padding:12px; border-radius:14px; }
  .json-textarea { min-height:220px; font-size:16px; }
  .candidate,.issue-card,.change-item { padding:10px; }
  th,td { padding:8px; }
}
</style>

