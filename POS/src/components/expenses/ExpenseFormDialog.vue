<template>
	<Transition name="fade">
		<div
			v-if="show"
			class="fixed inset-0 bg-black bg-opacity-50 z-[400] flex items-center justify-center p-4"
			@click.self="handleClose"
		>
			<div class="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden">
				<!-- Header -->
				<div class="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-green-50 to-green-50">
					<h3 class="text-lg font-bold text-gray-900">
						{{ expense ? __('Edit Expense') : __('New Expense') }}
					</h3>
					<button
						@click="handleClose"
						class="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
					>
						<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>

				<!-- Form -->
				<div class="p-6 space-y-4">
					<!-- Description -->
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">{{ __('Description') }} *</label>
						<input
							v-model="form.expense_description"
							type="text"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
							:placeholder="__('What is this expense for?')"
						/>
					</div>

					<!-- Category -->
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">{{ __('Category') }} *</label>
						<select
							v-model="form.category"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm bg-white"
						>
							<option value="">{{ __('Select Category') }}</option>
							<option v-for="cat in categories" :key="cat.name" :value="cat.name">
								{{ cat.category_name || cat.name }}
							</option>
						</select>
					</div>

					<!-- Amount and Paid By -->
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">{{ __('Amount') }} *</label>
							<input
								v-model.number="form.total"
								type="number"
								step="0.01"
								min="0"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
								placeholder="0.00"
							/>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">{{ __('Paid By') }}</label>
							<select
								v-model="form.paid_by"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm bg-white"
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
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
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
				</div>

				<!-- Footer -->
				<div class="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
					<button
						@click="handleClose"
						class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
					>
						{{ __('Cancel') }}
					</button>
					<button
						@click="handleSave"
						:disabled="saving || !isValid"
						class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

watch(
	() => props.modelValue,
	(val) => {
		show.value = val
		if (val) {
			const defaultPaidBy = props.paidByOptions?.[0] || ""
			// Populate form from existing expense or reset
			if (props.expense) {
				form.value = {
					expense_description: props.expense.expense_description || "",
					category: props.expense.category || "",
					total: props.expense.total || null,
					paid_by: props.expense.paid_by || defaultPaidBy,
					expense_date: props.expense.expense_date || new Date().toISOString().split("T")[0],
					notes: props.expense.notes || "",
				}
			} else {
				form.value = getDefaultForm()
				form.value.paid_by = defaultPaidBy
			}
		}
	}
)

watch(show, (val) => {
	emit("update:modelValue", val)
})

function handleClose() {
	show.value = false
}

async function handleSave() {
	if (!isValid.value || saving.value) return
	saving.value = true

	try {
		const data = { ...form.value }
		// If editing an existing expense, include its name
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
