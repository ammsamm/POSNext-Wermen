<template>
	<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
		<div class="p-4">
			<div class="flex items-start justify-between">
				<div>
					<div class="flex items-center gap-2">
						<h3 class="text-sm font-bold text-gray-900">{{ report.name }}</h3>
						<span
							:class="[
								'px-2 py-0.5 text-xs font-semibold rounded-full',
								workflowBadgeClass
							]"
						>
							{{ workflowLabel }}
						</span>
					</div>
					<p class="text-xs text-gray-500 mt-1">
						{{ report.employee_name }}
					</p>
				</div>
				<div class="text-end flex-shrink-0">
					<div v-if="report.paid_by" class="text-xs text-gray-500">
						{{ report.paid_by }}
					</div>
					<div class="text-xs text-gray-400 mt-1">
						{{ formatDate(report.creation) }}
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed } from "vue"

const props = defineProps({
	report: {
		type: Object,
		required: true,
	},
	currency: {
		type: String,
		default: "",
	},
})

const workflowBadgeClass = computed(() => {
	const state = (props.report.workflow_state || "").toLowerCase()
	if (state.includes("reject")) return "bg-red-100 text-red-800"
	if (state.includes("approved") || state.includes("journal")) return "bg-green-100 text-green-800"
	if (state.includes("finance")) return "bg-orange-100 text-orange-800"
	if (state.includes("pending") || state.includes("manager")) return "bg-amber-100 text-amber-800"
	if (props.report.docstatus === 1) return "bg-blue-100 text-blue-800"
	return "bg-gray-100 text-gray-800"
})

const workflowLabel = computed(() => {
	return props.report.workflow_state || (props.report.docstatus === 0 ? __("Draft") : __("Submitted"))
})

function formatDate(dateStr) {
	if (!dateStr) return ""
	try {
		return new Date(dateStr).toLocaleDateString()
	} catch {
		return dateStr
	}
}
</script>
