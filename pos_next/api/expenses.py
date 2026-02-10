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

    return create_bulk_expense_report(selected)
