$(document).ready(function () {
    fetchNetFunds();
    fetchExpenses();

    // ✅ Format Date as YYYY-MM-DD (Standardized)
    function formatDateForInput(dateStr) {
        if (!dateStr) return "";

        // Create a valid Date object
        const date = new Date(dateStr);

        // Check if the date is valid
        if (isNaN(date.getTime())) {
            console.error("Invalid date:", dateStr);
            return "";
        }

        // Return in YYYY-MM-DD format
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    // ✅ Open Add Expense Modal
    $("#openAddExpenseModal").click(function () {
        $("#addExpenseModal").fadeIn();
    });

    // ✅ Open Update Net Funds Modal
    $("#openUpdateNetFundsModal").click(function () {
        $("#updateNetFundsModal").fadeIn();
    });

    // ✅ Close Modals
    $(".close").click(function () {
        $(".modal").fadeOut();
    });

    // ✅ Update Net Funds
    $("#updateNetFunds").click(function () {
        let newFundsAmount = $("#newFundsAmount").val()?.trim() || "";

        if (!newFundsAmount || isNaN(newFundsAmount) || parseFloat(newFundsAmount) <= 0) {
            alert("Please enter a valid amount!");
            return;
        }

        $.ajax({
            url: "http://localhost:5001/set-initial-funds",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({ amount: parseFloat(newFundsAmount) }),
            success: function () {
                alert("Net funds updated successfully!");
                fetchNetFunds();
                $("#newFundsAmount").val("");
                $("#updateNetFundsModal").fadeOut();
            },
            error: function (err) {
                console.error("Error updating net funds:", err);
                alert("Error updating net funds. Check console for details.");
            }
        });
    });

    // ✅ Add Expense
    $("#addExpense").click(function () {
        let date = $("#expenseDate").val()?.trim() || "";
        let description = $("#expenseDesc").val()?.trim() || "";
        let amount = $("#expenseAmount").val()?.trim() || "";

        if (!date || !description || !amount || isNaN(amount) || parseFloat(amount) <= 0) {
            alert("Please enter all details correctly!");
            return;
        }

        // Ensure the date is in YYYY-MM-DD format
        const backendDate = formatDateForInput(date);

        if (!backendDate) {
            alert("Invalid date format! Please use YYYY-MM-DD.");
            return;
        }

        $.ajax({
            url: "http://localhost:5001/add-expense",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({ date: backendDate, description, amount: parseFloat(amount) }),
            success: function () {
                alert("Expense added successfully!");
                fetchExpenses();
                fetchNetFunds();
                $("#expenseDate, #expenseDesc, #expenseAmount").val("");
                $("#addExpenseModal").fadeOut();
            },
            error: function (err) {
                console.error("Error adding expense:", err);
                alert("Error adding expense. Check console for details.");
            }
        });
    });

    // ✅ Fetch Net Funds
    function fetchNetFunds() {
        $.get("http://localhost:5001/net-funds", function (data) {
            $("#netFunds").text(`₹${data.net_funds.toLocaleString()}`);
        }).fail(function (err) {
            console.error("Error fetching net funds:", err);
        });
    }

    // ✅ Fetch Expenses with Filters
    function fetchExpenses(filters = {}) {
        // Set default filter to current month and year if no monthYear filter is provided
        if (!filters.monthYear) {
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = String(currentDate.getMonth() + 1).padStart(2, "0");
            filters.monthYear = `${currentYear}-${currentMonth}`;
        }

        let query = $.param(filters);
        let url = `http://localhost:5001/filter-expenses?${query}`;

        $.get(url, function (expenses) {
            console.log("Fetched expenses:", expenses); // Debugging

            $("#expenseTable").empty();

            if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
                $("#expenseTable").append(`<tr><td colspan="5">No expenses found</td></tr>`);
                return;
            }

            expenses.forEach(exp => {
                $("#expenseTable").append(`
                    <tr data-id="${exp.id}">
                        <td>${formatDateForInput(exp.date)}</td>
                        <td>${exp.day}</td>
                        <td>${exp.description}</td>
                        <td>₹${exp.amount.toLocaleString()}</td>
                        <td>
                            <button class="edit-btn" 
                                data-id="${exp.id}" 
                                data-date="${exp.date}" 
                                data-desc="${exp.description}" 
                                data-amount="${exp.amount}">
                                Edit
                            </button>
                            <button class="delete-btn" data-id="${exp.id}">Delete</button>
                        </td>
                    </tr>
                `);
            });

            attachEditDeleteEvents();
        }).fail(function (err) {
            console.error("Error fetching expenses:", err);
        });
    }

    // ✅ Apply Filters
    $("#applyFilters").click(function () {
        let monthYear = $("#monthYearFilter").val()?.trim() || "";
        let minAmount = $("#minAmountFilter").val()?.trim() || "";

        let filters = {};
        if (monthYear) filters.monthYear = monthYear;
        if (minAmount) filters.minAmount = parseFloat(minAmount);

        fetchExpenses(filters);
    });

    // ✅ Reset Filters
    $("#resetFilters").click(function () {
        $("#monthYearFilter, #minAmountFilter").val("");
        fetchExpenses();
    });

    // ✅ Attach Edit/Delete Events
    function attachEditDeleteEvents() {
        $(".edit-btn").click(function () {
            let id = $(this).data("id");
            let date = $(this).data("date");
            let description = $(this).data("desc");
            let amount = $(this).data("amount");

            $("#editExpenseDate").val(date);  // Ensure correct date format
            $("#editExpenseDesc").val(description);
            $("#editExpenseAmount").val(amount);
            $("#editExpenseId").val(id);

            $("#editExpenseModal").fadeIn();
        });

        $(".delete-btn").click(function () {
            let id = $(this).data("id");

            if (!confirm("Are you sure you want to delete this expense?")) return;

            $.ajax({
                url: `http://localhost:5001/delete-expense/${id}`,
                type: "DELETE",
                success: function () {
                    alert("Expense deleted successfully!");
                    fetchExpenses();
                    fetchNetFunds();
                },
                error: function (err) {
                    console.error("Error deleting expense:", err);
                    alert("Error deleting expense. Check console for details.");
                }
            });
        });
    }

    // ✅ Update Expense
    $("#updateExpense").click(function () {
        let id = $("#editExpenseId").val();
        let date = $("#editExpenseDate").val()?.trim() || "";
        let description = $("#editExpenseDesc").val()?.trim() || "";
        let amount = $("#editExpenseAmount").val()?.trim() || "";

        if (!date || !description || !amount || isNaN(amount) || parseFloat(amount) <= 0) {
            alert("Please enter all details correctly!");
            return;
        }

        // Ensure the date is in YYYY-MM-DD format
        const backendDate = formatDateForInput(date);

        if (!backendDate) {
            alert("Invalid date format! Please use YYYY-MM-DD.");
            return;
        }

        $.ajax({
            url: `http://localhost:5001/edit-expense/${id}`,
            type: "PUT",
            contentType: "application/json",
            data: JSON.stringify({ date: backendDate, description, amount: parseFloat(amount) }),
            success: function () {
                alert("Expense updated successfully!");
                fetchExpenses();
                fetchNetFunds();
                $("#editExpenseModal").fadeOut();
            },
            error: function (err) {
                console.error("Error updating expense:", err);
                alert("Error updating expense. Check console for details.");
            }
        });
    });
});