<template>
	<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
		<!-- Card Header -->
		<div class="p-3 sm:p-4 border-b bg-gray-50">
			<div class="flex items-start justify-between gap-2">
				<div class="min-w-0">
					<div class="flex items-center gap-2 flex-wrap">
						<h3 class="text-sm font-bold text-gray-900 truncate">{{ report.name }}</h3>
						<span
							:class="[
								'px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap flex-shrink-0',
								workflowBadgeClass
							]"
						>
							{{ workflowLabel }}
						</span>
					</div>
					<p class="text-xs text-gray-500 mt-1 truncate">
						{{ report.employee_name }}
					</p>
				</div>
				<div class="text-end flex-shrink-0">
					<div v-if="report.paid_by" class="text-xs text-gray-500">
						{{ __(report.paid_by) }}
					</div>
					<div class="text-xs text-gray-400 mt-1">
						{{ formatDate(report.creation) }}
					</div>
				</div>
			</div>
		</div>

		<!-- Workflow Step Indicator -->
		<div class="px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-100 overflow-x-auto">
			<div class="flex items-center gap-1 flex-nowrap min-w-max">
				<div
					v-for="(step, idx) in workflowSteps"
					:key="step.id"
					class="flex items-center gap-1"
				>
					<div
						:class="[
							'w-2 h-2 rounded-full flex-shrink-0',
							step.active ? step.color : step.reached ? step.color : 'bg-gray-300'
						]"
					></div>
					<span
						:class="[
							'text-xs whitespace-nowrap',
							step.active ? 'font-semibold text-gray-900' : step.reached ? 'text-gray-600' : 'text-gray-400'
						]"
					>
						{{ step.label }}
					</span>
					<svg v-if="idx < workflowSteps.length - 1" class="w-3 h-3 text-gray-300 flex-shrink-0 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
					</svg>
				</div>
			</div>
		</div>

		<!-- Actions -->
		<div v-if="availableActions.length > 0" class="px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 flex-wrap">
			<button
				v-for="action in availableActions"
				:key="action"
				@click="$emit('workflow-action', { report, action })"
				:class="actionButtonClass(action)"
			>
				{{ actionLabel(action) }}
			</button>
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
	actions: {
		type: Array,
		default: () => [],
	},
})

defineEmits(["workflow-action"])

const state = computed(() => (props.report.workflow_state || "").toLowerCase())

const workflowBadgeClass = computed(() => {
	const s = state.value
	if (s.includes("reject")) return "bg-red-100 text-red-800"
	if (s.includes("journal")) return "bg-blue-100 text-blue-800"
	if (s.includes("approved")) return "bg-green-100 text-green-800"
	if (s.includes("finance")) return "bg-orange-100 text-orange-800"
	if (s.includes("pending") || s.includes("manager")) return "bg-amber-100 text-amber-800"
	if (props.report.docstatus === 1) return "bg-blue-100 text-blue-800"
	return "bg-gray-100 text-gray-800"
})

const workflowLabel = computed(() => {
	return props.report.workflow_state || (props.report.docstatus === 0 ? __("Draft") : __("Submitted"))
})

const workflowSteps = computed(() => {
	const s = state.value
	const isRejected = s.includes("reject")

	const steps = [
		{ id: "draft", label: __("Draft"), color: "bg-gray-500", active: false, reached: true },
		{ id: "manager", label: __("Manager"), color: "bg-amber-500", active: false, reached: false },
		{ id: "finance", label: __("Finance"), color: "bg-orange-500", active: false, reached: false },
		{ id: "approved", label: __("Approved"), color: "bg-green-500", active: false, reached: false },
		{ id: "done", label: __("Complete"), color: "bg-blue-500", active: false, reached: false },
	]

	if (isRejected) {
		return [
			{ id: "draft", label: __("Draft"), color: "bg-gray-500", active: false, reached: true },
			{ id: "rejected", label: __("Rejected"), color: "bg-red-500", active: true, reached: true },
		]
	}

	// Determine progress
	if (s.includes("journal")) {
		steps.forEach((st) => { st.reached = true })
		steps[4].active = true
	} else if (s.includes("approved")) {
		steps[0].reached = true; steps[1].reached = true; steps[2].reached = true; steps[3].reached = true
		steps[3].active = true
	} else if (s.includes("finance")) {
		steps[0].reached = true; steps[1].reached = true; steps[2].reached = true
		steps[2].active = true
	} else if (s.includes("manager") || s.includes("pending")) {
		steps[0].reached = true; steps[1].reached = true
		steps[1].active = true
	} else {
		// Draft
		steps[0].active = true
	}

	return steps
})

const availableActions = computed(() => {
	// Use server-provided actions if available, otherwise infer from state
	if (props.actions.length > 0) return props.actions

	const s = state.value
	if (!s || s === "draft") return ["Submit to Manager"]
	if (s.includes("pending") && s.includes("manager")) return ["Recall"]
	if (s.includes("reject")) return ["Revise"]
	return []
})

function actionButtonClass(action) {
	const base = "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors min-h-[36px]"
	if (action === "Submit to Manager") {
		return `${base} text-white bg-green-600 hover:bg-green-700`
	}
	if (action === "Recall") {
		return `${base} text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100`
	}
	if (action === "Revise") {
		return `${base} text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100`
	}
	return `${base} text-gray-700 bg-gray-100 hover:bg-gray-200`
}

function actionLabel(action) {
	const labels = {
		"Submit to Manager": __("Submit to Manager"),
		"Recall": __("Recall"),
		"Revise": __("Revise"),
	}
	return labels[action] || action
}

function formatDate(dateStr) {
	if (!dateStr) return ""
	try {
		return new Date(dateStr).toLocaleDateString()
	} catch {
		return dateStr
	}
}
</script>
