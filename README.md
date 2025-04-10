# 🧠 AI Debate Arena

**AI Debate Arena** is an interactive platform where two powerful AI agents — **Gemini** and **Groq** — engage in a structured debate on a user-provided topic. Users can define the **debate duration**, and both AI agents take turns presenting arguments. Each response is **automatically scored** based on relevance, factual accuracy, use of real-world examples, and logical structure.

---

## 🚀 Demo

![Screenshot 2025-04-08 190857](https://github.com/user-attachments/assets/d7de4c8b-b642-4c7a-a086-9a802f046fa7)
![Screenshot 2025-04-08 190947](https://github.com/user-attachments/assets/4315bda8-1b5d-48fd-bead-48a889b5ffe9)



---

## ✨ Features

- 🗣️ Two AI agents debating in real-time (Gemini vs Groq)
- 🧠 User-defined topics and durations
- ⚖️ Scoring system based on:
  - Factual accuracy
  - Real-world examples
  - Logical consistency
  - Topic relevance
- 📊 Final scoreboard to show the winner
- 🖥️ Clean and responsive UI

---

## 🛠️ Tech Stack

| Layer       | Tech Used |
|-------------|-----------|
| **Frontend**  | React + TypeScript + TailwindCSS |
| **AI APIs**   | Gemini API (Google) + Groq API |


## 🧠 Scoring System

Each message from Gemini or Groq is scored out of 50 points based on:

| Criterion             | Max Score | Evaluates... |
|-----------------------|-----------|--------------|
| Clarity of Argument   | 10        | Structured flow using transition words |
| Depth of Reasoning    | 10        | Use of nuanced concepts and philosophy |
| Evidence & Examples   | 10        | References to studies, facts, or illustrative examples |
| Relevance & Realism   | 10        | Topic alignment based on keyword match |
| Persuasiveness        | 10        | Rebuttals and counterpoints to opponent's previous argument |

Each criterion uses keyword-based pattern matching to simulate a real-world judgment system. The final winner is determined by the **total cumulative points** scored during the debate.


---

## 📌 Use Cases

- 🎓 **Education**: Train critical thinking by analyzing both sides of a topic.
- 🧪 **AI Benchmarking**: Compare different LLMs based on reasoning and fact-based responses.
- 🧑‍🏫 **Debate Practice Tool**: Enhance your skills by observing how AI forms arguments.
- 🗳️ **Policy Simulation**: Explore pros and cons of real-world issues using AI logic.

---

## 📦 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/Roshankumr/AI-Debate-Arena.git
cd AI-Debate-Arena
npm i
npm run dev
