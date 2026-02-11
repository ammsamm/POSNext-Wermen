# -*- coding: utf-8 -*-
# Copyright (c) 2026, BrainWise and contributors
# For license information, please see license.txt

"""
Thin API wrapper for expense management in POS interface.
Proxies calls to erpnext_expenses module + provides sync endpoint for offline expenses.
"""

from __future__ import unicode_literals
import frappe
from frappe import _


def _get_current_employee():
    """Get the current user's employee record. Returns dict or None."""
    user = frappe.session.user
    return frappe.db.get_value(
        "Employee",
        {"user_id": user, "status": "Active"},
        ["name", "employee_name", "company"],
        as_dict=True,
    )


def _validate_employee_access(employee):
    """Validate that the requested employee matches the current user's employee record."""
    current = _get_current_employee()
    if not current or current.name != employee:
        frappe.throw(
            _("You can only access your own expenses."),
            frappe.PermissionError,
        )
    return current


@frappe.whitelist()
def get_employee_info():
    """Get current user's employee record for expense creation."""
    employee = _get_current_employee()
    if not employee:
        frappe.throw(
            _("No active Employee record found for user {0}").format(
                frappe.session.user
            )
        )
    return employee


@frappe.whitelist()
def get_expenses(employee, limit=100):
    """Get expense list for an employee."""
    _validate_employee_access(employee)
    return frappe.get_list(
        "Expense",
        filters={"employee": employee},
        fields=[
            "name",
            "expense_description",
            "category",
            "total",
            "paid_by",
            "expense_date",
            "employee",
            "employee_name",
            "company",
            "notes",
            "docstatus",
        ],
        order_by="expense_date desc",
        limit_page_length=int(limit),
    )


@frappe.whitelist()
def get_expense_reports(employee, limit=50):
    """Get expense reports for an employee."""
    _validate_employee_access(employee)
    return frappe.get_list(
        "Expense Report",
        filters={"employee": employee},
        fields=[
            "name",
            "employee",
            "employee_name",
            "paid_by",
            "company",
            "workflow_state",
            "docstatus",
            "creation",
        ],
        order_by="creation desc",
        limit_page_length=int(limit),
    )


@frappe.whitelist()
def get_categories():
    """Get all expense categories for form autocomplete."""
    return frappe.get_list(
        "Expense Category",
        fields=["name", "category_name", "expense_account"],
        limit_page_length=0,
    )


@frappe.whitelist()
def get_paid_by_options():
    """Get paid_by select options from Expense DocType definition."""
    meta = frappe.get_meta("Expense")
    field = meta.get_field("paid_by")
    if field and field.options:
        return [opt for opt in field.options.split("\n") if opt.strip()]
    return []


@frappe.whitelist()
def save_expense(data):
    """Create or update an Expense document.

    For new expenses: creates and inserts.
    For existing expenses: loads from DB, updates editable fields, saves.
    """
    import json as _json

    if isinstance(data, str):
        data = _json.loads(data)

    current = _get_current_employee()
    if not current:
        frappe.throw(
            _("No active Employee record found for user {0}").format(
                frappe.session.user
            )
        )

    editable_fields = [
        "expense_description",
        "category",
        "total",
        "paid_by",
        "expense_date",
        "notes",
    ]

    expense_name = data.get("name")

    if expense_name:
        # Edit existing — load from DB to preserve system fields
        doc = frappe.get_doc("Expense", expense_name)

        if doc.docstatus != 0:
            frappe.throw(_("Only draft expenses can be edited."))

        if doc.employee != current.name:
            frappe.throw(
                _("You can only edit your own expenses."),
                frappe.PermissionError,
            )

        for field in editable_fields:
            if field in data:
                doc.set(field, data[field])

        doc.save()
    else:
        # Create new
        doc = frappe.new_doc("Expense")
        doc.employee = current.name
        doc.employee_name = current.employee_name
        doc.company = current.company

        for field in editable_fields:
            if field in data:
                doc.set(field, data[field])

        doc.insert()

    return doc.as_dict()


@frappe.whitelist()
def delete_expense(name):
    """Delete a draft Expense document."""
    current = _get_current_employee()
    if not current:
        frappe.throw(_("No active Employee record found."))

    doc = frappe.get_doc("Expense", name)

    if doc.employee != current.name:
        frappe.throw(
            _("You can only delete your own expenses."),
            frappe.PermissionError,
        )

    if doc.docstatus != 0:
        frappe.throw(_("Only draft expenses can be deleted."))

    frappe.delete_doc("Expense", name)
    return {"ok": True}


@frappe.whitelist()
def create_report(expense, details=None):
    """Create expense report from a single expense - proxy to erpnext_expenses."""
    try:
        from erpnext_expenses.erpnext_expenses.doctype.expense.expense import (
            create_expense_report,
        )
    except ImportError:
        frappe.throw(
            _(
                "The erpnext_expenses app is required for creating expense reports. "
                "Please install it."
            )
        )

    return create_expense_report(expense, details)


@frappe.whitelist()
def create_bulk_report(selected):
    """Create bulk expense report from multiple expenses - proxy to erpnext_expenses."""
    import json as _json

    try:
        from erpnext_expenses.erpnext_expenses.doctype.expense.expense import (
            create_bulk_expense_report,
        )
    except ImportError:
        frappe.throw(
            _(
                "The erpnext_expenses app is required for creating expense reports. "
                "Please install it."
            )
        )

    # Frontend sends an array of expense names — convert to the object format
    # that create_bulk_expense_report expects
    if isinstance(selected, str):
        names = _json.loads(selected)
    else:
        names = selected

    if isinstance(names, list) and names and isinstance(names[0], str):
        expenses = frappe.get_all(
            "Expense",
            filters={"name": ["in", names], "docstatus": 0},
            fields=["name", "expense_date", "category", "expense_description", "total"],
        )
        selected = _json.dumps(expenses)

    return create_bulk_expense_report(selected)


# ==========================================
# Workflow Transitions (Employee Actions)
# ==========================================


@frappe.whitelist()
def apply_workflow_action(report_name, action):
    """Apply a workflow action to an Expense Report.

    Employee-available actions:
      - Submit to Manager (Draft → Pending Manager)
      - Recall (Pending Manager → Draft)
      - Revise (Rejected → Draft)
    """
    allowed_actions = ["Submit to Manager", "Recall", "Revise"]
    if action not in allowed_actions:
        frappe.throw(
            _("Action '{0}' is not allowed from POS.").format(action),
            frappe.PermissionError,
        )

    doc = frappe.get_doc("Expense Report", report_name)

    # Verify the current user owns this report
    current = _get_current_employee()
    if not current or doc.employee != current.name:
        frappe.throw(
            _("You can only manage your own expense reports."),
            frappe.PermissionError,
        )

    from frappe.model.workflow import apply_workflow
    apply_workflow(doc, action)
    doc.reload()

    return {
        "name": doc.name,
        "workflow_state": doc.workflow_state,
        "docstatus": doc.docstatus,
    }


@frappe.whitelist()
def get_report_actions(report_name):
    """Get available workflow actions for an Expense Report."""
    doc = frappe.get_doc("Expense Report", report_name)

    # Verify ownership
    current = _get_current_employee()
    if not current or doc.employee != current.name:
        return []

    try:
        from frappe.model.workflow import get_transitions

        transitions = get_transitions(doc)
        # Only return employee-level actions
        allowed = {"Submit to Manager", "Recall", "Revise"}
        return [t.get("action") for t in transitions if t.get("action") in allowed]
    except Exception:
        return []
