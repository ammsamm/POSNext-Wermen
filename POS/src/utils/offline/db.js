import Dexie from "dexie"
import { logger } from "../logger"

/** @type {import('../logger').Logger} */
const log = logger.create("OfflineDB")

/**
 * @fileoverview IndexedDB persistence layer for POS Next offline functionality.
 *
 * This module provides:
 * - Auto-versioned Dexie database with schema migration
 * - Offline caching for items, customers, stock, prices
 * - Queue management for offline invoices and payments
 * - Settings persistence and translation cache
 *
 * Schema changes are auto-detected via hash comparison and trigger version bumps.
 *
 * @module db
 * @see {@link https://dexie.org/} Dexie.js documentation
 */

/** @type {Dexie} Main database instance */
export const db = new Dexie("pos_next_offline")

/**
 * Database schema definition.
 * Modify this object to change the schema - version will auto-increment.
 *
 * Index notation:
 * - `&` = unique primary key
 * - `++` = auto-increment primary key
 * - `*` = multi-entry index (array field)
 * - `[a+b]` = compound index
 *
 * @constant {Object}
 */
const CURRENT_SCHEMA = {
	// Key-value store for settings and metadata
	settings: "&key",

	// Invoice queue for offline submissions
	// offline_id is a unique UUID for deduplication across syncs
	invoice_queue: "++id, &offline_id, timestamp, synced",

	// Items cache with searchable fields
	// variant_of index allows querying variants by their template item
	items: "&item_code, item_name, item_group, variant_of, *barcodes",

	// Customers cache
	customers: "&name, customer_name, mobile_no, email_id",

	// Price list cache
	item_prices: "&[price_list+item_code], price_list, item_code",

	// Local stock cache
	stock: "&[item_code+warehouse], item_code, warehouse",

	// Payment methods cache
	payment_methods: "&mode_of_payment, pos_profile",

	// Payment queue for offline payments
	payment_queue: "++id, timestamp, synced",

	// Drafts (already handled by draftManager, but keeping for consistency)
	drafts: "++id, draft_id, timestamp",

	// Translations cache for offline language support
	translations: "&locale, timestamp",

	// Promotional offers cache for offline use
	// Indexed by name (unique), filterable by pos_profile
	offers: "&name, pos_profile, apply_on, valid_upto",

	// Invoice history cache for offline viewing
	// Stores submitted invoices for offline access
	invoice_history: "&name, pos_profile, posting_date, customer",

	// Unpaid invoices cache for offline viewing
	// Stores invoices with outstanding amounts for partial payment management
	unpaid_invoices: "&name, pos_profile, outstanding_amount, customer",

	// Expense categories cache for offline form autocomplete
	expense_categories: "&name, category_name",

	// Expenses cache (server-synced + offline-created)
	expenses_cache: "&name, employee, category, expense_date, docstatus, offline_id",

	// Expense queue for offline-created expenses (same pattern as invoice_queue)
	expense_queue: "++id, offline_id, timestamp, synced",
}

/**
 * Generates a 32-bit hash of the schema for change detection.
 * Uses djb2 algorithm for fast, deterministic hashing.
 * @param {Object} schema - Schema object to hash
 * @returns {number} Positive 32-bit integer hash
 * @private
 */
function getSchemaHash(schema) {
	const schemaString = JSON.stringify(schema)
	let hash = 0
	for (let i = 0; i < schemaString.length; i++) {
		const char = schemaString.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash // Convert to 32-bit integer
	}
	return Math.abs(hash)
}

/**
 * Determines the current schema version using localStorage tracking.
 * Compares stored hash against current schema hash to detect changes.
 * Auto-increments version when schema changes are detected.
 *
 * @returns {number} Current schema version number
 * @private
 */
function getSchemaVersion() {
	const schemaHash = getSchemaHash(CURRENT_SCHEMA)
	const storedHash = localStorage.getItem("pos_next_schema_hash")
	const storedVersion = Number.parseInt(
		localStorage.getItem("pos_next_schema_version") || "1",
	)

	if (storedHash !== schemaHash.toString()) {
		// Schema changed, increment version
		const newVersion = storedVersion + 1
		log.info(`Schema changed detected. Upgrading from v${storedVersion} to v${newVersion}`)
		localStorage.setItem("pos_next_schema_hash", schemaHash.toString())
		localStorage.setItem("pos_next_schema_version", newVersion.toString())
		return newVersion
	}

	return storedVersion
}

// Apply schema with auto-versioning
const schemaVersion = getSchemaVersion()
log.debug(`Initializing database with schema version: ${schemaVersion}`)
db.version(schemaVersion).stores(CURRENT_SCHEMA)

/**
 * Opens the database connection.
 * Called automatically on module import.
 * @returns {Promise<boolean>} True if opened successfully
 */
export const initDB = async () => {
	try {
		await db.open()
		log.success("POS Next offline database initialized")
		return true
	} catch (error) {
		log.error("Failed to initialize offline database:", error)
		return false
	}
}

/**
 * Verifies database health and attempts recovery if needed.
 * Handles VersionError and InvalidStateError by recreating the database.
 * @returns {Promise<boolean>} True if database is healthy or recovered
 */
export const checkDBHealth = async () => {
	try {
		await db.settings.get("health_check")
		return true
	} catch (error) {
		log.error("Database health check failed:", error)

		// Try to reopen
		try {
			if (db.isOpen()) {
				db.close()
			}
			await db.open()
			log.info("Database reopened successfully")
			return true
		} catch (reopenError) {
			log.error("Failed to reopen database:", reopenError)

			// If corrupted, recreate
			if (
				reopenError.name === "VersionError" ||
				reopenError.name === "InvalidStateError"
			) {
				log.warn("Database appears corrupted, recreating...")
				try {
					await Dexie.delete("pos_next_offline")
					await db.open()
					log.success("Database recreated successfully")
					return true
				} catch (recreateError) {
					log.error("Failed to recreate database:", recreateError)
					return false
				}
			}
			return false
		}
	}
}

/**
 * Retrieves a setting value from the database.
 * @param {string} key - Setting key to retrieve
 * @param {*} [defaultValue=null] - Value to return if key not found
 * @returns {Promise<*>} Stored value or defaultValue
 */
export const getSetting = async (key, defaultValue = null) => {
	try {
		const result = await db.settings.get(key)
		return result ? result.value : defaultValue
	} catch (error) {
		log.error(`Error getting setting ${key}:`, error)
		return defaultValue
	}
}

/**
 * Stores a setting value in the database.
 * @param {string} key - Setting key
 * @param {*} value - Value to store (must be IndexedDB-serializable)
 * @returns {Promise<void>}
 */
export const setSetting = async (key, value) => {
	try {
		await db.settings.put({ key, value })
	} catch (error) {
		log.error(`Error setting ${key}:`, error)
	}
}

/**
 * Clear all cached data (items, customers, stock, etc.) in a single transaction.
 * Preserves critical data like invoices, drafts, and settings.
 * Uses Dexie transaction for atomicity — all-or-nothing clearing.
 *
 * @param {Object} options - Options for clearing
 * @param {boolean} options.preserveInvoices - Keep invoice queue (default: true)
 * @param {boolean} options.preserveDrafts - Keep drafts (default: true)
 * @param {boolean} options.preserveSettings - Keep settings (default: true)
 * @param {boolean} options.preserveExpenseQueue - Keep expense queue (default: true)
 * @returns {Promise<Object>} - Status of cleared tables
 */
export const clearCachedData = async (options = {}) => {
	const {
		preserveInvoices = true,
		preserveDrafts = true,
		preserveSettings = true,
		preserveExpenseQueue = true,
	} = options

	// Build list of tables to clear
	const tablesToClear = [
		"items", "customers", "stock", "item_prices",
		"payment_methods", "translations", "expense_categories",
		"expenses_cache", "offers", "invoice_history", "unpaid_invoices",
	]

	if (!preserveInvoices) {
		tablesToClear.push("invoice_queue", "payment_queue")
	}
	if (!preserveDrafts) {
		tablesToClear.push("drafts")
	}
	if (!preserveSettings) {
		tablesToClear.push("settings")
	}
	if (!preserveExpenseQueue) {
		tablesToClear.push("expense_queue")
	}

	try {
		// Ensure DB is open
		if (!db.isOpen()) {
			await db.open()
		}

		// Filter to only tables that exist in the current DB
		const existingTableNames = new Set(db.tables.map(t => t.name))
		const validTables = tablesToClear.filter(name => existingTableNames.has(name))

		if (validTables.length === 0) {
			log.warn("No tables to clear")
			return { success: true, cleared: [] }
		}

		// Clear all tables in a single atomic transaction
		const tableRefs = validTables.map(name => db.table(name))
		await db.transaction("rw", tableRefs, async () => {
			await Promise.all(validTables.map(name => db.table(name).clear()))
		})

		log.info("Cached data cleared:", validTables)
		return { success: true, cleared: validTables }
	} catch (error) {
		log.error("Error clearing cached data:", error)

		// Fallback: clear tables individually if transaction fails
		const cleared = []
		for (const name of tablesToClear) {
			try {
				if (db.tables.some(t => t.name === name)) {
					await db.table(name).clear()
					cleared.push(name)
				}
			} catch (e) {
				log.warn(`Failed to clear table ${name}:`, e.message)
			}
		}
		log.info("Fallback clearing completed:", cleared)
		return { success: cleared.length > 0, cleared }
	}
}

/**
 * Coordinated cache clearing across all layers.
 * Call this from the main thread AFTER the worker has been shut down.
 *
 * Order: Cache Storage → Service Workers → IndexedDB → Translation memory → Browser storage
 *
 * @param {Object} options - Options passed to clearCachedData
 * @returns {Promise<{success: boolean}>}
 */
export const clearAllCaches = async (options = {}) => {
	try {
		// 1. Clear Cache Storage (Workbox caches)
		if ("caches" in self) {
			const cacheNames = await caches.keys()
			await Promise.all(cacheNames.map(name => caches.delete(name)))
			log.info(`Cleared ${cacheNames.length} Cache Storage entries`)
		}

		// 2. Unregister service workers
		if ("serviceWorker" in navigator) {
			const regs = await navigator.serviceWorker.getRegistrations()
			await Promise.all(regs.map(r => r.unregister()))
			log.info(`Unregistered ${regs.length} service workers`)
		}

		// 3. Clear IndexedDB in a single transaction
		await clearCachedData(options)

		// 4. Clear translation memory cache
		const { translationCache } = await import("./translationCache.js")
		await translationCache.clear()
		if (typeof window !== "undefined") {
			window.translatedMessages = {}
		}
		log.info("Translation memory cleared")

		// 5. Clear POS-specific browser storage
		clearBrowserCache()

		return { success: true }
	} catch (error) {
		log.error("Error in clearAllCaches:", error)
		throw error
	}
}

/**
 * NUCLEAR OPTION: Delete entire database and recreate
 * Use with caution - clears EVERYTHING including invoices and drafts
 * @returns {Promise<boolean>} - Success status
 */
export const nukeDatabase = async () => {
	try {
		log.warn("NUKING DATABASE - All data will be lost!")

		// Close database connection
		if (db.isOpen()) {
			db.close()
		}

		// Delete entire database
		await Dexie.delete("pos_next_offline")

		// Clear localStorage schema tracking
		localStorage.removeItem("pos_next_schema_hash")
		localStorage.removeItem("pos_next_schema_version")

		// Recreate database
		await db.open()

		log.success("Database nuked and recreated successfully")
		return true
	} catch (error) {
		log.error("Error nuking database:", error)
		return false
	}
}

/**
 * Clear browser cache and localStorage (POS-specific data only)
 * @returns {Object} - Status of cleared data
 */
export const clearBrowserCache = () => {
	const results = {
		localStorage: 0,
		sessionStorage: 0,
	}

	// Keys that must survive a cache clear (DB versioning needs these on reload)
	const PROTECTED_KEYS = new Set([
		"pos_next_schema_hash",
		"pos_next_schema_version",
	])

	try {
		// Clear POS-specific localStorage items only
		// IMPORTANT: Do NOT clear frappe_* keys — they contain session/auth data
		// IMPORTANT: Do NOT clear schema tracking keys — Dexie needs them for version detection
		const keysToRemove = []
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i)
			if (key?.startsWith('pos_next_') && !PROTECTED_KEYS.has(key)) {
				keysToRemove.push(key)
			}
		}

		keysToRemove.forEach(key => {
			localStorage.removeItem(key)
			results.localStorage++
		})

		// Clear POS-specific sessionStorage items only
		const sessionKeys = []
		for (let i = 0; i < sessionStorage.length; i++) {
			const key = sessionStorage.key(i)
			if (key?.startsWith('pos_next_')) {
				sessionKeys.push(key)
			}
		}

		sessionKeys.forEach(key => {
			sessionStorage.removeItem(key)
			results.sessionStorage++
		})

		log.info("Browser cache cleared:", results)
		return { success: true, cleared: results }
	} catch (error) {
		log.error("Error clearing browser cache:", error)
		return { success: false, error: error.message, cleared: results }
	}
}

// Initialize database on import
initDB()
