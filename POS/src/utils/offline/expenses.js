/**
 * @fileoverview Offline expense management for POS Next.
 *
 * Provides IndexedDB caching for expense categories, expenses, and reports,
 * plus a queue-based system for expenses created while offline.
 * Follows the same patterns as sync.js (invoice queue) and cache.js.
 *
 * @module utils/offline/expenses
 */

import { db, getSetting, setSetting } from "./db"
import { generateOfflineId } from "./uuid"
import { isOffline } from "./offlineState"
import { logger } from "../logger"
import { call } from "../apiWrapper"

/** @type {import('../logger').Logger} */
const log = logger.create("OfflineExpenses")

// ==========================================
// Helpers
// ==========================================

/**
 * Generate a display name for an offline expense from its offline_id.
 * @param {string} offline_id - The offline UUID
 * @returns {string} Display name like "OFFLINE-EXP-abcd1234"
 */
export function generateOfflineExpenseName(offline_id) {
	return `OFFLINE-EXP-${offline_id.replace("pos_offline_", "").slice(0, 8)}`
}

// ==========================================
// Paid By Options Caching
// ==========================================

/**
 * Cache paid_by options to IndexedDB for offline form use.
 * @param {Array<string>} options - Array of paid_by option strings
 * @returns {Promise<void>}
 */
export async function cachePaidByOptions(options) {
	try {
		await setSetting("expense_paid_by_options", options)
		log.debug(`Cached ${options?.length || 0} paid_by options`)
	} catch (error) {
		log.error("Failed to cache paid_by options:", error)
	}
}

/**
 * Get cached paid_by options from IndexedDB.
 * @returns {Promise<Array<string>>} Cached paid_by options
 */
export async function getCachedPaidByOptions() {
	try {
		return (await getSetting("expense_paid_by_options")) || []
	} catch (error) {
		log.error("Failed to get cached paid_by options:", error)
		return []
	}
}

// ==========================================
// Category Caching
// ==========================================

/**
 * Cache expense categories to IndexedDB for offline form autocomplete.
 * @param {Array} categories - Array of category objects from server
 * @returns {Promise<void>}
 */
export async function cacheExpenseCategories(categories) {
	try {
		await db.expense_categories.clear()
		if (categories?.length) {
			await db.expense_categories.bulkPut(categories)
		}
		log.debug(`Cached ${categories?.length || 0} expense categories`)
	} catch (error) {
		log.error("Failed to cache expense categories:", error)
	}
}

/**
 * Get all cached expense categories from IndexedDB.
 * @returns {Promise<Array>} Cached categories
 */
export async function getCachedCategories() {
	try {
		return await db.expense_categories.toArray()
	} catch (error) {
		log.error("Failed to get cached categories:", error)
		return []
	}
}

// ==========================================
// Expense Caching
// ==========================================

/**
 * Cache expenses to IndexedDB for offline viewing.
 * @param {Array} expenses - Array of expense objects from server
 * @returns {Promise<void>}
 */
export async function cacheExpenses(expenses) {
	try {
		await db.expenses_cache.clear()
		if (expenses?.length) {
			await db.expenses_cache.bulkPut(expenses)
		}
		log.debug(`Cached ${expenses?.length || 0} expenses`)
	} catch (error) {
		log.error("Failed to cache expenses:", error)
	}
}

/**
 * Get cached expenses filtered by employee.
 * @param {string} employee - Employee ID to filter by
 * @returns {Promise<Array>} Cached expenses for employee
 */
export async function getCachedExpenses(employee) {
	try {
		if (employee) {
			return await db.expenses_cache.where("employee").equals(employee).toArray()
		}
		return await db.expenses_cache.toArray()
	} catch (error) {
		log.error("Failed to get cached expenses:", error)
		return []
	}
}

// ==========================================
// Expense Report Caching (key-value in settings table)
// ==========================================

/**
 * Cache expense reports to IndexedDB settings table.
 * @param {Array} reports - Array of expense report objects
 * @param {string} employee - Employee ID for cache key
 * @returns {Promise<void>}
 */
export async function cacheExpenseReports(reports, employee) {
	try {
		await setSetting(`expense_reports_${employee}`, reports)
		log.debug(`Cached ${reports?.length || 0} expense reports for ${employee}`)
	} catch (error) {
		log.error("Failed to cache expense reports:", error)
	}
}

/**
 * Get cached expense reports for an employee.
 * @param {string} employee - Employee ID
 * @returns {Promise<Array>} Cached reports
 */
export async function getCachedExpenseReports(employee) {
	try {
		return (await getSetting(`expense_reports_${employee}`)) || []
	} catch (error) {
		log.error("Failed to get cached expense reports:", error)
		return []
	}
}

// ==========================================
// Expense Queue (offline creation)
// ==========================================

/**
 * Queue an expense for offline creation.
 * Generates an offline_id, stores to expense_queue, and adds to expenses_cache
 * so it appears in the list immediately.
 *
 * @param {Object} expenseData - Expense data to queue
 * @returns {Promise<{queueId: number, offline_id: string}>}
 */
export async function queueOfflineExpense(expenseData) {
	const offline_id = generateOfflineId()
	const timestamp = Date.now()
	const offlineName = generateOfflineExpenseName(offline_id)

	try {
		// Add to expense queue
		const queueId = await db.expense_queue.add({
			offline_id,
			timestamp,
			synced: 0,
			retry_count: 0,
			data: expenseData,
		})

		// Also add to expenses_cache so it appears in the list immediately
		await db.expenses_cache.put({
			name: offlineName,
			offline_id,
			employee: expenseData.employee,
			employee_name: expenseData.employee_name,
			expense_description: expenseData.expense_description,
			category: expenseData.category,
			total: expenseData.total,
			paid_by: expenseData.paid_by,
			expense_date: expenseData.expense_date,
			company: expenseData.company,
			notes: expenseData.notes,
			docstatus: 0,
			_offline: true,
			_queue_id: queueId,
		})

		log.info(`Queued offline expense: ${offlineName} (queue ID: ${queueId})`)
		return { queueId, offline_id, name: offlineName }
	} catch (error) {
		log.error("Failed to queue offline expense:", error)
		throw error
	}
}

/**
 * Get all pending (unsynced) expenses from the queue.
 * @returns {Promise<Array>} Pending expense queue entries
 */
export async function getPendingExpenses() {
	try {
		return await db.expense_queue.where("synced").equals(0).toArray()
	} catch (error) {
		log.error("Failed to get pending expenses:", error)
		return []
	}
}

/**
 * Get count of pending (unsynced) expenses.
 * @returns {Promise<number>} Count of unsynced expenses
 */
export async function getPendingCount() {
	try {
		return await db.expense_queue.where("synced").equals(0).count()
	} catch (error) {
		log.error("Failed to get pending expense count:", error)
		return 0
	}
}

/**
 * Mark a queued expense as synced and update the cache entry with server name.
 * @param {number} queueId - Queue entry ID
 * @param {string} serverName - Server-generated expense name
 * @returns {Promise<void>}
 */
export async function markExpenseSynced(queueId, serverName) {
	try {
		// Get the queue entry to find the offline name
		const entry = await db.expense_queue.get(queueId)
		if (!entry) return

		// Mark queue entry as synced
		await db.expense_queue.update(queueId, {
			synced: 1,
			server_name: serverName,
		})

		// Update cache: remove offline entry, the server data will be re-cached on next load
		const offlineName = generateOfflineExpenseName(entry.offline_id)
		await db.expenses_cache.delete(offlineName)

		log.info(`Marked expense synced: queue ${queueId} → ${serverName}`)
	} catch (error) {
		log.error("Failed to mark expense synced:", error)
	}
}

/**
 * Delete a queued expense from queue and cache.
 * @param {number} queueId - Queue entry ID
 * @returns {Promise<void>}
 */
export async function deleteQueuedExpense(queueId) {
	try {
		const entry = await db.expense_queue.get(queueId)
		if (entry) {
			const offlineName = generateOfflineExpenseName(entry.offline_id)
			await db.expenses_cache.delete(offlineName)
		}
		await db.expense_queue.delete(queueId)
		log.info(`Deleted queued expense: ${queueId}`)
	} catch (error) {
		log.error("Failed to delete queued expense:", error)
	}
}

// ==========================================
// Sync Function
// ==========================================

/**
 * Sync all pending offline expenses to the server.
 * Iterates the queue, creates each expense via API, marks synced on success.
 *
 * @returns {Promise<{success: number, failed: number, errors: Array}>}
 */
export async function syncOfflineExpenses() {
	const results = { success: 0, failed: 0, errors: [] }
	const pending = await getPendingExpenses()

	if (pending.length === 0) {
		log.debug("No pending expenses to sync")
		return results
	}

	log.info(`Syncing ${pending.length} offline expenses...`)

	for (const entry of pending) {
		// Skip if already retried too many times
		if (entry.retry_count >= 3) {
			log.warn(`Skipping expense ${entry.id}: max retries exceeded`)
			results.failed++
			results.errors.push({
				queueId: entry.id,
				error: "Max retries exceeded",
			})
			continue
		}

		try {
			// Create expense on server using frappe.client.save pattern
			const result = await call("frappe.client.save", {
				doc: {
					doctype: "Expense",
					...entry.data,
				},
			})

			if (result?.name) {
				await markExpenseSynced(entry.id, result.name)
				results.success++
				log.info(`Synced expense: ${result.name}`)
			} else {
				throw new Error("No name returned from server")
			}
		} catch (error) {
			log.error(`Failed to sync expense ${entry.id}:`, error)

			// Increment retry count
			try {
				await db.expense_queue.update(entry.id, {
					retry_count: (entry.retry_count || 0) + 1,
				})
			} catch (updateError) {
				log.error("Failed to update retry count:", updateError)
			}

			results.failed++
			results.errors.push({
				queueId: entry.id,
				error: error.message || String(error),
			})
		}
	}

	log.info(`Sync complete: ${results.success} success, ${results.failed} failed`)
	return results
}
