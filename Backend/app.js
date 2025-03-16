require("dotenv").config(); // Load environment variables
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const moment = require("moment");

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(bodyParser.json());

// ✅ MySQL Database Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "Tanisha@2004",
  database: process.env.DB_NAME || "society_management",
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  } else {
    console.log("Connected to MySQL database");
  }
});

// ✅ Format Date as YYYY-MM-DD (Standardized)
const formatDate = (dateString) => moment(dateString).format("YYYY-MM-DD");

// ✅ Get Net Funds
app.get("/net-funds", async (req, res) => {
    try {
        const [funds] = await db.promise().query("SELECT net_funds FROM net_funds ORDER BY id DESC LIMIT 1");
        res.json({ net_funds: funds[0]?.net_funds || 0 });
    } catch (error) {
        console.error("Error fetching net funds:", error);
        res.status(500).json({ error: "Failed to fetch net funds" });
    }
});

// ✅ Set Initial Funds
app.post("/set-initial-funds", async (req, res) => {
  const { amount } = req.body;

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: "Please provide a valid amount." });
  }

  try {
    const conn = db.promise();

    // Fetch the latest net funds
    const [funds] = await conn.query("SELECT net_funds FROM net_funds ORDER BY id DESC LIMIT 1");
    let previousFunds = parseFloat(funds[0]?.net_funds || 0);

    // Calculate new net funds by adding the new initial amount
    let newNetFunds = previousFunds + parseFloat(amount);

    // Insert new net funds value
    await conn.query("INSERT INTO net_funds (net_funds) VALUES (?)", [newNetFunds]);

    res.json({ message: "Net funds updated successfully!", new_net_funds: newNetFunds });

  } catch (error) {
    console.error("Error updating net funds:", error);
    res.status(500).json({ error: "Failed to update net funds" });
  }
});

// ✅ Add Expense (With Net Fund Check)
app.post("/add-expense", async (req, res) => {
  const { date, description, amount } = req.body;

  // Ensure the date is in YYYY-MM-DD format
  const formattedDate = moment(date, "YYYY-MM-DD").format("YYYY-MM-DD");
  const day = moment(date, "YYYY-MM-DD").format("dddd");

  try {
    const conn = db.promise();

    // Check current net funds
    const [funds] = await conn.query("SELECT net_funds FROM net_funds ORDER BY id DESC LIMIT 1");
    let currentFunds = parseFloat(funds[0]?.net_funds || 0);

    if (currentFunds - amount < 0) {
      return res.status(400).json({ error: "Insufficient funds! Net funds cannot go below zero." });
    }

    // Add the expense
    await conn.query("INSERT INTO expenses (date, day, description, amount) VALUES (?, ?, ?, ?)", 
      [formattedDate, day, description, amount]
    );

    // Deduct the amount from net funds
    await conn.query("UPDATE net_funds SET net_funds = net_funds - ? ORDER BY id DESC LIMIT 1", [amount]);

    res.json({ message: "Expense added successfully!" });

  } catch (error) {
    console.error("Error adding expense:", error);
    res.status(500).json({ error: "Failed to add expense" });
  }
});

// ✅ Edit Expense
app.put("/edit-expense/:id", async (req, res) => {
  const { id } = req.params;
  let { date, description, amount } = req.body;

  try {
      const conn = db.promise();
      await conn.beginTransaction();

      // Get the existing expense amount
      const [oldExpense] = await conn.query("SELECT amount FROM expenses WHERE id = ?", [id]);
      if (oldExpense.length === 0) {
          await conn.rollback();
          return res.status(404).json({ error: "Expense not found" });
      }

      const oldAmount = parseFloat(oldExpense[0].amount);
      amount = parseFloat(amount);

      // Format Date Properly
      const formattedDate = moment(date, "YYYY-MM-DD").format("YYYY-MM-DD");
      const day = moment(date, "YYYY-MM-DD").format("dddd");

      // Update the expense
      await conn.query(
          "UPDATE expenses SET date = ?, day = ?, description = ?, amount = ? WHERE id = ?",
          [formattedDate, day, description, amount, id]
      );

      // Adjust net funds (only apply the difference)
      const amountDifference = amount - oldAmount;
      await conn.query("UPDATE net_funds SET net_funds = net_funds - ? ORDER BY id DESC LIMIT 1", [amountDifference]);

      await conn.commit();
      res.json({ success: true, message: "Expense updated successfully" });

  } catch (error) {
      console.error("Error updating expense:", error);
      await db.promise().rollback();
      res.status(500).json({ error: "Failed to update expense" });
  }
});

// ✅ Delete Expense
app.delete("/delete-expense/:id", (req, res) => {
  const { id } = req.params;

  db.query("SELECT amount FROM expenses WHERE id = ?", [id], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ error: "Expense not found" });

    const amount = results[0].amount;

    db.query("DELETE FROM expenses WHERE id = ?", [id], (err) => {
      if (err) return res.status(500).json({ error: "Failed to delete expense" });

      db.query("UPDATE net_funds SET net_funds = net_funds + ? ORDER BY id DESC LIMIT 1", [amount], (err) => {
        if (err) console.error("Error updating net funds:", err);
      });

      res.json({ message: "Expense deleted successfully!" });
    });
  });
});

// ✅ Fetch Expenses (Formatted Date)
app.get("/expenses", (req, res) => {
  db.query("SELECT * FROM expenses ORDER BY date DESC", (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch expenses" });

    results.forEach((expense) => (expense.date = formatDate(expense.date)));
    res.json(results);
  });
});

// ✅ Filter Expenses
app.get("/filter-expenses", (req, res) => {
  let { monthYear, minAmount } = req.query;
  let query = "SELECT * FROM expenses WHERE 1=1";
  let params = [];

  if (monthYear) {
    const [year, month] = monthYear.split("-");
    query += " AND MONTH(date) = ? AND YEAR(date) = ?";
    params.push(month, year);
  }

  if (minAmount) {
    query += " AND amount >= ?";
    params.push(minAmount);
  }

  query += " ORDER BY date DESC";

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to filter expenses" });

    results.forEach((expense) => (expense.date = formatDate(expense.date)));
    res.json(results);
  });
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});