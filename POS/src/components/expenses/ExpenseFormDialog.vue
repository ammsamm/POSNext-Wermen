<template>
	<Transition name="fade">
		<div
			v-if="show"
			class="fixed inset-0 bg-black bg-opacity-50 z-[400] flex items-end sm:items-center justify-center sm:p-4"
			@click.self="handleClose"
		>
			<div class="w-full max-w-lg bg-white rounded-t-xl sm:rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
				<!-- Header -->
				<div class="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b bg-gradient-to-r from-green-50 to-green-50 flex-shrink-0">
					<h3 class="text-base sm:text-lg font-bold text-gray-900">
						{{ expense ? __('Edit Expense') : __('New Expense') }}
					</h3>
					<button
						@click="handleClose"
						class="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-white/50 rounded-lg transition-colors"
					>
						<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>

				<!-- Form (scrollable) -->
				<div class="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
					<!-- Description -->
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">{{ __('Description') }} *</label>
						<input
							v-model="form.expense_description"
							type="text"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm min-h-[44px]"
							:placeholder="__('What is this expense for?')"
						/>
					</div>

					<!-- Category -->
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">{{ __('Category') }} *</label>
						<select
							v-model="form.category"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm bg-white min-h-[44px]"
						>
							<option value="">{{ __('Select Category') }}</option>
							<option v-for="cat in categories" :key="cat.name" :value="cat.name">
								{{ cat.category_name || cat.name }}
							</option>
						</select>
					</div>

					<!-- Amount and Paid By -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">{{ __('Amount') }} *</label>
							<input
								v-model.number="form.total"
								type="number"
								step="0.01"
								min="0"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm min-h-[44px]"
								placeholder="0.00"
							/>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">{{ __('Paid By') }}</label>
							<select
								v-model="form.paid_by"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm bg-white min-h-[44px]"
							>
								<option v-for="opt in paidByOptions" :key="opt" :value="opt">
									{{ opt }}
								</option>
							</select>
						</div>
					</div>

					<!-- Date -->
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">{{ __('Date') }} *</label>
						<input
							v-model="form.expense_date"
							type="date"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm min-h-[44px]"
						/>
					</div>

					<!-- Notes -->
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">{{ __('Notes') }}</label>
						<textarea
							v-model="form.notes"
							rows="2"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm resize-none"
							:placeholder="__('Additional notes...')"
						></textarea>
					</div>

					<!-- Attachments -->
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">
							{{ __('Attachments') }}
							<span class="text-xs text-gray-400 font-normal ms-1">
								({{ __('max {0} files, {1}MB each', [MAX_ATTACHMENTS, MAX_FILE_SIZE_MB]) }})
							</span>
						</label>

						<!-- Existing + New Attachments List -->
						<div v-if="attachments.length > 0" class="space-y-2 mb-3">
							<div
								v-for="(att, idx) in attachments"
								:key="att.id"
								class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
							>
								<!-- File icon -->
								<svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
								</svg>
								<!-- File name -->
								<span class="text-sm text-gray-700 truncate flex-1 min-w-0">
									{{ att.file_name }}
								</span>
								<!-- File size -->
								<span v-if="att.size" class="text-xs text-gray-400 flex-shrink-0 hidden sm:inline">
									{{ formatFileSize(att.size) }}
								</span>
								<!-- Uploading indicator -->
								<span v-if="att.uploading" class="text-xs text-green-600 flex-shrink-0">
									{{ __('Uploading...') }}
								</span>
								<!-- Remove button -->
								<button
									@click="removeAttachment(idx)"
									:disabled="saving"
									class="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
									</svg>
								</button>
							</div>
						</div>

						<!-- Upload Button -->
						<button
							v-if="attachments.length < MAX_ATTACHMENTS"
							@click="$refs.fileInput.click()"
							type="button"
							class="w-full px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors text-center min-h-[44px]"
						>
							<svg class="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
							</svg>
							{{ __('Add Receipt / Attachment') }}
						</button>
						<input
							ref="fileInput"
							type="file"
							:accept="ALLOWED_EXTENSIONS.map(e => '.' + e).join(',')"
							multiple
							class="hidden"
							@change="handleFileSelect"
						/>

						<!-- Validation Error -->
						<p v-if="attachmentError" class="text-xs text-red-600 mt-1">{{ attachmentError }}</p>
					</div>
				</div>

				<!-- Footer -->
				<div class="flex items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t bg-gray-50 flex-shrink-0">
					<button
						@click="handleClose"
						class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
					>
						{{ __('Cancel') }}
					</button>
					<button
						@click="handleSave"
						:disabled="saving || !isValid"
						class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
					>
						{{ saving ? __('Saving...') : __('Save') }}
					</button>
				</div>
			</div>
		</div>
	</Transition>
</template>

<script setup>
import { computed, ref, watch } from "vue"
import { call, uploadFile } from "@/utils/apiWrapper"

const MAX_ATTACHMENTS = 5
const MAX_FILE_SIZE_MB = 5
const MAX_TOTAL_SIZE_MB = 15
const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "gif", "webp", "doc", "docx", "xls", "xlsx"]

const props = defineProps({
	modelValue: Boolean,
	expense: {
		type: Object,
		default: null,
	},
	categories: {
		type: Array,
		default: () => [],
	},
	paidByOptions: {
		type: Array,
		default: () => [],
	},
	company: {
		type: String,
		default: "",
	},
	currency: {
		type: String,
		default: "",
	},
})

const emit = defineEmits(["update:modelValue", "saved"])

const show = ref(props.modelValue)
const saving = ref(false)
const attachments = ref([])
const attachmentError = ref("")
const fileInput = ref(null)

const form = ref(getDefaultForm())

function getDefaultForm() {
	const today = new Date().toISOString().split("T")[0]
	return {
		expense_description: "",
		category: "",
		total: null,
		paid_by: "",
		expense_date: today,
		notes: "",
	}
}

const isValid = computed(() => {
	return (
		form.value.expense_description?.trim() &&
		form.value.category &&
		form.value.total > 0 &&
		form.value.expense_date
	)
})

let idCounter = 0

watch(
	() => props.modelValue,
	async (val) => {
		show.value = val
		if (val) {
			attachmentError.value = ""
			const defaultPaidBy = props.paidByOptions?.[0] || ""

			if (props.expense) {
				form.value = {
					expense_description: props.expense.expense_description || "",
					category: props.expense.category || "",
					total: props.expense.total || null,
					paid_by: props.expense.paid_by || defaultPaidBy,
					expense_date: props.expense.expense_date || new Date().toISOString().split("T")[0],
					notes: props.expense.notes || "",
				}
				// Load existing attachments from server
				await loadExistingAttachments(props.expense.name)
			} else {
				form.value = getDefaultForm()
				form.value.paid_by = defaultPaidBy
				attachments.value = []
			}
		}
	}
)

watch(show, (val) => {
	emit("update:modelValue", val)
})

async function loadExistingAttachments(expenseName) {
	if (!expenseName || props.expense?._offline) {
		attachments.value = []
		return
	}
	try {
		const detail = await call("pos_next.api.expenses.get_expense_detail", {
			name: expenseName,
		})
		attachments.value = (detail.attachments || []).map((att) => ({
			id: ++idCounter,
			attachment: att.attachment,
			file_name: att.file_name || extractFileName(att.attachment),
			description: att.description || "",
			existing: true,
		}))
	} catch {
		attachments.value = []
	}
}

function extractFileName(url) {
	if (!url) return ""
	return url.split("/").pop()
}

function formatFileSize(bytes) {
	if (!bytes) return ""
	if (bytes < 1024) return bytes + " B"
	if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
	return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

function handleFileSelect(event) {
	attachmentError.value = ""
	const files = Array.from(event.target.files || [])
	event.target.value = "" // Reset input

	if (!files.length) return

	// Check total count
	if (attachments.value.length + files.length > MAX_ATTACHMENTS) {
		attachmentError.value = __("Maximum {0} attachments allowed", [MAX_ATTACHMENTS])
		return
	}

	for (const file of files) {
		// Check extension
		const ext = file.name.split(".").pop().toLowerCase()
		if (!ALLOWED_EXTENSIONS.includes(ext)) {
			attachmentError.value = __("File type .{0} is not allowed. Allowed: {1}", [ext, ALLOWED_EXTENSIONS.join(", ")])
			return
		}

		// Check individual size
		if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
			attachmentError.value = __("File {0} exceeds {1}MB limit", [file.name, MAX_FILE_SIZE_MB])
			return
		}
	}

	// Check total size
	const existingSize = attachments.value.reduce((sum, a) => sum + (a.size || 0), 0)
	const newSize = files.reduce((sum, f) => sum + f.size, 0)
	if (existingSize + newSize > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
		attachmentError.value = __("Total attachment size exceeds {0}MB limit", [MAX_TOTAL_SIZE_MB])
		return
	}

	// Add files to the list (will be uploaded on save)
	for (const file of files) {
		attachments.value.push({
			id: ++idCounter,
			file,
			file_name: file.name,
			size: file.size,
			existing: false,
		})
	}
}

function removeAttachment(idx) {
	attachments.value.splice(idx, 1)
	attachmentError.value = ""
}

function handleClose() {
	show.value = false
}

async function handleSave() {
	if (!isValid.value || saving.value) return
	saving.value = true

	try {
		// Upload new files first
		const uploadedAttachments = []

		for (const att of attachments.value) {
			if (att.existing) {
				// Keep existing attachment
				uploadedAttachments.push({
					attachment: att.attachment,
					description: att.description,
				})
			} else if (att.file) {
				// Upload new file
				att.uploading = true
				try {
					const result = await uploadFile(att.file)
					uploadedAttachments.push({
						attachment: result.file_url,
						description: "",
					})
					att.uploading = false
				} catch (error) {
					att.uploading = false
					attachmentError.value = __("Failed to upload {0}: {1}", [att.file_name, error.message])
					return
				}
			}
		}

		const data = {
			...form.value,
			attachments: uploadedAttachments,
		}

		if (props.expense?.name && !props.expense._offline) {
			data.name = props.expense.name
		}

		emit("saved", data)
		show.value = false
	} finally {
		saving.value = false
	}
}
</script>
