/* ============================================================================
   THE DIGITAL BACKPACK — APP ENGINE
   Team KUET_WARLORDS · Forkathon 2026
   Vanilla JS · everything persists in localStorage · starts completely clean.
   ========================================================================== */
(function () {
    "use strict";

    /* ------------------------------ STORAGE ------------------------------ */
    const KEY = {
        items: "db_items",
        searches: "db_searches",
        stats: "db_stats",
        badges: "db_badges",
        theme: "db_theme",
        page: "db_page",
    };

    const RANKS = ["Lab Muggle", "Cadet Scholar", "Assignment Knight", "CT Conqueror", "Semester Sentinel", "KUET Warlord"];
    const XP_PER_LEVEL = 100;

    const ACHIEVEMENTS = [
        { id: "first",   icon: "🎒", name: "First Drop",   desc: "Add your first item",        test: (s) => s.itemsAdded >= 1 },
        { id: "ten",     icon: "📦", name: "Loaded Up",    desc: "Add 10 items",               test: (s) => s.itemsAdded >= 10 },
        { id: "clear1",  icon: "✅", name: "Getting Done", desc: "Complete a task",            test: (s) => s.cleared >= 1 },
        { id: "clear10", icon: "🧹", name: "Clean Sweep",  desc: "Complete 10 tasks",          test: (s) => s.cleared >= 10 },
        { id: "focus1",  icon: "⏱️", name: "Focused",      desc: "Finish a focus sprint",      test: (s) => s.sprints >= 1 },
        { id: "focus5",  icon: "🧠", name: "Deep Worker",  desc: "Finish 5 focus sprints",     test: (s) => s.sprints >= 5 },
        { id: "zero",    icon: "✨", name: "Empty Bag",    desc: "Clear everything to 0%",     test: (s) => s.reachedZero },
        { id: "streak",  icon: "🔥", name: "On Fire",      desc: "Reach a 3-day streak",       test: (s) => s.streak >= 3 },
        { id: "level5",  icon: "⚡", name: "Rising Star",  desc: "Reach level 5",              test: (s) => s.level >= 5 },
        { id: "warlord", icon: "👑", name: "KUET Warlord", desc: "Reach the top rank",         test: (s) => s.level >= 10 },
    ];

    const SEARCH_PLACEHOLDERS = [
        "Search your backpack…",
        "Search 'CT'…",
        "Search 'assignment'…",
        "Search 'drive link'…",
        "Search a file name…",
    ];

    const TYPE_ICON = { Task: "✅", File: "📄", Link: "🔗", Note: "📝" };

    /* ------------------------------ STATE -------------------------------- */
    let items = load(KEY.items, []);
    let searches = load(KEY.searches, []);
    let stats = load(KEY.stats, {
        xp: 0, level: 1, rank: RANKS[0],
        itemsAdded: 0, cleared: 0, sprints: 0,
        streak: 1, reachedZero: false, lastVisit: null,
    });
    let unlockedBadges = load(KEY.badges, []);

    let currentPage = localStorage.getItem(KEY.page) || "dashboard";
    let typeFilter = "all";
    let courseFilter = "all";
    let searchQuery = "";
    let editingId = null;
    let panicMode = false;

    // Pomodoro
    let pomoTotal = 25 * 60, pomoLeft = 25 * 60, pomoInterval = null, pomoRunning = false, pomoTaskId = null;
    let sprintsToday = 0;
    let phIndex = 0;

    /* ------------------------------ HELPERS ------------------------------ */
    const $ = (id) => document.getElementById(id);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    function load(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(fallback));
        } catch (e) {
            console.log("[v0] load failed:", key, e.message);
            return JSON.parse(JSON.stringify(fallback));
        }
    }
    function save() {
        localStorage.setItem(KEY.items, JSON.stringify(items));
        localStorage.setItem(KEY.stats, JSON.stringify(stats));
        localStorage.setItem(KEY.badges, JSON.stringify(unlockedBadges));
    }
    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function isURL(s) { return /^https?:\/\//i.test(String(s).trim()); }
    function domainOf(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; } }

    function prettify(name) {
        if (isURL(name)) {
            const d = domainOf(name);
            return d ? d.charAt(0).toUpperCase() + d.slice(1) + " link" : "Web link";
        }
        return String(name)
            .replace(/\.[a-z0-9]{2,5}$/i, "")
            .replace(/[_\-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\b\w/g, (c) => c.toUpperCase()) || name;
    }

    function detectTags(text) {
        const t = (text || "").toLowerCase();
        const tags = [];
        if (/\bct\b|class test/.test(t)) tags.push("#CT");
        if (/lab|report/.test(t)) tags.push("#Lab");
        if (/slide|ppt|presentation/.test(t)) tags.push("#Slides");
        if (/assignment|hw|homework/.test(t)) tags.push("#Assignment");
        if (/exam|final|midterm|quiz/.test(t)) tags.push("#Exam");
        if (/note/.test(t)) tags.push("#Notes");
        return [...new Set(tags)];
    }

    function autoPriority(item) {
        if (!item.deadline) return item.type === "Task" ? "Medium" : "Low";
        const hrs = (new Date(item.deadline) - new Date()) / 36e5;
        if (hrs <= 24) return "High";
        if (hrs <= 72) return "Medium";
        return "Low";
    }
    function resolvedPriority(item) {
        return (!item.priority || item.priority === "Auto") ? autoPriority(item) : item.priority;
    }
    function hoursLeft(item) {
        if (!item.deadline) return Infinity;
        return (new Date(item.deadline) - new Date()) / 36e5;
    }
    function fmtDeadline(iso) {
        const d = new Date(iso);
        const hrs = (d - new Date()) / 36e5;
        const opts = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
        if (hrs < 0) return "Overdue · " + d.toLocaleString(undefined, opts);
        if (hrs < 24) return "Due in " + Math.max(1, Math.round(hrs)) + "h";
        return "Due " + d.toLocaleString(undefined, opts);
    }

    /* ------------------------------ ROUTER ------------------------------- */
    function switchPage(page) {
        if (!page) return;
        currentPage = page;
        qsa(".page").forEach((p) => {
            const on = p.id === page;
            p.hidden = !on;
            p.classList.toggle("active", on);
        });
        qsa(".nav-tab").forEach((t) => t.classList.toggle("active", t.dataset.page === page));
        localStorage.setItem(KEY.page, page);
        $("nav-tabs-close")?.();
        document.querySelector(".nav-tabs")?.classList.remove("open");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    /* ------------------------------ TOASTS ------------------------------- */
    function toast(msg, type = "info", ms = 2600) {
        const host = $("toast-host");
        if (!host) return;
        const el = document.createElement("div");
        el.className = "toast " + type;
        el.textContent = msg;
        host.appendChild(el);
        setTimeout(() => {
            el.style.opacity = "0";
            el.style.transform = "translateX(20px)";
            setTimeout(() => el.remove(), 300);
        }, ms);
    }

    function confetti() {
        const host = $("confetti");
        if (!host) return;
        const colors = ["#2dd4bf", "#c084fc", "#fbbf24", "#34d399", "#fb7185"];
        for (let i = 0; i < 40; i++) {
            const s = document.createElement("span");
            s.style.left = Math.random() * 100 + "vw";
            s.style.background = colors[i % colors.length];
            s.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
            s.style.animationDelay = Math.random() * 0.3 + "s";
            host.appendChild(s);
            setTimeout(() => s.remove(), 3200);
        }
    }

    /* ------------------------------ ITEM CRUD ---------------------------- */
    function makeItem(data) {
        const name = data.name.trim();
        const type = data.type || (isURL(name) ? "Link" : "File");
        return {
            id: "i_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
            name,
            context: (data.context || "").trim() || prettify(name),
            type,
            course: (data.course || "").trim(),
            deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
            priority: data.priority || "Auto",
            tags: detectTags(name + " " + (data.context || "")),
            completed: false,
            createdAt: new Date().toISOString(),
        };
    }

    function addItem(data) {
        const item = makeItem(data);
        items.unshift(item);
        stats.itemsAdded++;
        addXP(15);
        save();
        renderAll();
        toast('Added "' + item.context + '"', "success");
    }

    function updateItem(id, data) {
        const item = items.find((i) => i.id === id);
        if (!item) return;
        item.name = data.name.trim();
        item.context = (data.context || "").trim() || prettify(item.name);
        item.type = data.type;
        item.course = (data.course || "").trim();
        item.deadline = data.deadline ? new Date(data.deadline).toISOString() : null;
        item.priority = data.priority;
        item.tags = detectTags(item.name + " " + item.context);
        save();
        renderAll();
        toast("Item updated", "success");
    }

    function deleteItem(id) {
        const idx = items.findIndex((i) => i.id === id);
        if (idx === -1) return;
        if (pomoTaskId === id) { pomoTaskId = null; $("pomo-task").textContent = "nothing selected"; }
        items.splice(idx, 1);
        save();
        renderAll();
        toast("Item removed", "warn");
    }

    function toggleComplete(id) {
        const item = items.find((i) => i.id === id);
        if (!item) return;
        item.completed = !item.completed;
        if (item.completed) {
            stats.cleared++;
            addXP(20);
            confetti();
            toast('Cleared "' + item.context + '"', "success");
        }
        const open = items.filter((i) => !i.completed).length;
        if (items.length > 0 && open === 0) stats.reachedZero = true;
        save();
        renderAll();
    }

    /* ------------------------------ GAMIFICATION ------------------------- */
    function addXP(amount) {
        stats.xp += amount;
        while (stats.xp >= XP_PER_LEVEL) {
            stats.xp -= XP_PER_LEVEL;
            stats.level++;
            stats.rank = RANKS[Math.min(Math.floor((stats.level - 1) / 2), RANKS.length - 1)];
            toast("⬆️ Level up! Now level " + stats.level + " — " + stats.rank, "success", 3200);
            confetti();
        }
        checkBadges();
        renderAchievements();
        save();
    }

    function checkBadges() {
        const ctx = { ...stats, streak: stats.streak };
        ACHIEVEMENTS.forEach((a) => {
            if (!unlockedBadges.includes(a.id) && a.test(ctx)) {
                unlockedBadges.push(a.id);
                toast("🏆 Badge unlocked: " + a.name, "success", 3200);
            }
        });
    }

    function dailyStreak() {
        const today = new Date().toDateString();
        if (stats.lastVisit === today) return;
        if (stats.lastVisit) {
            const diff = (new Date(today) - new Date(stats.lastVisit)) / 864e5;
            if (diff === 1) stats.streak++;
            else if (diff > 1) stats.streak = 1;
        }
        stats.lastVisit = today;
        save();
    }

    /* ------------------------------ RENDERING ---------------------------- */
    function renderAll() {
        renderDashboard();
        renderLibrary();
        renderCourseFilters();
        renderCourseDatalist();
        renderAchievements();
    }

    function renderDashboard() {
        const open = items.filter((i) => !i.completed);
        const done = items.filter((i) => i.completed);
        const total = items.length;

        // clutter gauge — scales open items up to a comfortable cap of 12
        const pct = total === 0 ? 0 : Math.min(100, Math.round((open.length / 12) * 100));
        $("clutter-pct").textContent = pct + "%";
        $("gauge-fill").style.width = pct + "%";
        $("stat-open").textContent = open.length;
        $("stat-done").textContent = done.length;
        $("stat-total").textContent = total;
        $("clutter-msg").textContent =
            total === 0 ? "Clean & clear — nothing pending." :
            pct < 34 ? "Light load. You're on top of it." :
            pct < 67 ? "Filling up — knock out a few today." :
            "Heavy backpack. Time to prioritize!";

        renderPanic();
        renderMatrix();
    }

    function renderPanic() {
        const host = $("panic-list");
        const urgent = items
            .filter((i) => !i.completed && hoursLeft(i) <= 12)
            .sort((a, b) => hoursLeft(a) - hoursLeft(b));
        if (!urgent.length) {
            host.innerHTML = '<p class="empty">No fires right now. Breathe.</p>';
            return;
        }
        host.innerHTML = urgent.map(panicRow).join("");
    }

    function panicRow(i) {
        return '<div class="panic-item">' +
            '<div class="mi-main"><div class="mi-title">' + esc(i.context) + '</div>' +
            '<div class="mi-meta">' + esc(fmtDeadline(i.deadline)) + '</div></div>' +
            '<button class="mi-play" data-focus="' + i.id + '">Focus</button></div>';
    }

    function renderMatrix() {
        const q = { q1: [], q2: [], q3: [], q4: [] };
        items.filter((i) => !i.completed).forEach((i) => {
            const p = resolvedPriority(i);
            const urgent = hoursLeft(i) <= 48;
            if (urgent && p === "High") q.q1.push(i);
            else if (p === "High" || p === "Medium") q.q2.push(i);
            else if (urgent) q.q3.push(i);
            else q.q4.push(i);
        });
        ["q1", "q2", "q3", "q4"].forEach((k) => {
            const host = $(k);
            host.innerHTML = q[k].length
                ? q[k].map(matrixRow).join("")
                : '<p class="empty">Empty</p>';
        });
    }

    function matrixRow(i) {
        const meta = i.deadline ? fmtDeadline(i.deadline) : (i.course || i.type);
        return '<div class="matrix-item">' +
            '<div class="mi-main"><div class="mi-title">' + esc(i.context) + '</div>' +
            '<div class="mi-meta">' + esc(meta) + '</div></div>' +
            '<button class="mi-play" data-focus="' + i.id + '">▶</button></div>';
    }

    function renderCourseFilters() {
        const host = $("course-filters");
        const courses = [...new Set(items.map((i) => i.course).filter(Boolean))].sort();
        let html = '<button class="chip' + (courseFilter === "all" ? " active" : "") + '" data-course="all">All courses</button>';
        html += courses.map((c) =>
            '<button class="chip' + (courseFilter === c ? " active" : "") + '" data-course="' + esc(c) + '">' + esc(c) + '</button>'
        ).join("");
        host.innerHTML = html;
    }

    function renderCourseDatalist() {
        const dl = $("course-list");
        const courses = [...new Set(items.map((i) => i.course).filter(Boolean))].sort();
        dl.innerHTML = courses.map((c) => '<option value="' + esc(c) + '">').join("");
    }

    function renderLibrary() {
        const host = $("library");
        let list = items.slice();

        if (typeFilter !== "all") list = list.filter((i) => i.type === typeFilter);
        if (courseFilter !== "all") list = list.filter((i) => i.course === courseFilter);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter((i) =>
                (i.name + " " + i.context + " " + i.course + " " + i.tags.join(" ")).toLowerCase().includes(q)
            );
        }

        if (!items.length) {
            host.innerHTML =
                '<div class="empty-block"><div class="empty-emoji">🎒</div>' +
                '<h3>Your backpack is empty</h3><p>Hit <b>+ Add</b> to drop in your first file, link, note or task.</p></div>';
            return;
        }
        if (!list.length) {
            host.innerHTML =
                '<div class="empty-block"><div class="empty-emoji">🔍</div>' +
                '<h3>Nothing matches</h3><p>Try a different filter or search term.</p></div>';
            return;
        }

        // incomplete first, then by nearest deadline
        list.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return hoursLeft(a) - hoursLeft(b);
        });
        host.innerHTML = list.map(itemCard).join("");
    }

    function itemCard(i) {
        const icon = TYPE_ICON[i.type] || "📄";
        const tags = [];
        if (i.course) tags.push('<span class="tag course">' + esc(i.course) + '</span>');
        i.tags.forEach((t) => tags.push('<span class="tag">' + esc(t) + '</span>'));
        if (i.deadline) {
            const overdue = hoursLeft(i) < 0 ? " overdue" : "";
            tags.push('<span class="tag deadline' + overdue + '">' + esc(fmtDeadline(i.deadline)) + '</span>');
        }
        const openLink = isURL(i.name)
            ? '<a href="' + esc(i.name) + '" target="_blank" rel="noopener">Open</a>'
            : '';
        return '<article class="item-card' + (i.completed ? " done" : "") + '" data-id="' + i.id + '">' +
            '<div class="item-top"><span class="item-icon">' + icon + '</span>' +
            '<div class="item-heading"><div class="item-context">' + esc(i.context) + '</div>' +
            '<div class="item-name">' + esc(i.name) + '</div></div></div>' +
            (tags.length ? '<div class="item-tags">' + tags.join("") + '</div>' : '') +
            '<div class="item-actions">' +
            '<button class="act-done' + (i.completed ? " is-done" : "") + '" data-done="' + i.id + '">' + (i.completed ? "Done ✓" : "Complete") + '</button>' +
            '<button data-focusitem="' + i.id + '">Focus</button>' +
            openLink +
            '<button data-edit="' + i.id + '">Edit</button>' +
            '<button data-del="' + i.id + '">Delete</button>' +
            '</div></article>';
    }

    function renderAchievements() {
        $("rank-name").textContent = stats.rank;
        $("level-num").textContent = stats.level;
        $("xp-now").textContent = stats.xp;
        $("xp-max").textContent = XP_PER_LEVEL;
        $("xp-fill").style.width = (stats.xp / XP_PER_LEVEL) * 100 + "%";
        $("streak-days").textContent = stats.streak;
        $("total-sprints").textContent = stats.sprints;

        $("badges-grid").innerHTML = ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedBadges.includes(a.id);
            return '<div class="badge-card' + (unlocked ? "" : " locked") + '">' +
                '<div class="b-icon">' + a.icon + '</div>' +
                '<div class="b-name">' + esc(a.name) + '</div>' +
                '<div class="b-desc">' + esc(a.desc) + '</div></div>';
        }).join("");
    }

    /* ------------------------------ SEARCH HISTORY ----------------------- */
    function saveSearch(q) {
        q = (q || "").trim();
        if (q.length < 2) return;
        searches = [q, ...searches.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 8);
        localStorage.setItem(KEY.searches, JSON.stringify(searches));
        renderSearchHistory();
    }
    function renderSearchHistory() {
        const list = $("search-history-list");
        list.innerHTML = searches.length
            ? searches.map((s) => '<button type="button" class="history-chip" data-q="' + esc(s) + '">' + esc(s) + '</button>').join("")
            : '<span class="hint">No recent searches yet.</span>';
    }
    function showHistory() { renderSearchHistory(); $("search-history").hidden = false; }
    function hideHistory() { $("search-history").hidden = true; }

    /* ------------------------------ POMODORO ----------------------------- */
    function fmtTime(sec) {
        const m = String(Math.floor(sec / 60)).padStart(2, "0");
        const s = String(sec % 60).padStart(2, "0");
        return m + ":" + s;
    }
    function renderPomo() { $("pomo-display").textContent = fmtTime(pomoLeft); }
    function startPomo() {
        if (pomoRunning) return;
        pomoRunning = true;
        pomoInterval = setInterval(() => {
            pomoLeft--;
            renderPomo();
            if (pomoLeft <= 0) {
                clearInterval(pomoInterval);
                pomoRunning = false;
                sprintsToday++;
                stats.sprints++;
                $("pomo-count").textContent = sprintsToday;
                addXP(25);
                confetti();
                toast("⏱️ Sprint complete! +25 XP", "success", 3200);
                pomoLeft = pomoTotal;
                renderPomo();
            }
        }, 1000);
    }
    function pausePomo() { pomoRunning = false; clearInterval(pomoInterval); }
    function resetPomo() { pausePomo(); pomoLeft = pomoTotal; renderPomo(); }
    function setPomoTask(id) {
        const item = items.find((i) => i.id === id);
        if (!item) return;
        pomoTaskId = id;
        $("pomo-task").textContent = item.context;
        if (currentPage !== "dashboard") switchPage("dashboard");
        toast("Focus set to: " + item.context, "info");
    }

    /* ------------------------------ MODAL -------------------------------- */
    function openModal(id) {
        editingId = id || null;
        $("modal-title").textContent = id ? "Edit item" : "Add to backpack";
        const item = id ? items.find((i) => i.id === id) : null;
        $("f-name").value = item ? item.name : "";
        $("f-context").value = item ? item.context : "";
        $("f-type").value = item ? item.type : "Task";
        $("f-course").value = item ? item.course : "";
        $("f-priority").value = item ? item.priority : "Auto";
        $("f-deadline").value = item && item.deadline ? toLocalInput(item.deadline) : "";
        $("add-overlay").hidden = false;
        setTimeout(() => $("f-name").focus(), 50);
    }
    function closeModal() { $("add-overlay").hidden = true; editingId = null; $("add-form").reset(); }
    function toLocalInput(iso) {
        const d = new Date(iso);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    }

    /* ------------------------------ DATA I/O ----------------------------- */
    function exportJSON() {
        const payload = { items, stats, badges: unlockedBadges, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "digital-backpack-backup.json";
        a.click();
        URL.revokeObjectURL(a.href);
        toast("Backup exported", "success");
    }
    function importJSON(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                if (Array.isArray(data.items)) items = data.items;
                if (data.stats) stats = { ...stats, ...data.stats };
                if (Array.isArray(data.badges)) unlockedBadges = data.badges;
                save();
                renderAll();
                toast("Backup imported", "success");
            } catch (e) {
                toast("Invalid backup file", "danger");
            }
        };
        reader.readAsText(file);
    }
    function exportMarkdown() {
        if (!items.length) { toast("Nothing to export yet", "warn"); return; }
        let md = "# The Digital Backpack\n\n";
        const open = items.filter((i) => !i.completed);
        const done = items.filter((i) => i.completed);
        md += "## To do\n";
        md += open.length ? open.map((i) => "- [ ] " + i.context + (i.deadline ? " (" + fmtDeadline(i.deadline) + ")" : "")).join("\n") : "- (nothing)";
        md += "\n\n## Done\n";
        md += done.length ? done.map((i) => "- [x] " + i.context).join("\n") : "- (nothing)";
        navigator.clipboard?.writeText(md).then(
            () => toast("Markdown checklist copied", "success"),
            () => toast("Copy failed — clipboard blocked", "danger")
        );
    }
    function resetAll() {
        if (!confirm("Reset everything? This permanently deletes all items, stats and badges.")) return;
        items = []; searches = []; unlockedBadges = [];
        stats = { xp: 0, level: 1, rank: RANKS[0], itemsAdded: 0, cleared: 0, sprints: 0, streak: 1, reachedZero: false, lastVisit: new Date().toDateString() };
        localStorage.removeItem(KEY.searches);
        save();
        renderAll();
        renderSearchHistory();
        toast("Everything reset", "warn");
    }

    /* ------------------------------ THEME -------------------------------- */
    function applyTheme(theme) {
        document.body.className = theme;
        document.documentElement.className = theme;
        localStorage.setItem(KEY.theme, theme);
        $("theme-select").value = theme;
    }

    /* ------------------------------ EVENTS ------------------------------- */
    function bind() {
        // navigation
        qsa("[data-page]").forEach((el) => {
            el.addEventListener("click", (e) => { e.preventDefault(); switchPage(el.dataset.page); });
        });

        // mobile menu
        $("menu-btn").addEventListener("click", () => document.querySelector(".nav-tabs").classList.toggle("open"));

        // theme
        $("theme-select").addEventListener("change", (e) => applyTheme(e.target.value));

        // add / modal
        $("add-btn").addEventListener("click", () => openModal(null));
        $("close-modal").addEventListener("click", closeModal);
        $("cancel-modal").addEventListener("click", closeModal);
        $("add-overlay").addEventListener("click", (e) => { if (e.target.id === "add-overlay") closeModal(); });
        $("add-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const data = {
                name: $("f-name").value,
                context: $("f-context").value,
                type: $("f-type").value,
                course: $("f-course").value,
                deadline: $("f-deadline").value,
                priority: $("f-priority").value,
            };
            if (!data.name.trim()) return;
            if (editingId) updateItem(editingId, data);
            else addItem(data);
            closeModal();
        });

        // search
        const search = $("search-input");
        search.addEventListener("input", (e) => { searchQuery = e.target.value; renderLibrary(); });
        search.addEventListener("focus", showHistory);
        search.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.nativeEvent?.isComposing && e.keyCode !== 229) {
                saveSearch(search.value);
                if (currentPage !== "academic-hub") switchPage("academic-hub");
                hideHistory();
            }
        });
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".search-wrap")) hideHistory();
        });
        $("search-history-list").addEventListener("click", (e) => {
            const chip = e.target.closest(".history-chip");
            if (!chip) return;
            search.value = chip.dataset.q;
            searchQuery = chip.dataset.q;
            if (currentPage !== "academic-hub") switchPage("academic-hub");
            renderLibrary();
            hideHistory();
        });
        $("clear-history-btn").addEventListener("click", () => {
            searches = [];
            localStorage.removeItem(KEY.searches);
            renderSearchHistory();
            toast("Search history cleared", "info");
        });

        // filters (delegated)
        $("type-filters").addEventListener("click", (e) => {
            const chip = e.target.closest(".chip");
            if (!chip) return;
            typeFilter = chip.dataset.type;
            qsa("#type-filters .chip").forEach((c) => c.classList.toggle("active", c === chip));
            renderLibrary();
        });
        $("course-filters").addEventListener("click", (e) => {
            const chip = e.target.closest(".chip");
            if (!chip) return;
            courseFilter = chip.dataset.course;
            renderCourseFilters();
            renderLibrary();
        });

        // library actions (delegated)
        $("library").addEventListener("click", (e) => {
            const t = e.target;
            if (t.dataset.done) toggleComplete(t.dataset.done);
            else if (t.dataset.del) deleteItem(t.dataset.del);
            else if (t.dataset.edit) openModal(t.dataset.edit);
            else if (t.dataset.focusitem) setPomoTask(t.dataset.focusitem);
        });

        // dashboard focus buttons (delegated)
        $("dashboard").addEventListener("click", (e) => {
            const btn = e.target.closest("[data-focus]");
            if (btn) setPomoTask(btn.dataset.focus);
        });

        // panic
        $("panic-toggle").addEventListener("change", (e) => {
            panicMode = e.target.checked;
            document.querySelector(".matrix-card").style.display = panicMode ? "none" : "";
            toast(panicMode ? "Panic mode on — next 12 hours only" : "Panic mode off", panicMode ? "warn" : "info");
        });

        // pomodoro
        $("pomo-start").addEventListener("click", startPomo);
        $("pomo-pause").addEventListener("click", pausePomo);
        $("pomo-reset").addEventListener("click", resetPomo);
        qsa(".pomo-modes .chip").forEach((chip) => {
            chip.addEventListener("click", () => {
                qsa(".pomo-modes .chip").forEach((c) => c.classList.toggle("active", c === chip));
                pomoTotal = parseInt(chip.dataset.mins, 10) * 60;
                pomoLeft = pomoTotal;
                pausePomo();
                renderPomo();
            });
        });

        // data controls
        $("export-json").addEventListener("click", exportJSON);
        $("import-json").addEventListener("change", (e) => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ""; });
        $("export-md").addEventListener("click", exportMarkdown);
        $("reset-all").addEventListener("click", resetAll);

        // shortcuts
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") { closeModal(); hideHistory(); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("search-input").focus(); }
        });
    }

    /* ------------------------------ INIT --------------------------------- */
    function init() {
        applyTheme(localStorage.getItem(KEY.theme) || "theme-dark");
        dailyStreak();
        bind();
        switchPage(currentPage);
        renderAll();
        renderSearchHistory();
        renderPomo();

        // rotating search placeholder
        setInterval(() => {
            const el = $("search-input");
            if (!el || document.activeElement === el || el.value) return;
            phIndex = (phIndex + 1) % SEARCH_PLACEHOLDERS.length;
            el.placeholder = SEARCH_PLACEHOLDERS[phIndex];
        }, 3200);
    }

    document.addEventListener("DOMContentLoaded", init);
})();
