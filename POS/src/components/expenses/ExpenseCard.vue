<template>
	<div
		class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
		:class="{ 'ring-2 ring-green-500': selected }"
	>
		<!-- Card Header -->
		<div class="p-3 sm:p-4 border-b bg-gray-50">
			<div class="flex items-start justify-between gap-2">
				<div class="flex items-center gap-2 sm:gap-3 min-w-0">
					<!-- Checkbox for multi-select -->
					<input
						v-if="selectable && !expense._offline && expense.docstatus === 0"
						type="checkbox"
						:checked="selected"
						@change="$emit('select', expense)"
						class="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 flex-shrink-0"
					/>
					<div class="min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<h3 class="text-sm font-bold text-gray-900 truncate">{{ expense.name }}</h3>
							<!-- Status Badge -->
							<span
								:class="[
									'px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap flex-shrink-0',
									statusBadgeClass
								]"
							>
								{{ statusLabel }}
							</span>
						</div>
						<p v-if="expense.expense_description" class="text-sm text-gray-600 mt-0.5 line-clamp-1">
							{{ expense.expense_description }}
						</p>
					</div>
				</div>
				<div class="text-end flex-shrink-0">
					<div class="text-base sm:text-lg font-bold text-gray-900 whitespace-nowrap">
						{{ formatAmount(expense.total) }}
					</div>
				</div>
			</div>
		</div>

		<!-- Card Body -->
		<div class="p-3 sm:p-4">
			<div class="flex flex-wrap items-center gap-2 text-sm text-gray-600">
				<!-- Category Pill -->
				<span v-if="expense.category" class="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
					{{ expense.category }}
				</span>
				<!-- Date -->
				<span class="flex items-center gap-1">
					<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
					</svg>
					{{ expense.expense_date }}
				</span>
				<!-- Paid By -->
				<span v-if="expense.paid_by" class="text-xs text-gray-500">
					{{ expense.paid_by }}
				</span>
			</div>

			<!-- Notes -->
			<p v-if="expense.notes" class="text-xs text-gray-500 mt-2 line-clamp-2">
				{{ expense.notes }}
			</p>

			<!-- Actions -->
			<div v-if="expense.docstatus === 0" class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
				<button
					v-if="!expense._offline"
					@click="$emit('edit', expense)"
					class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-h-[36px]"
				>
					{{ __('Edit') }}
				</button>
				<button
					@click="$emit('delete', expense)"
					class="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors min-h-[36px]"
				>
					{{ __('Delete') }}
				</button>
				<button
					v-if="!expense._offline"
					@click="$emit('create-report', expense)"
					class="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors ms-auto min-h-[36px]"
				>
					{{ __('Create Report') }}
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed } from "vue"

const props = defineProps({
	expense: {
		type: Object,
		required: true,
	},
	currency: {
		type: String,
		default: "",
	},
	selectable: {
		type: Boolean,
		default: false,
	},
	selected: {
		type: Boolean,
		default: false,
	},
})

defineEmits(["edit", "delete", "select", "create-report"])

const statusBadgeClass = computed(() => {
	if (props.expense._offline) {
		return "bg-amber-100 text-amber-800"
	}
	switch (props.expense.docstatus) {
		case 0:
			return "bg-gray-100 text-gray-800"
		case 1:
			return "bg-blue-100 text-blue-800"
		case 2:
			return "bg-red-100 text-red-800"
		default:
			return "bg-gray-100 text-gray-800"
	}
})

const statusLabel = computed(() => {
	if (props.expense._offline) {
		return __("Pending Sync")
	}
	switch (props.expense.docstatus) {
		case 0:
			return __("Draft")
		case 1:
			return __("Submitted")
		case 2:
			return __("Cancelled")
		default:
			return __("Draft")
	}
})

function formatAmount(amount) {
	const num = parseFloat(amount) || 0
	const formatted = num.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})
	return props.currency ? `${formatted} ${props.currency}` : formatted
}
</script>
