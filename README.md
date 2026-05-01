# Wampus_Ajent
# 🧠 Dynamic Wumpus Logic Agent (React + TypeScript)

## 📌 Overview

This project implements a **Knowledge-Based AI Agent** for the classic *Wumpus World* problem using a **web-based interface**.

The agent navigates a dynamic grid environment and uses **Propositional Logic + Resolution Refutation** to infer safe cells before moving.

---

## 🎯 Features

### 🌐 Environment

* Dynamic grid size (configurable in code)
* Random placement of:

  * 🕳️ Pits
  * 👾 Wumpus
* Agent starts at (0,0)

---

### 🧠 AI Logic (Core Requirement)

* Knowledge Base (KB) using propositional logic
* **TELL**: Adds percept-based rules to KB
* **ASK**: Uses Resolution Refutation to verify safety
* Logical inference:

  * Breeze ⇒ Nearby Pit
  * Stench ⇒ Nearby Wumpus

---

### ⚙️ Resolution Algorithm

* Clause-based representation (CNF-like)
* Negation + resolution rule
* Proof by contradiction
* Determines:

  ```
  ¬Pit(x,y) ∧ ¬Wumpus(x,y)
  ```

---

### 🎮 UI Features

* Grid visualization
* Color coding:

  * 🟩 Safe cells
  * ⬜ Unknown cells
  * 🟦 Agent position
* Real-time:

  * Inference step counter
  * Current percepts

---

## 🛠️ Tech Stack

* React (TypeScript)
* Vite
* CSS Grid (for visualization)

---

## 🚀 How to Run

```bash
npm create vite@latest wumpus-agent
cd wumpus-agent
npm install
npm run dev
```

Then replace:

```
src/App.tsx
```

with the provided code.

---

## 📊 Project Structure

```
wumpus-agent/
│
├── src/
│   ├── App.tsx        # Main logic + UI
│   ├── main.tsx
│
├── index.html
├── package.json
```

---

## 🧪 Example Logic Flow

1. Agent enters a cell
2. Receives percepts:

   * Breeze / Stench / None
3. Updates KB (TELL)
4. Queries adjacent cells (ASK)
5. Uses Resolution to prove safety
6. Moves to safe cell

---

## ⚠️ Limitations

* Simplified CNF representation (manual clauses)
* No full symbolic parser
* No path optimization (basic movement strategy)

---

## 📈 Future Improvements

* Full CNF conversion engine
* Visual KB debugging panel
* Smarter pathfinding (A* + logic hybrid)
* Adjustable grid size UI

---

## 👨‍💻 Author

**Muhammad Burhan Raza**

---

## 📜 License

This project is for academic purposes.
