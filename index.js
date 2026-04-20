const STORAGE_KEYS = {
    users: "taskflow_users",
    session: "taskflow_session",
    data: "taskflow_data",
};

const state = {
    currentTab: "dashboard",
    formPriority: "low",
    formTags: [],
};

const store = {
    read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    },
    write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },
};

const authService = {
    getUsers() {
        return store.read(STORAGE_KEYS.users, []);
    },
    saveUsers(users) {
        store.write(STORAGE_KEYS.users, users);
    },
    register(username, password) {
        const users = this.getUsers();
        const cleanUsername = username.trim();

        if (cleanUsername.length < 3) {
            return {
                ok: false,
                message: "Uživatelské jméno musí mít alespoň 3 znaky.",
            };
        }
        if (password.length < 4) {
            return { ok: false, message: "Heslo musí mít alespoň 4 znaky." };
        }
        if (
            users.some(
                (user) =>
                    user.username.toLowerCase() === cleanUsername.toLowerCase(),
            )
        ) {
            return { ok: false, message: "Tento uživatel už existuje." };
        }

        const newUser = {
            id: crypto.randomUUID(),
            username: cleanUsername,
            password,
        };

        users.push(newUser);
        this.saveUsers(users);

        const allData = dataService.getAllData();
        allData[newUser.id] = { tasks: [], notes: "" };
        dataService.saveAllData(allData);

        return { ok: true, message: "Účet byl vytvořen." };
    },
    login(username, password) {
        const users = this.getUsers();
        const found = users.find(
            (user) =>
                user.username === username.trim() && user.password === password,
        );

        if (!found) {
            return { ok: false, message: "Neplatné přihlašovací údaje." };
        }

        store.write(STORAGE_KEYS.session, { userId: found.id });
        return { ok: true, user: found };
    },
    logout() {
        localStorage.removeItem(STORAGE_KEYS.session);
    },
    getCurrentUser() {
        const session = store.read(STORAGE_KEYS.session, null);
        if (!session?.userId) return null;
        return (
            this.getUsers().find((user) => user.id === session.userId) || null
        );
    },
};

const dataService = {
    getAllData() {
        return store.read(STORAGE_KEYS.data, {});
    },
    saveAllData(data) {
        store.write(STORAGE_KEYS.data, data);
    },
    getUserData(userId) {
        const allData = this.getAllData();
        return allData[userId] || { tasks: [], notes: "" };
    },
    saveUserData(userId, userData) {
        const allData = this.getAllData();
        allData[userId] = userData;
        this.saveAllData(allData);
    },
};

const taskService = {
    list(userId) {
        return dataService.getUserData(userId).tasks;
    },
    save(userId, tasks) {
        const userData = dataService.getUserData(userId);
        userData.tasks = tasks;
        dataService.saveUserData(userId, userData);
    },
    upsert(userId, task) {
        const tasks = this.list(userId);
        const index = tasks.findIndex((item) => item.id === task.id);

        if (index >= 0) tasks[index] = task;
        else tasks.unshift(task);

        this.save(userId, tasks);
    },
    remove(userId, taskId) {
        const filtered = this.list(userId).filter((task) => task.id !== taskId);
        this.save(userId, filtered);
    },
    toggle(userId, taskId) {
        const tasks = this.list(userId).map((task) =>
            task.id === taskId ? { ...task, done: !task.done } : task,
        );
        this.save(userId, tasks);
    },
};

const els = {
    authPage: document.getElementById("authPage"),
    appPage: document.getElementById("appPage"),
    userBox: document.getElementById("userBox"),
    userBadge: document.getElementById("userBadge"),
    logoutBtn: document.getElementById("logoutBtn"),
    registerBtn: document.getElementById("registerBtn"),
    loginBtn: document.getElementById("loginBtn"),
    registerUsername: document.getElementById("registerUsername"),
    registerPassword: document.getElementById("registerPassword"),
    loginUsername: document.getElementById("loginUsername"),
    loginPassword: document.getElementById("loginPassword"),
    registerMessage: document.getElementById("registerMessage"),
    loginMessage: document.getElementById("loginMessage"),
    taskMessage: document.getElementById("taskMessage"),
    taskTitle: document.getElementById("taskTitle"),
    taskDueDate: document.getElementById("taskDueDate"),
    tagInput: document.getElementById("tagInput"),
    tagTextInput: document.getElementById("tagTextInput"),
    saveTaskBtn: document.getElementById("saveTaskBtn"),
    formTitle: document.getElementById("formTitle"),
    dashboardList: document.getElementById("dashboardList"),
    stats: document.getElementById("stats"),
    priorityButtons: [...document.querySelectorAll(".priority-option")],
    panels: {
        dashboard: document.getElementById("dashboardTab"),
    },
};

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showMessage(target, type, text) {
    if (!text) {
        target.innerHTML = "";
        return;
    }
    target.innerHTML = `<div class="message ${type}">${escapeHtml(text)}</div>`;
}

function currentUser() {
    return authService.getCurrentUser();
}

function getDateSpan(value) {
    if (!value) return "";
    return `<span class="meta">Termín: ${formatDate(value)}</span>`;
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("cs-CZ").format(date);
}

function renderStats() {
    const user = currentUser();
    if (!user) return;
    const tasks = taskService.list(user.id);
    const open = tasks.filter((task) => !task.done).length;
    const done = tasks.filter((task) => task.done).length;
    const high = tasks.filter(
        (task) => task.priority === "high" && !task.done,
    ).length;

    els.stats.innerHTML = `
        <div class="stat">
          <div class="muted">Celkem úkolů</div>
          <div class="value">${tasks.length}</div>
        </div>
        <div class="stat">
          <div class="muted">Otevřené</div>
          <div class="value">${open}</div>
        </div>
        <div class="stat">
          <div class="muted">Hotové</div>
          <div class="value">${done}</div>
        </div>
        <div class="stat">
          <div class="muted">Vysoká priorita</div>
          <div class="value">${high}</div>
        </div>
      `;
}

function taskCardTemplate(task) {
    const tags = task.tags
        .map((tag) => `<span class="meta">#${escapeHtml(tag)}</span>`)
        .join("");

    return `
        <article class="task-card priority-${task.priority} ${task.done ? "done" : ""}">
          <div class="task-top">
            <div>
              <h4>${escapeHtml(task.title)}</h4>
              <div class="meta-row">
                <span class="meta">Priorita: ${task.priority}</span>
                ${getDateSpan(task.dueDate)}
                <span class="meta">Stav: ${task.done ? "hotovo" : "otevřeno"}</span>
              </div>
            </div>
            <div class="task-actions">
              <button class="btn-secondary" onclick="toggleTask('${task.id}')">${task.done ? "Vrátit" : "Hotovo"}</button>
              <button class="btn-danger" onclick="deleteTask('${task.id}')">Smazat</button>
            </div>
          </div>
          ${task.tags.length ? `<div class="tag-list">${tags}</div>` : ""}
        </article>
      `;
}

function renderTaskLists() {
    const user = currentUser();
    if (!user) return;

    const allTasks = taskService.list(user.id);
    const latest = [...allTasks]
        .sort((a, b) =>
            new Date(a.createdAt) < new Date(b.createdAt) ? 1 : -1,
        )
        .slice(0, 3);

    els.dashboardList.innerHTML = latest.length
        ? latest.map(taskCardTemplate).join("")
        : '<div class="empty">Zatím nemáš žádné úkoly. Přidej první v levém formuláři.</div>';
}

function renderTagInput() {
    const tagHtml = state.formTags
        .map(
            (tag) =>
                `<span class="tag">${escapeHtml(tag)}<button type="button" onclick="removeTag('${encodeURIComponent(tag)}')">×</button></span>`,
        )
        .join("");

    els.tagInput.innerHTML = `${tagHtml}<input id="tagTextInput" type="text" placeholder="napiš štítek a dej Enter" />`;
    els.tagTextInput = document.getElementById("tagTextInput");
    bindTagInput();
}

function setPriority(priority) {
    state.formPriority = priority;
    els.priorityButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.priority === priority);
    });
}

function resetForm() {
    state.formTags = [];
    setPriority("low");
    els.taskTitle.value = "";
    els.taskDueDate.value = "";
    els.formTitle.textContent = "Nový úkol";
    renderTagInput();
    showMessage(els.taskMessage, "", "");
}

function collectTaskForm() {
    return {
        title: els.taskTitle.value.trim(),
        dueDate: els.taskDueDate.value,
        priority: state.formPriority,
        tags: [
            ...new Set(state.formTags.map((tag) => tag.trim()).filter(Boolean)),
        ],
    };
}

function saveTask() {
    const user = currentUser();
    if (!user) return;

    const form = collectTaskForm();
    if (form.title.length < 3) {
        showMessage(
            els.taskMessage,
            "error",
            "Název úkolu musí mít alespoň 3 znaky.",
        );
        return;
    }

    const task = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        done: false,
        ...form,
    };

    taskService.upsert(user.id, task);
    resetForm();
    renderApp();
    showMessage(els.taskMessage, "success", "Úkol byl uložen.");
}

function deleteTask(taskId) {
    const user = currentUser();
    if (!user) return;
    taskService.remove(user.id, taskId);
    if (state.editingTaskId === taskId) resetForm();
    renderApp();
}

function toggleTask(taskId) {
    const user = currentUser();
    if (!user) return;
    taskService.toggle(user.id, taskId);
    renderApp();
}

function removeTag(encodedTag) {
    const tag = decodeURIComponent(encodedTag);
    state.formTags = state.formTags.filter((item) => item !== tag);
    renderTagInput();
}

function bindTagInput() {
    els.tagTextInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== ",") return;
        event.preventDefault();
        const value = els.tagTextInput.value.trim().replace(",", "");
        if (!value) return;
        if (!state.formTags.includes(value)) state.formTags.push(value);
        renderTagInput();
    });
}

function renderApp() {
    const user = currentUser();
    const isLoggedIn = Boolean(user);

    els.authPage.classList.toggle("hidden", isLoggedIn);
    els.appPage.classList.toggle("hidden", !isLoggedIn);
    els.userBox.classList.toggle("hidden", !isLoggedIn);

    if (!isLoggedIn) return;

    els.userBadge.textContent = `Přihlášen: ${user.username}`;
    renderStats();
    renderTaskLists();
}

function handleRegister() {
    const result = authService.register(
        els.registerUsername.value,
        els.registerPassword.value,
    );
    showMessage(
        els.registerMessage,
        result.ok ? "success" : "error",
        result.message,
    );
    if (result.ok) {
        els.loginUsername.value = els.registerUsername.value.trim();
        els.loginPassword.value = els.registerPassword.value;
        els.registerUsername.value = "";
        els.registerPassword.value = "";
    }
}

function handleLogin() {
    const result = authService.login(
        els.loginUsername.value,
        els.loginPassword.value,
    );
    if (!result.ok) {
        showMessage(els.loginMessage, "error", result.message);
        return;
    }

    showMessage(els.loginMessage, "success", "Přihlášení proběhlo úspěšně.");
    resetForm();
    renderApp();
}

function handleLogout() {
    authService.logout();
    showMessage(els.loginMessage, "", "");
    state.currentTab = "dashboard";
    resetForm();
    renderApp();
}

function initEvents() {
    els.registerBtn.addEventListener("click", handleRegister);
    els.loginBtn.addEventListener("click", handleLogin);
    els.logoutBtn.addEventListener("click", handleLogout);
    els.saveTaskBtn.addEventListener("click", saveTask);

    els.priorityButtons.forEach((button) => {
        button.addEventListener("click", () =>
            setPriority(button.dataset.priority),
        );
    });

    window.deleteTask = deleteTask;
    window.toggleTask = toggleTask;
    window.removeTag = removeTag;
}

function init() {
    initEvents();
    resetForm();
    renderApp();
}

init();
