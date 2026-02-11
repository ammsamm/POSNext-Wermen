<template>
	<!-- Full Page Overlay -->
	<Transition name="fade">
		<div
			v-if="show"
			class="fixed inset-0 bg-black bg-opacity-50 z-[300]"
			@click.self="handleClose"
		>
			<!-- Main Container -->
			<div class="fixed inset-0 flex items-center justify-center p-4">
				<div class="w-full h-full max-w-[95vw] max-h-[95vh] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
					<!-- Header -->
					<div class="flex items-center justify-between px-6 py-5 border-b bg-gradient-to-r from-green-50 to-green-50">
						<div class="flex items-center gap-3">
							<div class="p-2 bg-green-100 rounded-lg">
								<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
								</svg>
							</div>
							<div>
								<h2 class="text-xl font-bold text-gray-900">{{ __('Expense Management') }}</h2>
								<p class="text-sm text-gray-600 flex items-center mt-0.5">
									{{ expenseStore.employeeName }}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<Button
								@click="handleRefresh"
								:loading="isLoading"
								variant="ghost"
								size="sm"
							>
								<template #prefix>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
									</svg>
								</template>
								{{ __('Refresh') }}
							</Button>
							<button
								@click="handleClose"
								class="p-2 hover:bg-white/50 rounded-lg transition-colors"
							>
								<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
								</svg>
							</button>
						</div>
					</div>

					<!-- Offline Banner -->
					<div v-if="offline" class="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
						<svg class="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414"/>
						</svg>
						<div class="flex-1 text-start">
							<p class="text-sm font-medium text-amber-800">{{ __('You are offline') }}</p>
							<p class="text-xs text-amber-700">{{ __('Expenses will sync when you reconnect.') }}</p>
						</div>
					</div>

					<!-- Employee Error -->
					<div v-if="!expenseStore.loadingEmployee && !expenseStore.hasEmployee" class="flex-1 flex items-center justify-center">
						<div class="text-center px-6">
							<svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
							</svg>
							<p class="text-gray-600 font-medium">{{ __('No Employee Record Found') }}</p>
							<p class="text-gray-500 text-sm mt-1">{{ __('Your user account must be linked to an active Employee record to manage expenses.') }}</p>
						</div>
					</div>

					<!-- Main Content (only when employee is available) -->
					<template v-else-if="expenseStore.hasEmployee">
						<!-- Tabs Navigation -->
						<div class="border-b border-gray-200 bg-gray-50">
							<nav class="flex gap-2 px-6" :aria-label="__('Tabs')">
								<button
									v-for="tab in visibleTabs"
									:key="tab.id"
									@click="activeTab = tab.id"
									:class="[
										'px-4 py-3 text-sm font-semibold transition-all border-b-2 relative',
										activeTab === tab.id
											? 'text-green-600 border-green-500'
											: 'text-gray-600 border-transparent hover:text-gray-800 hover:border-gray-300'
									]"
								>
									<div class="flex items-center gap-2">
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.icon"/>
										</svg>
										<span>{{ tab.label }}</span>
										<span
											v-if="tab.badge > 0"
											:class="[
												'ms-1 px-2 py-0.5 text-xs font-bold rounded-full',
												activeTab === tab.id
													? 'bg-green-100 text-green-800'
													: 'bg-gray-200 text-gray-700'
											]"
										>
											{{ tab.badge }}
										</span>
									</div>
								</button>
							</nav>
						</div>

						<!-- Tab Content -->
						<div class="flex-1 overflow-y-auto bg-gray-50">
							<!-- Loading -->
							<div v-if="expenseStore.loadingEmployee" class="flex flex-col items-center justify-center py-16">
								<div class="animate-spin rounded-full h-12 w-12 border-b-3 border-green-500 mb-4"></div>
								<p class="text-sm font-medium text-gray-600">{{ __('Loading...') }}</p>
							</div>

							<div v-else class="p-6">
								<!-- My Expenses Tab -->
								<div v-if="activeTab === 'expenses'">
									<!-- Filter + New Button Row -->
									<div class="flex items-center justify-between mb-4 flex-wrap gap-2">
										<div class="flex items-center gap-2 flex-wrap">
											<button
												@click="expenseFilter = 'all'"
												:class="[
													'px-4 py-2 rounded-lg font-medium text-sm transition-all',
													expenseFilter === 'all'
														? 'bg-green-100 text-gray-900 shadow-md border border-green-300'
														: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
												]"
											>
												{{ __('All ({0})', [expenseStore.expenses.length]) }}
											</button>
											<button
												@click="expenseFilter = 'draft'"
												:class="[
													'px-4 py-2 rounded-lg font-medium text-sm transition-all',
													expenseFilter === 'draft'
														? 'bg-green-100 text-gray-900 shadow-md border border-green-300'
														: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
												]"
											>
												{{ __('Draft ({0})', [expenseStore.draftExpenses.length]) }}
											</button>
											<button
												@click="expenseFilter = 'submitted'"
												:class="[
													'px-4 py-2 rounded-lg font-medium text-sm transition-all',
													expenseFilter === 'submitted'
														? 'bg-green-100 text-gray-900 shadow-md border border-green-300'
														: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
												]"
											>
												{{ __('Submitted ({0})', [expenseStore.submittedExpenses.length]) }}
											</button>
										</div>
										<div class="flex items-center gap-2">
											<!-- Multi-select Create Report -->
											<button
												v-if="selectedExpenses.length > 0 && !offline"
												@click="handleBulkReport"
												:disabled="creatingReport"
												class="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
											>
												{{ __('Create Report ({0})', [selectedExpenses.length]) }}
											</button>
											<button
												@click="handleNewExpense"
												class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
											>
												{{ __('+ New Expense') }}
											</button>
										</div>
									</div>

									<!-- Loading State -->
									<div v-if="expenseStore.loadingExpenses" class="flex flex-col items-center justify-center py-12">
										<div class="animate-spin rounded-full h-10 w-10 border-b-3 border-green-500 mb-3"></div>
										<p class="text-sm text-gray-600">{{ __('Loading expenses...') }}</p>
									</div>

									<!-- Empty State -->
									<div v-else-if="filteredExpenses.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
										<svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
										</svg>
										<p class="text-gray-600 font-medium">{{ __('No Expenses') }}</p>
										<p class="text-gray-500 text-sm mt-1">{{ __('Create your first expense to get started.') }}</p>
									</div>

									<!-- Expense Cards -->
									<div v-else class="flex flex-col gap-4">
										<ExpenseCard
											v-for="expense in filteredExpenses"
											:key="expense.name"
											:expense="expense"
											:currency="currency"
											:selectable="!offline"
											:selected="selectedExpenses.includes(expense.name)"
											@edit="handleEditExpense"
											@delete="handleDeleteExpense"
											@select="handleToggleSelect"
											@create-report="handleCreateReport"
										/>
									</div>
								</div>

								<!-- My Reports Tab -->
								<div v-if="activeTab === 'reports'">
									<!-- Loading -->
									<div v-if="expenseStore.loadingReports" class="flex flex-col items-center justify-center py-12">
										<div class="animate-spin rounded-full h-10 w-10 border-b-3 border-green-500 mb-3"></div>
										<p class="text-sm text-gray-600">{{ __('Loading reports...') }}</p>
									</div>

									<!-- Empty State -->
									<div v-else-if="expenseStore.expenseReports.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
										<svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
										</svg>
										<p class="text-gray-600 font-medium">{{ __('No Expense Reports') }}</p>
										<p class="text-gray-500 text-sm mt-1">{{ __('Create reports from your draft expenses.') }}</p>
									</div>

									<!-- Report Cards -->
									<div v-else class="flex flex-col gap-4">
										<ExpenseReportCard
											v-for="report in expenseStore.expenseReports"
											:key="report.name"
											:report="report"
											:currency="currency"
											:actions="reportActions[report.name] || []"
											@workflow-action="handleWorkflowAction"
										/>
									</div>
								</div>

								<!-- Pending Sync Tab -->
								<div v-if="activeTab === 'pending'">
									<div class="flex items-center justify-between mb-4">
										<p class="text-sm text-gray-600">
											{{ __('({0}) expenses waiting to sync', [expenseStore.pendingCount]) }}
										</p>
										<button
											v-if="!offline && expenseStore.pendingCount > 0"
											@click="handleSyncNow"
											:disabled="syncing"
											class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
										>
											{{ syncing ? __('Syncing...') : __('Sync Now') }}
										</button>
									</div>

									<!-- Offline Warning for Sync -->
									<div v-if="offline" class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
										<p class="text-sm text-amber-800 font-medium">{{ __('Connect to the internet to sync expenses.') }}</p>
									</div>

									<!-- Pending Expense Cards -->
									<div v-if="expenseStore.offlineExpenses.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
										<svg class="w-16 h-16 text-green-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
										</svg>
										<p class="text-gray-600 font-medium">{{ __('All Synced') }}</p>
										<p class="text-gray-500 text-sm mt-1">{{ __('No pending expenses to sync.') }}</p>
									</div>
									<div v-else class="flex flex-col gap-4">
										<ExpenseCard
											v-for="expense in expenseStore.offlineExpenses"
											:key="expense.name"
											:expense="expense"
											:currency="currency"
											@delete="handleDeleteExpense"
										/>
									</div>
								</div>
							</div>
						</div>
					</template>
				</div>
			</div>

			<!-- Expense Form Dialog -->
			<ExpenseFormDialog
				v-model="showExpenseForm"
				:expense="editingExpense"
				:categories="expenseStore.categories"
				:paid-by-options="expenseStore.paidByOptions"
				:company="expenseStore.company"
				:currency="currency"
				@saved="handleExpenseSaved"
			/>
		</div>
	</Transition>
</template>

<script setup>
import { Button } from "frappe-ui"
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { usePOSExpensesStore } from "@/stores/posExpenses"
import { offlineState } from "@/utils/offline/offlineState"
import { useToast } from "@/composables/useToast"
import ExpenseCard from "./ExpenseCard.vue"
import ExpenseReportCard from "./ExpenseReportCard.vue"
import ExpenseFormDialog from "./ExpenseFormDialog.vue"

const props = defineProps({
	modelValue: Boolean,
	currency: {
		type: String,
		default: "",
	},
})

const emit = defineEmits(["update:modelValue"])

const expenseStore = usePOSExpensesStore()
const { showSuccess, showError, showInfo } = useToast()

const show = ref(props.modelValue)
const activeTab = ref("expenses")
const expenseFilter = ref("all")
const selectedExpenses = ref([])
const showExpenseForm = ref(false)
const editingExpense = ref(null)
const creatingReport = ref(false)
const syncing = ref(false)
const reportActions = ref({})

// Reactive offline state via subscription (isOffline() is not reactive in Vue computed)
const offline = ref(offlineState.isOffline)
let offlineUnsubscribe = null

onMounted(() => {
	offlineUnsubscribe = offlineState.subscribe((state) => {
		offline.value = state.isOffline
	})
})

onUnmounted(() => {
	if (offlineUnsubscribe) {
		offlineUnsubscribe()
		offlineUnsubscribe = null
	}
})

const isLoading = computed(() =>
	expenseStore.loadingExpenses || expenseStore.loadingReports || expenseStore.loadingCategories
)

const visibleTabs = computed(() => {
	const tabs = [
		{
			id: "expenses",
			label: __("My Expenses"),
			icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
			badge: expenseStore.expenses.length,
		},
		{
			id: "reports",
			label: __("My Reports"),
			icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
			badge: expenseStore.expenseReports.length,
		},
	]

	if (expenseStore.pendingCount > 0) {
		tabs.push({
			id: "pending",
			label: __("Pending Sync"),
			icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
			badge: expenseStore.pendingCount,
		})
	}

	return tabs
})

const filteredExpenses = computed(() => {
	switch (expenseFilter.value) {
		case "draft":
			return expenseStore.expenses.filter((e) => e.docstatus === 0 && !e._offline)
		case "submitted":
			return expenseStore.expenses.filter((e) => e.docstatus === 1)
		default:
			return expenseStore.expenses
	}
})

// Watch modelValue to sync show
watch(
	() => props.modelValue,
	async (val) => {
		show.value = val
		if (val) {
			selectedExpenses.value = []
			expenseFilter.value = "all"
			activeTab.value = "expenses"
			await initializeData()
		}
	}
)

watch(show, (val) => {
	emit("update:modelValue", val)
})

async function initializeData() {
	// Load employee first, then data in parallel
	await expenseStore.loadEmployee()
	if (!expenseStore.hasEmployee) return

	// Auto-sync pending expenses when online (syncPending returns early if nothing to sync)
	if (!offline.value) {
		try {
			await expenseStore.syncPending()
		} catch {
			// Non-critical, continue loading
		}
	}

	// Load data in parallel
	await Promise.all([
		expenseStore.loadExpenses(),
		expenseStore.loadExpenseReports(),
		expenseStore.loadCategories(),
		expenseStore.loadPaidByOptions(),
	]).catch((error) => {
		console.error("[ExpenseManagement] Error loading data:", error)
	})

	// Load workflow actions for reports (after reports are loaded)
	await loadReportActions()
}

function handleClose() {
	show.value = false
}

async function handleRefresh() {
	await Promise.all([
		expenseStore.loadExpenses(),
		expenseStore.loadExpenseReports(),
		expenseStore.loadCategories(),
	])
	await loadReportActions()
}

function handleNewExpense() {
	editingExpense.value = null
	showExpenseForm.value = true
}

function handleEditExpense(expense) {
	editingExpense.value = expense
	showExpenseForm.value = true
}

async function handleExpenseSaved(data) {
	try {
		const result = await expenseStore.saveExpense(data)
		if (result.online) {
			showSuccess(__("Expense saved"))
		} else {
			showInfo(__("Expense saved offline — will sync when online"))
		}
	} catch (error) {
		showError(error.message || __("Failed to save expense"))
	}
}

async function handleDeleteExpense(expense) {
	if (!confirm(__("Are you sure you want to delete this expense?"))) return
	try {
		await expenseStore.deleteExpense(expense.name, expense._queue_id)
		showSuccess(__("Expense deleted"))
	} catch (error) {
		showError(error.message || __("Failed to delete expense"))
	}
}

function handleToggleSelect(expense) {
	const idx = selectedExpenses.value.indexOf(expense.name)
	if (idx >= 0) {
		selectedExpenses.value.splice(idx, 1)
	} else {
		selectedExpenses.value.push(expense.name)
	}
}

async function handleCreateReport(expense) {
	if (offline.value) {
		showError(__("Creating reports requires an internet connection"))
		return
	}
	creatingReport.value = true
	try {
		await expenseStore.createSingleReport(expense.name)
		showSuccess(__("Expense report created"))
	} catch (error) {
		showError(error.message || __("Failed to create report"))
	} finally {
		creatingReport.value = false
	}
}

async function handleBulkReport() {
	if (offline.value) {
		showError(__("Creating reports requires an internet connection"))
		return
	}
	creatingReport.value = true
	try {
		await expenseStore.createBulkReport(selectedExpenses.value)
		selectedExpenses.value = []
		showSuccess(__("Expense report created"))
	} catch (error) {
		showError(error.message || __("Failed to create report"))
	} finally {
		creatingReport.value = false
	}
}

async function handleSyncNow() {
	syncing.value = true
	try {
		const result = await expenseStore.syncPending()
		if (result.success > 0) {
			showSuccess(__("{0} expenses synced successfully", [result.success]))
		}
		if (result.failed > 0) {
			showError(__("{0} expenses failed to sync", [result.failed]))
		}
	} catch (error) {
		showError(error.message || __("Sync failed"))
	} finally {
		syncing.value = false
	}
}

async function loadReportActions() {
	if (offline.value) return
	reportActions.value = {}
	for (const report of expenseStore.expenseReports) {
		try {
			const actions = await expenseStore.getReportActions(report.name)
			if (actions.length > 0) {
				reportActions.value[report.name] = actions
			}
		} catch {
			// Non-critical
		}
	}
}

async function handleWorkflowAction({ report, action }) {
	if (offline.value) {
		showError(__("Workflow actions require an internet connection"))
		return
	}
	try {
		await expenseStore.applyReportAction(report.name, action)
		showSuccess(__("{0}: {1}", [report.name, action]))
		await loadReportActions()
	} catch (error) {
		showError(error.message || __("Failed to apply action"))
	}
}
</script>
