import { defineStore } from "pinia"
import { computed, ref } from "vue"
import { call } from "@/utils/apiWrapper"
import { isOffline } from "@/utils/offline/offlineState"
import {
	cacheExpenseCategories,
	getCachedCategories,
	cacheExpenses,
	getCachedExpenses,
	cacheExpenseReports,
	getCachedExpenseReports,
	cachePaidByOptions,
	getCachedPaidByOptions,
	queueOfflineExpense,
	getPendingExpenses,
	getPendingCount,
	deleteQueuedExpense,
	syncOfflineExpenses,
	generateOfflineExpenseName,
} from "@/utils/offline/expenses"
import { logger } from "@/utils/logger"

const log = logger.create("ExpensesStore")

export const usePOSExpensesStore = defineStore("posExpenses", () => {
	// State
	const employee = ref(null)
	const expenses = ref([])
	const expenseReports = ref([])
	const categories = ref([])
	const paidByOptions = ref([])
	const pendingCount = ref(0)
	const loadingEmployee = ref(false)
	const loadingExpenses = ref(false)
	const loadingReports = ref(false)
	const loadingCategories = ref(false)

	// Computed
	const hasEmployee = computed(() => Boolean(employee.value?.name))
	const employeeName = computed(() => employee.value?.employee_name || "")
	const company = computed(() => employee.value?.company || "")

	const draftExpenses = computed(() =>
		expenses.value.filter((e) => e.docstatus === 0 && !e._offline)
	)
	const submittedExpenses = computed(() =>
		expenses.value.filter((e) => e.docstatus === 1)
	)
	const offlineExpenses = computed(() =>
		expenses.value.filter((e) => e._offline)
	)

	// Actions

	async function loadEmployee() {
		if (loadingEmployee.value) return
		loadingEmployee.value = true
		try {
			const result = await call("pos_next.api.expenses.get_employee_info")
			employee.value = result
			log.info("Employee loaded:", result?.name)
		} catch (error) {
			log.error("Failed to load employee:", error)
			employee.value = null
		} finally {
			loadingEmployee.value = false
		}
	}

	async function loadExpenses() {
		if (!employee.value?.name) return
		loadingExpenses.value = true

		try {
			if (!isOffline()) {
				// Online: fetch from API, cache to IndexedDB
				const result = await call("pos_next.api.expenses.get_expenses", {
					employee: employee.value.name,
				})
				const serverExpenses = result || []
				await cacheExpenses(serverExpenses)

				// Merge with any pending offline expenses
				const pending = await getPendingExpenses()
				const offlineEntries = pending
					.filter((p) => !p.synced)
					.map((p) => ({
						name: generateOfflineExpenseName(p.offline_id),
						offline_id: p.offline_id,
						...p.data,
						docstatus: 0,
						_offline: true,
						_queue_id: p.id,
					}))

				expenses.value = [...offlineEntries, ...serverExpenses]
			} else {
				// Offline: load from IndexedDB cache + pending queue
				const cached = await getCachedExpenses(employee.value.name)
				expenses.value = cached || []
			}

			// Update pending count
			pendingCount.value = await getPendingCount()
		} catch (error) {
			log.error("Failed to load expenses:", error)
			// Fallback to cache
			try {
				const cached = await getCachedExpenses(employee.value.name)
				expenses.value = cached || []
			} catch (cacheError) {
				log.error("Failed to load from cache:", cacheError)
				expenses.value = []
			}
		} finally {
			loadingExpenses.value = false
		}
	}

	async function loadExpenseReports() {
		if (!employee.value?.name) return
		loadingReports.value = true

		try {
			if (!isOffline()) {
				const result = await call("pos_next.api.expenses.get_expense_reports", {
					employee: employee.value.name,
				})
				expenseReports.value = result || []
				await cacheExpenseReports(result || [], employee.value.name)
			} else {
				expenseReports.value = await getCachedExpenseReports(employee.value.name)
			}
		} catch (error) {
			log.error("Failed to load expense reports:", error)
			try {
				expenseReports.value = await getCachedExpenseReports(employee.value.name)
			} catch (cacheError) {
				expenseReports.value = []
			}
		} finally {
			loadingReports.value = false
		}
	}

	async function loadCategories() {
		loadingCategories.value = true

		try {
			if (!isOffline()) {
				const result = await call("pos_next.api.expenses.get_categories")
				categories.value = result || []
				await cacheExpenseCategories(result || [])
			} else {
				categories.value = await getCachedCategories()
			}
		} catch (error) {
			log.error("Failed to load categories:", error)
			try {
				categories.value = await getCachedCategories()
			} catch (cacheError) {
				categories.value = []
			}
		} finally {
			loadingCategories.value = false
		}
	}

	async function loadPaidByOptions() {
		try {
			if (!isOffline()) {
				const result = await call("pos_next.api.expenses.get_paid_by_options")
				paidByOptions.value = result || []
				await cachePaidByOptions(result || [])
			} else {
				paidByOptions.value = await getCachedPaidByOptions()
			}
		} catch (error) {
			log.error("Failed to load paid_by options:", error)
			try {
				paidByOptions.value = await getCachedPaidByOptions()
			} catch (cacheError) {
				paidByOptions.value = []
			}
		}
	}

	async function saveExpense(data) {
		if (!isOffline()) {
			// Online: save via dedicated API (handles create vs edit properly)
			const result = await call("pos_next.api.expenses.save_expense", {
				data: JSON.stringify(data),
			})
			await loadExpenses()
			return { online: true, name: result.name }
		} else {
			// Offline: queue for later sync
			const expenseData = {
				employee: employee.value.name,
				employee_name: employee.value.employee_name,
				company: employee.value.company,
				...data,
			}
			const result = await queueOfflineExpense(expenseData)
			pendingCount.value = await getPendingCount()
			await loadExpenses()
			return { online: false, ...result }
		}
	}

	async function deleteExpense(name, queueId = null) {
		if (queueId) {
			// Offline expense - remove from queue and cache
			await deleteQueuedExpense(queueId)
			pendingCount.value = await getPendingCount()
			await loadExpenses()
			return
		}

		if (!isOffline()) {
			await call("pos_next.api.expenses.delete_expense", { name })
			await loadExpenses()
		}
	}

	async function createSingleReport(expenseName) {
		if (isOffline()) {
			throw new Error(__("Creating reports requires an internet connection"))
		}
		const result = await call("pos_next.api.expenses.create_report", {
			expense: expenseName,
		})
		await loadExpenses()
		await loadExpenseReports()
		return result
	}

	async function createBulkReport(expenseNames) {
		if (isOffline()) {
			throw new Error(__("Creating reports requires an internet connection"))
		}
		const result = await call("pos_next.api.expenses.create_bulk_report", {
			selected: JSON.stringify(expenseNames),
		})
		await loadExpenses()
		await loadExpenseReports()
		return result
	}

	async function applyReportAction(reportName, action) {
		if (isOffline()) {
			throw new Error(__("Workflow actions require an internet connection"))
		}
		const result = await call("pos_next.api.expenses.apply_workflow_action", {
			report_name: reportName,
			action,
		})
		await loadExpenseReports()
		await loadExpenses()
		return result
	}

	async function getReportActions(reportName) {
		if (isOffline()) return []
		try {
			return await call("pos_next.api.expenses.get_report_actions", {
				report_name: reportName,
			})
		} catch (error) {
			log.error("Failed to get report actions:", error)
			return []
		}
	}

	async function syncPending() {
		if (isOffline()) return { success: 0, failed: 0, errors: [] }

		const result = await syncOfflineExpenses()
		if (result.success > 0) {
			await loadExpenses()
		}
		pendingCount.value = await getPendingCount()
		return result
	}

	function reset() {
		employee.value = null
		expenses.value = []
		expenseReports.value = []
		categories.value = []
		pendingCount.value = 0
		loadingEmployee.value = false
		loadingExpenses.value = false
		loadingReports.value = false
		loadingCategories.value = false
	}

	return {
		// State
		employee,
		expenses,
		expenseReports,
		categories,
		paidByOptions,
		pendingCount,
		loadingEmployee,
		loadingExpenses,
		loadingReports,
		loadingCategories,

		// Computed
		hasEmployee,
		employeeName,
		company,
		draftExpenses,
		submittedExpenses,
		offlineExpenses,

		// Actions
		loadEmployee,
		loadExpenses,
		loadExpenseReports,
		loadCategories,
		loadPaidByOptions,
		saveExpense,
		deleteExpense,
		createSingleReport,
		createBulkReport,
		applyReportAction,
		getReportActions,
		syncPending,
		reset,
	}
})
