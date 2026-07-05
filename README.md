<div align="center">

# 📦 Practice Box [ PB ]

### **A Premium, High-Fidelity 3D Glassmorphic Varsity Practice & Assessment Ecosystem**

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white"/>
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white"/>
  <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black"/>
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white"/>
  <img src="https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/UI-3D%20Glassmorphism-purple?style=flat-square"/>
  <img src="https://img.shields.io/badge/Theme-Light%20%2F%20Dark-blue?style=flat-square"/>
  <img src="https://img.shields.io/badge/Status-Active-success?style=flat-square"/>
  <img src="https://img.shields.io/badge/License-MIT-red?style=flat-square"/>
</p>

---

### 🚀 Smart Learning • Interactive Practice • Modern Experience

</div>

---

# 🏛 Executive Overview

**Practice Box [ PB ]** is a modern university practice platform designed to simplify academic preparation through an interactive learning experience.

Instead of traditional text-heavy study methods, **PB** provides an engaging environment where students can practice **MCQs** and **Short Questions** from multiple departments and semesters in one place.

Each subject is intelligently organized into:

- ✅ **70 MCQs**
- ✅ **30 Short Questions**

**Total:** **100 Practice Questions per Subject**

---

# ✨ Core Features

## 🎯 Dynamic Learning System

### 🟢 MCQ Mode (70 Questions)

- Instant answer checking
- Green / Red feedback
- Explanation after submission
- Responsive 3D buttons
- Fast navigation

---

### ✍ Short Question Mode (30 Questions)

- Beautiful Glassmorphic Textarea
- Active Recall Practice
- Reveal Answer Animation
- Smooth User Experience

---

## 🎨 Modern UI

- 🌞 Light Theme
- 🌙 Dark Theme
- 3D Glassmorphism Design
- Neon Accent Colors
- Responsive Layout
- Mobile Friendly

---

## ⚡ High Performance

- PostgreSQL Database
- Supabase Backend
- Indexed Queries
- Extremely Fast Retrieval
- Optimized Relational Structure

---

# 🛠 Tech Stack

| Technology | Description |
|------------|-------------|
| HTML5 | Semantic Structure |
| CSS3 | Modern Styling |
| JavaScript ES6+ | Application Logic |
| Supabase | Backend Service |
| PostgreSQL | Relational Database |
| Google Fonts | Typography |
| Font Awesome | Icons |

---

# 💾 Database Schema

## Departments

```sql
CREATE TABLE departments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Questions

```sql
CREATE TABLE questions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dept_id BIGINT REFERENCES departments(id) ON DELETE CASCADE,
    type TEXT CHECK(type IN ('MCQ','SHORT')) NOT NULL,
    question_text TEXT NOT NULL,
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## MCQ Options

```sql
CREATE TABLE mcq_options (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    question_id BIGINT REFERENCES questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE NOT NULL
);
```

---

## Database Indexes

```sql
CREATE INDEX idx_questions_dept_type
ON questions(dept_id,type);

CREATE INDEX idx_mcq_options_question_id
ON mcq_options(question_id);
```

---

# 🚀 Installation

## 1️⃣ Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/practice-box.git

cd practice-box
```

---

## 2️⃣ Configure Supabase

Open **app.js**

```javascript
const SUPABASE_URL = "https://your-project.supabase.co";

const SUPABASE_ANON_KEY = "YOUR_SUPABASE_KEY";
```

---

## 3️⃣ Create Database

- Open Supabase Dashboard
- Go to SQL Editor
- Paste the SQL Schema
- Click **Run**
- Import your Questions (.csv / JSON)

---

## 4️⃣ Run Project

Simply open

```
index.html
```

inside

- Google Chrome
- Microsoft Edge
- Firefox

or

Use **Live Server** in VS Code.

---

# 📊 Project Roadmap

| Status | Feature |
|---------|----------|
| ✅ | Glassmorphism UI |
| ✅ | Light/Dark Theme |
| ✅ | Responsive Layout |
| ✅ | 100 Questions Session |
| ✅ | Supabase Integration |
| ⏳ | AI Question Import |
| ⏳ | Student Analytics |
| ⏳ | Performance Dashboard |
| ⏳ | Admin Panel |

---

# 📁 Project Structure

```
Practice-Box/
│
├── index.html
├── style.css
├── app.js
├── assets/
│
├── README.md
│
└── database/
      schema.sql
```

---

# ❤️ Developed By

<div align="center">

## Nahid Mahmud

**Computer Science & Engineering**

**Varendra University**

</div>

---

# 📜 License

This project is licensed under the **MIT License**.

---

<div align="center">

## ⭐ If you like this project,

### Give it a ⭐ on GitHub!

Made with ❤️ by **Nahid Mahmud**

</div>
