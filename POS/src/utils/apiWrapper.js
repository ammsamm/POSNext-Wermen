import { call as frappeCall } from "frappe-ui"

import { forceRefreshCSRFToken, isCSRFApiError } from "./csrf"

// Wrapped call function with CSRF auto-refresh
export async function call(method, params) {
	try {
		return await frappeCall(method, params)
	} catch (error) {
		if (isCSRFApiError(error)) {
			console.warn(
				"CSRF token error in call(), refreshing token and retrying...",
			)
			const refreshed = await forceRefreshCSRFToken()

			if (refreshed) {
				console.log("Retrying call after CSRF refresh...")
				return await frappeCall(method, params)
			}

			console.warn(
				"Could not refresh CSRF token. Server may have ignore_csrf enabled.",
			)
		}

		throw error
	}
}

/**
 * Upload a file to Frappe's file system.
 * @param {File} file - The File object to upload
 * @param {Object} options - Optional: { is_private, folder }
 * @returns {Promise<{file_url: string, name: string}>}
 */
export async function uploadFile(file, { is_private = 1, folder = "Home" } = {}) {
	const formData = new FormData()
	formData.append("file", file)
	formData.append("is_private", is_private)
	formData.append("folder", folder)

	const headers = {
		Accept: "application/json",
		"X-Frappe-CSRF-Token": window.csrf_token,
	}

	let response = await fetch("/api/method/upload_file", {
		method: "POST",
		body: formData,
		headers,
		credentials: "include",
	})

	// Retry on CSRF error
	if (response.status === 403 || response.status === 417) {
		const refreshed = await forceRefreshCSRFToken()
		if (refreshed) {
			headers["X-Frappe-CSRF-Token"] = window.csrf_token
			response = await fetch("/api/method/upload_file", {
				method: "POST",
				body: formData,
				headers,
				credentials: "include",
			})
		}
	}

	if (!response.ok) {
		const err = await response.json().catch(() => ({}))
		throw new Error(err._server_messages || err.message || "Upload failed")
	}

	const result = await response.json()
	return result.message
}
