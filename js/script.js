

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let backpackItems = JSON.parse(localStorage.getItem('backpackItems')) || [];
    let dumpsterItems = JSON.parse(localStorage.getItem('dumpsterItems')) || [];
    let userStats = JSON.parse(localStorage.getItem('userStats')) || {
        xp: 0,
        level: 1,
        streak: 1,
        rank: 'Lab Muggle'
    };

    let timerInterval = null;
    let timerSecondsLeft = 25 * 60;
    let isTimerRunning = false;
    let currentFontSize = 16;
    let activeTagFilter = 'all';

    // --- DOM ELEMENT REFERENCES ---
    const themeSelect = document.getElementById('theme-select');
    const examModeBtn = document.getElementById('exam-mode-btn');
    const zenModeBtn = document.getElementById('zen-mode-btn');
    const syncStatusDot = document.getElementById('sync-status');
    const statusText = document.getElementById('status-text');

    const fontIncreaseBtn = document.getElementById('font-increase');
    const fontDecreaseBtn = document.getElementById('font-decrease');
    const fontResetBtn = document.getElementById('font-reset');

    const clutterText = document.getElementById('clutter-text');
    const progressFill = document.getElementById('progress-fill');
    const clutterStatusMsg = document.getElementById('clutter-status-msg');
    const streakCount = document.getElementById('streak-count');
    const userRank = document.getElementById('user-rank');
    const userLevel = document.getElementById('user-level');
    const userXp = document.getElementById('user-xp');
    const studyHoursLeft = document.getElementById('study-hours-left');
    const digestText = document.getElementById('digest-text');

    const panicBtn = document.getElementById('panic-btn');
    const urgentList = document.getElementById('urgent-list');

    const pomoMinutes = document.getElementById('pomo-minutes');
    const pomoSeconds = document.getElementById('pomo-seconds');
    const pomoStartBtn = document.getElementById('pomo-start-btn');
    const pomoPauseBtn = document.getElementById('pomo-pause-btn');
    const pomoResetBtn = document.getElementById('pomo-reset-btn');
    const testChimeBtn = document.getElementById('test-chime-btn');

    const exportJsonBtn = document.getElementById('export-json-btn');
    const importJsonInput = document.getElementById('import-json-input');
    const exportMdBtn = document.getElementById('export-md-btn');
    const dumpsterList = document.getElementById('dumpster-list');
    const emptyDumpsterBtn = document.getElementById('empty-dumpster-btn');

    const addForm = document.getElementById('add-form');
    const itemsContainer = document.getElementById('items-container');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const tagPills = document.querySelectorAll('.tag-pill');

    // --- INITIALIZATION ---
    initTheme();
    updateGamificationUI();
    renderAll();
    setupEventListeners();

    // ==========================================================================
    // 1. SYSTEM CONTROLS, THEMING & ACCESSIBILITY
    // ==========================================================================

    function initTheme() {
        const savedTheme = localStorage.getItem('backpackTheme') || 'theme-dark';
        document.body.className = savedTheme;
        if (themeSelect) themeSelect.value = savedTheme;
    }

    function setupEventListeners() {
        // Theme Switcher
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                const selectedTheme = e.target.value;
                document.body.className = selectedTheme;
                localStorage.setItem('backpackTheme', selectedTheme);
            });
        }

        // Exam Mode Toggle
        if (examModeBtn) {
            examModeBtn.addEventListener('click', () => {
                const isActive = examModeBtn.classList.toggle('active');
                examModeBtn.textContent = isActive ? '🔥 Exam Week Mode: ON' : '🔥 Exam Week Mode: OFF';
                examModeBtn.style.background = isActive ? 'var(--danger-color)' : '';
                renderAll();
            });
        }

        // Zen Mode Toggle
        if (zenModeBtn) {
            zenModeBtn.addEventListener('click', () => {
                const isZen = document.body.classList.toggle('zen-mode-active');
                zenModeBtn.textContent = isZen ? '🧘 Zen Mode: ON' : '🧘 Zen Mode: OFF';
                const sidebar = document.querySelector('.sidebar-engine');
                const stats = document.querySelector('.stats-grid');
                if (sidebar) sidebar.style.display = isZen ? 'none' : 'block';
                if (stats) stats.style.display = isZen ? 'none' : 'grid';
            });
        }

        // Font Resizer
        if (fontIncreaseBtn) {
            fontIncreaseBtn.addEventListener('click', () => {
                if (currentFontSize < 22) {
                    currentFontSize += 1;
                    document.body.style.fontSize = `${currentFontSize}px`;
                }
            });
        }

        if (fontDecreaseBtn) {
            fontDecreaseBtn.addEventListener('click', () => {
                if (currentFontSize > 12) {
                    currentFontSize -= 1;
                    document.body.style.fontSize = `${currentFontSize}px`;
                }
            });
        }

        if (fontResetBtn) {
            fontResetBtn.addEventListener('click', () => {
                currentFontSize = 16;
                document.body.style.fontSize = '16px';
            });
        }

        // Online/Offline Listener
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        // Form Submit
        if (addForm) {
            addForm.addEventListener('submit', handleAddItem);
        }

        // Search and Filters
        if (searchInput) searchInput.addEventListener('input', renderItemsGrid);
        if (sortSelect) sortSelect.addEventListener('change', renderItemsGrid);

        tagPills.forEach(pill => {
            pill.addEventListener('click', () => {
                tagPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                activeTagFilter = pill.getAttribute('data-filter');
                renderItemsGrid();
            });
        });

        // Panic Mode
        if (panicBtn) {
            panicBtn.addEventListener('click', () => {
                alert('🚨 PANIC MODE ACTIVATED: Isolating items due within 12 hours.');
                searchInput.value = '';
                activeTagFilter = 'all';
                renderUrgentList(true);
            });
        }

        // Timer Controls
        if (pomoStartBtn) pomoStartBtn.addEventListener('click', startTimer);
        if (pomoPauseBtn) pomoPauseBtn.addEventListener('click', pauseTimer);
        if (pomoResetBtn) pomoResetBtn.addEventListener('click', resetTimer);
        if (testChimeBtn) testChimeBtn.addEventListener('click', playChime);

        // Backup Controls
        if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportJSON);
        if (importJsonInput) importJsonInput.addEventListener('change', importJSON);
        if (exportMdBtn) exportMdBtn.addEventListener('click', copyMarkdownChecklist);
        if (emptyDumpsterBtn) emptyDumpsterBtn.addEventListener('click', clearDumpster);
    }

    function updateOnlineStatus() {
        if (navigator.onLine) {
            syncStatusDot.className = 'status-dot online';
            statusText.textContent = 'Offline Ready (Local Storage Active)';
        } else {
            syncStatusDot.className = 'status-dot offline';
            statusText.textContent = 'Offline Mode (Changes saved locally)';
        }
    }

    // ==========================================================================
    // 2. DATA MANIPULATION & ITEM ADDITION
    // ==========================================================================

    function handleAddItem(e) {
        e.preventDefault();

        const nameInput = document.getElementById('item-name');
        const contextInput = document.getElementById('item-context');
        const courseInput = document.getElementById('item-course');
        const typeInput = document.getElementById('item-type');
        const dateInput = document.getElementById('item-date');
        const timeCostInput = document.getElementById('item-time-cost');
        const priorityInput = document.getElementById('item-priority');

        const newItem = {
            id: 'item_' + Date.now(),
            name: nameInput.value.trim(),
            context: contextInput.value.trim() || 'No description provided.',
            course: courseInput.value,
            type: typeInput.value,
            deadline: dateInput.value ? new Date(dateInput.value).toISOString() : null,
            timeCost: parseInt(timeCostInput.value, 10) || 30,
            priority: priorityInput.value,
            completed: false,
            createdAt: new Date().toISOString()
        };

        backpackItems.unshift(newItem);
        saveState();

        // Award XP for adding items
        addXP(15);

        addForm.reset();
        renderAll();
    }

    function saveState() {
        localStorage.setItem('backpackItems', JSON.stringify(backpackItems));
        localStorage.setItem('dumpsterItems', JSON.stringify(dumpsterItems));
        localStorage.setItem('userStats', JSON.stringify(userStats));
    }

    function addXP(amount) {
        userStats.xp += amount;
        if (userStats.xp >= 100) {
            userStats.level += 1;
            userStats.xp -= 100;
            updateRankTitle();
            triggerConfetti();
        }
        updateGamificationUI();
        saveState();
    }

    function updateRankTitle() {
        const ranks = ['Lab Muggle', 'Cadet Scholar', 'Assignment Knight', 'CT Conqueror', 'KUET Warlord'];
        const index = Math.min(Math.floor((userStats.level - 1) / 2), ranks.length - 1);
        userStats.rank = ranks[index];
    }

    function updateGamificationUI() {
        if (streakCount) streakCount.textContent = `${userStats.streak} Days`;
        if (userRank) userRank.textContent = userStats.rank;
        if (userLevel) userLevel.textContent = userStats.level;
        if (userXp) userXp.textContent = userStats.xp;
    }

    // ==========================================================================
    // 3. RENDER ENGINES (CLUTTER, MATRIX, GRID, DUMPSTER)
    // ==========================================================================

    function renderAll() {
        renderClutterGauge();
        renderUrgentList();
        renderEisenhowerMatrix();
        renderItemsGrid();
        renderDumpster();
        updateDailyDigest();
    }

    function renderClutterGauge() {
        const activeItems = backpackItems.filter(i => !i.completed);
        const maxCapacity = 15; // Set capacity limit for gauge baseline
        const clutterPercentage = Math.min(Math.round((activeItems.length / maxCapacity) * 100), 100);

        if (clutterText) clutterText.textContent = `${clutterPercentage}%`;
        if (progressFill) {
            progressFill.style.width = `${clutterPercentage}%`;
            if (clutterPercentage > 75) {
                progressFill.style.background = 'var(--danger-color)';
            } else if (clutterPercentage > 40) {
                progressFill.style.background = 'var(--warning-color)';
            } else {
                progressFill.style.background = 'var(--accent-color)';
            }
        }

        if (clutterStatusMsg) {
            if (clutterPercentage === 0) clutterStatusMsg.textContent = 'Clean & Clear!';
            else if (clutterPercentage < 50) clutterStatusMsg.textContent = 'Backpack under control.';
            else if (clutterPercentage < 80) clutterStatusMsg.textContent = 'Warning: Backpack getting heavy!';
            else clutterStatusMsg.textContent = 'CRITICAL: Clear finished items now!';
        }

        // Time Budgeting Calculation
        const totalMinutes = activeItems.reduce((acc, item) => acc + item.timeCost, 0);
        const totalHours = (totalMinutes / 60).toFixed(1);
        if (studyHoursLeft) studyHoursLeft.textContent = `${totalHours} hrs`;
    }

    function renderUrgentList(forcePanic = false) {
        if (!urgentList) return;
        const now = new Date();

        const urgentItems = backpackItems.filter(item => {
            if (item.completed || !item.deadline) return false;
            const diffHours = (new Date(item.deadline) - now) / (1000 * 60 * 60);
            return forcePanic ? diffHours <= 12 && diffHours > -24 : diffHours <= 24 && diffHours > -24;
        });

        if (urgentItems.length === 0) {
            urgentList.innerHTML = '<p class="empty-state">No urgent deadlines right now! Relax or prep ahead.</p>';
            return;
        }

        urgentList.innerHTML = urgentItems.map(item => `
            <div class="urgent-item-pill" style="border-left: 3px solid var(--danger-color); padding: 6px; margin-bottom: 6px; background: var(--bg-primary); border-radius: 4px;">
                <strong>${escapeHTML(item.name)}</strong>
                <br><small>Due: ${new Date(item.deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
            </div>
        `).join('');
    }

    function renderEisenhowerMatrix() {
        const q1 = document.getElementById('quadrant-q1');
        const q2 = document.getElementById('quadrant-q2');
        const q3 = document.getElementById('quadrant-q3');
        const q4 = document.getElementById('quadrant-q4');

        if (!q1 || !q2 || !q3 || !q4) return;

        [q1, q2, q3, q4].forEach(el => el.innerHTML = '');

        const now = new Date();

        backpackItems.filter(i => !i.completed).forEach(item => {
            const isUrgent = item.deadline && ((new Date(item.deadline) - now) / (1000 * 60 * 60)) <= 24;
            const isImportant = item.priority === 'High' || item.type === 'Task';

            const card = document.createElement('div');
            card.className = 'matrix-item';
            card.style.cssText = 'background: var(--bg-primary); padding: 6px; margin-bottom: 4px; border-radius: 4px; font-size: 0.8rem;';
            card.innerHTML = `<strong>${escapeHTML(item.name)}</strong> <small>(${item.course})</small>`;

            if (isUrgent && isImportant) q1.appendChild(card);
            else if (!isUrgent && isImportant) q2.appendChild(card);
            else if (isUrgent && !isImportant) q3.appendChild(card);
            else q4.appendChild(card);
        });
    }

    function renderItemsGrid() {
        if (!itemsContainer) return;

        let filtered = [...backpackItems];
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

        // Tag Filter
        if (activeTagFilter !== 'all') {
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(activeTagFilter.toLowerCase()) ||
                item.context.toLowerCase().includes(activeTagFilter.toLowerCase())
            );
        }

        // Search Query
        if (query) {
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(query) ||
                item.context.toLowerCase().includes(query) ||
                item.course.toLowerCase().includes(query)
            );
        }

        // Sorting
        const sortVal = sortSelect ? sortSelect.value : 'deadline';
        filtered.sort((a, b) => {
            if (sortVal === 'deadline') {
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(a.deadline) - new Date(b.deadline);
            }
            if (sortVal === 'date-added') return new Date(b.createdAt) - new Date(a.createdAt);
            if (sortVal === 'alpha') return a.name.localeCompare(b.name);
            return 0;
        });

        if (filtered.length === 0) {
            itemsContainer.innerHTML = '<p class="empty-state">No items match your query.</p>';
            return;
        }

        itemsContainer.innerHTML = filtered.map(item => `
            <div class="stat-card item-card ${item.completed ? 'completed-card' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <span class="badge blue">${item.type}</span>
                    <small style="color: var(--text-secondary);">${item.course}</small>
                </div>
                <h4 style="margin: 8px 0 4px; font-size: 1rem;">${escapeHTML(item.name)}</h4>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px;">${escapeHTML(item.context)}</p>
                <small style="display: block; margin-bottom: 8px;">⏱️ Est: ${item.timeCost} mins</small>
                
                <div style="display: flex; gap: 6px; margin-top: auto;">
                    <button onclick="toggleComplete('${item.id}')" class="action-btn start" style="font-size: 0.75rem; padding: 4px;">${item.completed ? '↩️ Undo' : '✅ Done'}</button>
                    <button onclick="attachToPomodoro('${escapeHTML(item.name)}')" class="action-btn reset" style="font-size: 0.75rem; padding: 4px;">⏱️ Study</button>
                    <button onclick="deleteItem('${item.id}')" class="action-btn pause" style="background: var(--danger-color); font-size: 0.75rem; padding: 4px;">🗑️ Delete</button>
                </div>
            </div>
        `).join('');
    }

    function renderDumpster() {
        if (!dumpsterList) return;
        if (dumpsterItems.length === 0) {
            dumpsterList.innerHTML = '<small class="empty-state">Dumpster is empty.</small>';
            return;
        }

        dumpsterList.innerHTML = dumpsterItems.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; margin-bottom: 4px; background: var(--bg-primary); padding: 4px 8px; border-radius: 4px;">
                <span>${escapeHTML(item.name)}</span>
                <button onclick="restoreFromDumpster('${item.id}')" style="background: none; border: none; color: var(--accent-color); cursor: pointer; font-size: 0.75rem;">Restore</button>
            </div>
        `).join('');
    }

    function updateDailyDigest() {
        if (!digestText) return;
        const activeTasks = backpackItems.filter(i => !i.completed);
        const urgentCount = activeTasks.filter(i => i.priority === 'High' || i.type === 'Task').length;
        digestText.innerHTML = `Good day, Warrior! You have <strong>${urgentCount} high priority items</strong> and <strong>${activeTasks.length} total tasks</strong> in your backpack.`;
    }

    // ==========================================================================
    // 4. POMODORO TIMER ENGINE
    // ==========================================================================

    function updateTimerDisplay() {
        const mins = Math.floor(timerSecondsLeft / 60);
        const secs = timerSecondsLeft % 60;
        if (pomoMinutes) pomoMinutes.textContent = String(mins).padStart(2, '0');
        if (pomoSeconds) pomoSeconds.textContent = String(secs).padStart(2, '0');
    }

    function startTimer() {
        if (isTimerRunning) return;
        isTimerRunning = true;
        timerInterval = setInterval(() => {
            if (timerSecondsLeft > 0) {
                timerSecondsLeft--;
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
                isTimerRunning = false;
                playChime();
                addXP(25); // Award XP for completing a study session
                alert('⏱️ Pomodoro Sprint Completed! Take a 5-minute break.');
            }
        }, 1000);
    }

    function pauseTimer() {
        clearInterval(timerInterval);
        isTimerRunning = false;
    }

    function resetTimer() {
        pauseTimer();
        timerSecondsLeft = 25 * 60;
        updateTimerDisplay();
    }

    function playChime() {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, context.currentTime); // D5 note
        gain.gain.setValueAtTime(0.1, context.currentTime);
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start();
        osc.stop(context.currentTime + 0.5);
    }

    // ==========================================================================
    // 5. GLOBAL HANDLERS (EXPOSED TO WINDOW)
    // ==========================================================================

    window.toggleComplete = function(id) {
        const item = backpackItems.find(i => i.id === id);
        if (item) {
            item.completed = !item.completed;
            if (item.completed) addXP(20);
            saveState();
            renderAll();
        }
    };

    window.deleteItem = function(id) {
        const index = backpackItems.findIndex(i => i.id === id);
        if (index !== -1) {
            const removed = backpackItems.splice(index, 1)[0];
            dumpsterItems.unshift(removed);
            saveState();
            renderAll();
        }
    };

    window.restoreFromDumpster = function(id) {
        const index = dumpsterItems.findIndex(i => i.id === id);
        if (index !== -1) {
            const restored = dumpsterItems.splice(index, 1)[0];
            backpackItems.unshift(restored);
            saveState();
            renderAll();
        }
    };

    window.attachToPomodoro = function(taskName) {
        const activeLabel = document.getElementById('pomo-active-task');
        if (activeLabel) activeLabel.textContent = taskName;
        resetTimer();
    };

    function clearDumpster() {
        if (confirm('Permanently delete all items in the dumpster?')) {
            dumpsterItems = [];
            saveState();
            renderDumpster();
        }
    }

    // ==========================================================================
    // 6. BACKUP, EXPORT & UTILITIES
    // ==========================================================================

    function exportJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backpackItems, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `digital_backpack_backup_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    }

    function importJSON(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const imported = JSON.parse(evt.target.result);
                if (Array.isArray(imported)) {
                    backpackItems = imported;
                    saveState();
                    renderAll();
                    alert('Successfully imported items!');
                } else {
                    alert('Invalid JSON format.');
                }
            } catch (err) {
                alert('Error reading JSON file.');
            }
        };
        reader.readAsText(file);
    }

    function copyMarkdownChecklist() {
        const markdown = backpackItems.map(item => `- [${item.completed ? 'x' : ' '}] ${item.name} (${item.course}) - Due: ${item.deadline ? new Date(item.deadline).toLocaleDateString() : 'N/A'}`).join('\n');
        navigator.clipboard.writeText(markdown).then(() => {
            alert('Copied Markdown checklist to clipboard!');
        });
    }

    function triggerConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = Array.from({ length: 50 }).map(() => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            color: ['#ef4444', '#38bdf8', '#10b981', '#f59e0b'][Math.floor(Math.random() * 4)],
            size: Math.random() * 6 + 4,
            speed: Math.random() * 3 + 2
        }));

        let animFrame;
        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.y += p.speed;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, p.size, p.size);
            });

            if (particles.some(p => p.y < canvas.height)) {
                animFrame = requestAnimationFrame(render);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animFrame);
            }
        }
        render();
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }
});