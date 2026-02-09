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


@frappe.whitelist()
def get_employee_info():
    """Get current user's employee record for expense creation."""
    user = frappe.session.user
    employee = frappe.db.get_value(
        "Employee",
        {"user_id": user, "status": "Active"},
        ["name", "employee_name", "company"],
        as_dict=True,
    )
    if not employee:
        frappe.throw(_("No active Employee record found for user {0}").format(user))
    return employee


@frappe.whitelist()
def get_expenses(employee, limit=100):
    """Get expense list for an employee."""
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
def create_report(expense, details=None):
    """Create expense report from a single expense - proxy to erpnext_expenses."""
    from erpnext_expenses.erpnext_expenses.doctype.expense.expense import (
        create_expense_report,
    )

    return create_expense_report(expense, details)


@frappe.whitelist()
def create_bulk_report(selected):
    """Create bulk expense report from multiple expenses - proxy to erpnext_expenses."""
    from erpnext_expenses.erpnext_expenses.doctype.expense.expense import (
        create_bulk_expense_report,
    )

    return create_bulk_expense_report(selected)
