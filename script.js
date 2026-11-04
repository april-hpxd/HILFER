/*
 * Windows 98 Style Website Template
 * Based on the original Windows template from HTML5-Templates.com
 * Original: https://html5-templates.com/preview/windows.html
 */

let openWindows = new Set();
let activeWindow = null;
let zIndexCounter = 1000;
let draggedElement = null;
let offset = { x: 0, y: 0 };
let selectedIcon = null;
let draggedDesktopIcon = null;
let suppressIconOpen = false;

const applicationTitles = {
    reconciliation: 'Reconciliation',
    records: 'Records',
    themes: 'Display Properties',
    ai: 'AI Assistant',
    'my-computer': 'My Computer',
    emails: 'Emails',
    research: 'Research',
    'data-analytics': 'Data Analytics',
    reports: 'Reports',
    'med-info': 'Medical Information',
    'facility-logs': 'Facility Logs',
    footage: 'Security Footage',
    notes: 'Notes',
    maintenance: 'Maintenance',
    'recycle-bin': 'Recycle Bin',
    hr: 'Human Resources',
    notices: 'Notices',
    'safety-alerts': 'Safety Alerts',
    downloads: 'Downloads'
};

function createPlaceholderWindow(windowId) {
    const title = applicationTitles[windowId];
    if (!title) return null;

    const windowEl = document.createElement('section');
    windowEl.className = 'window placeholder-window';
    windowEl.id = windowId + '-window';
    windowEl.setAttribute('aria-label', title);
    const offset = (document.querySelectorAll('.window').length % 8) * 24;
    Object.assign(windowEl.style, {
        top: (70 + offset) + 'px',
        left: (100 + offset) + 'px',
        width: '420px',
        height: '300px'
    });

    const header = document.createElement('div');
    header.className = 'window-header';
    const heading = document.createElement('span');
    heading.className = 'window-title';
    heading.textContent = title;
    const controls = document.createElement('div');
    controls.className = 'window-controls';
    for (const [action, label, glyph] of [
        ['minimize', 'Minimize', '_'],
        ['maximize', 'Maximize', '□'],
        ['close', 'Close', '×']
    ]) {
        const button = document.createElement('button');
        button.className = 'window-button' + (action === 'close' ? ' close-btn' : '');
        button.type = 'button';
        button.dataset.control = action;
        button.setAttribute('aria-label', `${label} ${title}`);
        button.textContent = glyph;
        controls.append(button);
    }
    header.append(heading, controls);

    const content = document.createElement('div');
    content.className = 'window-content placeholder-window-content';
    const appName = document.createElement('span');
    appName.textContent = title;
    content.append(appName);
    windowEl.append(header, content);
    document.getElementById('desktop').append(windowEl);
    fitWindowsToWorkspace();
    return windowEl;
}

function openWindow(windowId) {
    const windowEl = document.getElementById(windowId + '-window') || createPlaceholderWindow(windowId);
    if (!windowEl) return;

    windowEl.classList.add('visible');
    windowEl.classList.remove('inactive');
    openWindows.add(windowId);
    setActiveWindow(windowId);
    addToTaskbar(windowId);
    setActiveWindow(windowId);
    closeStartMenu();

    clearIconSelection();
}

function closeWindow(windowId) {
    const windowEl = document.getElementById(windowId + '-window');
    if (!windowEl) return;

    windowEl.classList.remove('visible', 'active');
    windowEl.classList.add('inactive');
    openWindows.delete(windowId);
    removeFromTaskbar(windowId);

    const nextWindow = [...openWindows].find(id => document.getElementById(id + '-window').classList.contains('visible'));
    if (nextWindow) setActiveWindow(nextWindow);
    else activeWindow = null;
}

function minimizeWindow(windowId) {
    const windowEl = document.getElementById(windowId + '-window');
    if (!windowEl) return;

    windowEl.classList.remove('visible');
    windowEl.classList.remove('active');
    windowEl.classList.add('inactive');

    const taskbarItem = document.querySelector(`[data-window="${windowId}"]`);
    if (taskbarItem) {
        taskbarItem.classList.remove('active');
    }
}

function maximizeWindow(windowId) {
    const windowEl = document.getElementById(windowId + '-window');
    if (!windowEl) return;

    if (windowEl.style.width === '100vw' || windowEl.classList.contains('maximized')) {
        windowEl.classList.remove('maximized');
        windowEl.style.width = windowEl.dataset.originalWidth || '450px';
        windowEl.style.height = windowEl.dataset.originalHeight || '350px';
        windowEl.style.top = windowEl.dataset.originalTop || '100px';
        windowEl.style.left = windowEl.dataset.originalLeft || '200px';
    } else {
        windowEl.dataset.originalWidth = windowEl.style.width;
        windowEl.dataset.originalHeight = windowEl.style.height;
        windowEl.dataset.originalTop = windowEl.style.top;
        windowEl.dataset.originalLeft = windowEl.style.left;

        windowEl.classList.add('maximized');
        windowEl.style.width = '100vw';
        windowEl.style.height = 'calc(100dvh - 60px)';
        windowEl.style.top = '0';
        windowEl.style.left = '0';
    }
}

function setActiveWindow(windowId) {
    document.querySelectorAll('.window').forEach(w => {
        w.classList.remove('active');
        w.classList.add('inactive');
    });

    document.querySelectorAll('.taskbar-item').forEach(t => {
        t.classList.remove('active');
    });

    const windowEl = document.getElementById(windowId + '-window');
    if (windowEl) {
        windowEl.classList.add('active');
        windowEl.classList.remove('inactive');
        windowEl.style.zIndex = ++zIndexCounter;
        activeWindow = windowId;
    }

    const taskbarItem = document.querySelector(`[data-window="${windowId}"]`);
    if (taskbarItem) {
        taskbarItem.classList.add('active');
    }
}

function addToTaskbar(windowId) {
    const taskbarItems = document.getElementById('taskbar-items');

    if (document.querySelector(`[data-window="${windowId}"]`)) return;

    const item = document.createElement('button');
    item.className = 'taskbar-item';
    item.setAttribute('data-window', windowId);
    item.textContent = getWindowTitle(windowId);
    item.onclick = () => toggleWindow(windowId);

    taskbarItems.appendChild(item);
}

function removeFromTaskbar(windowId) {
    const item = document.querySelector(`[data-window="${windowId}"]`);
    if (item) {
        item.remove();
    }
}

function toggleWindow(windowId) {
    const windowEl = document.getElementById(windowId + '-window');
    if (!windowEl) return;

    if (windowEl.classList.contains('visible') && activeWindow === windowId) {
        minimizeWindow(windowId);
    } else {
        windowEl.classList.add('visible');
        setActiveWindow(windowId);
    }
}

function getWindowTitle(windowId) {
    return applicationTitles[windowId] || windowId;
}

function clearIconSelection() {
    document.querySelectorAll('.icon').forEach(icon => {
        icon.classList.remove('selected');
    });
    selectedIcon = null;
}

function toggleStartMenu() {
    const startMenu = document.getElementById('start-menu');
    const startButton = document.querySelector('.start-button');

    if (startMenu.classList.contains('visible')) {
        startMenu.classList.remove('visible');
        startButton.classList.remove('active');
    } else {
        startMenu.classList.add('visible');
        startButton.classList.add('active');
    }
}

function closeStartMenu() {
    const startMenu = document.getElementById('start-menu');
    const startButton = document.querySelector('.start-button');
    startMenu.classList.remove('visible');
    startButton.classList.remove('active');
}

function initDragAndDrop() {
    document.addEventListener('mousedown', function(e) {
        const header = e.target.closest('.window-header');
        if (e.button === 0 && header && !header.parentElement.classList.contains('maximized') && !e.target.closest('.window-controls')) {
            draggedElement = header.parentElement;
            const rect = draggedElement.getBoundingClientRect();
            offset.x = e.clientX - rect.left;
            offset.y = e.clientY - rect.top;

            const windowId = draggedElement.id.replace('-window', '');
            setActiveWindow(windowId);

            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (draggedElement) {
            // Mouse release outside the browser must not leave a window stuck to the cursor.
            if (!(e.buttons & 1)) { draggedElement = null; return; }
            const x = e.clientX - offset.x;
            const y = e.clientY - offset.y;
            // Like desktop windows, edges may extend beyond the visible workspace.
            draggedElement.style.left = x + 'px';
            draggedElement.style.top = y + 'px';
        }
    });

    document.addEventListener('mouseup', function() {
        draggedElement = null;
    });
    window.addEventListener('blur', () => { draggedElement = null; });
}

// Refit on display-size changes only; never clamp a user's ongoing window movement.
function fitWindowsToWorkspace() {
    draggedElement = null;
    for (const el of document.querySelectorAll('.window:not(.maximized)')) {
        const style = getComputedStyle(el);
        const width = Math.min(parseFloat(style.width), window.innerWidth - 12);
        const height = Math.min(parseFloat(style.height), window.innerHeight - 68);
        el.style.left = (window.innerWidth <= 700 ? 6 : Math.max(6, Math.min(parseFloat(el.style.left) || 0, window.innerWidth - width - 12))) + 'px';
        el.style.top = (window.innerWidth <= 700 ? 10 : Math.max(6, Math.min(parseFloat(el.style.top) || 0, window.innerHeight - height - 68))) + 'px';
    }
}

function setDesktopIconPosition(icon, left, top) {
    const desktop = document.getElementById('desktop');
    const maxLeft = Math.max(0, desktop.clientWidth - icon.offsetWidth - 8);
    const maxTop = Math.max(0, desktop.clientHeight - icon.offsetHeight - 68);
    const x = Math.max(0, Math.min(left, maxLeft));
    const y = Math.max(0, Math.min(top, maxTop));
    icon.style.left = (x / desktop.clientWidth * 100) + '%';
    icon.style.top = (y / desktop.clientHeight * 100) + '%';
}

function fitDesktopIconsToWorkspace() {
    const desktop = document.getElementById('desktop');
    const bounds = desktop.getBoundingClientRect();
    for (const icon of desktop.querySelectorAll('.desktop-icons .icon')) {
        if (icon.dataset.userPositioned !== 'true') continue;
        const iconBounds = icon.getBoundingClientRect();
        setDesktopIconPosition(icon, iconBounds.left - bounds.left, iconBounds.top - bounds.top);
    }
}

function initDesktopIconDrag() {
    document.addEventListener('pointerdown', e => {
        const icon = e.target.closest('.desktop-icons .icon');
        if (!icon || e.button !== 0) return;
        const desktop = document.getElementById('desktop');
        const bounds = desktop.getBoundingClientRect();
        const iconBounds = icon.getBoundingClientRect();
        draggedDesktopIcon = {
            icon,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            left: iconBounds.left - bounds.left,
            top: iconBounds.top - bounds.top,
            moved: false
        };
    });

    document.addEventListener('pointermove', e => {
        if (!draggedDesktopIcon || draggedDesktopIcon.pointerId !== e.pointerId) return;
        const dx = e.clientX - draggedDesktopIcon.startX;
        const dy = e.clientY - draggedDesktopIcon.startY;
        if (!draggedDesktopIcon.moved && Math.hypot(dx, dy) < 5) return;
        draggedDesktopIcon.moved = true;
        draggedDesktopIcon.icon.dataset.userPositioned = 'true';
        setDesktopIconPosition(draggedDesktopIcon.icon, draggedDesktopIcon.left + dx, draggedDesktopIcon.top + dy);
        e.preventDefault();
    });

    document.addEventListener('pointerup', e => {
        if (!draggedDesktopIcon || draggedDesktopIcon.pointerId !== e.pointerId) return;
        suppressIconOpen = draggedDesktopIcon.moved;
        draggedDesktopIcon = null;
    });
    document.addEventListener('pointercancel', () => {
        draggedDesktopIcon = null;
        suppressIconOpen = false;
    });
    window.addEventListener('blur', () => {
        draggedDesktopIcon = null;
        suppressIconOpen = false;
    });
}

function updateClock() {
    const clockEl = document.getElementById('clock');
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    clockEl.textContent = timeString;
}


// HILFER: only title bars move windows; native record drag events remain untouched.
document.addEventListener('click', e => {
    if (suppressIconOpen && e.target.closest('.desktop-icons .icon')) {
        e.preventDefault();
        suppressIconOpen = false;
        return;
    }
    suppressIconOpen = false;
    const app = e.target.closest('[data-open]');
    if (app) { openWindow(app.dataset.open); return; }
    const control = e.target.closest('[data-control]');
    if (control) {
        const id = control.closest('.window').id.replace('-window', '');
        ({close: closeWindow, minimize: minimizeWindow, maximize: maximizeWindow})[control.dataset.control](id);
        return;
    }
    const windowEl = e.target.closest('.window');
    if (windowEl) setActiveWindow(windowEl.id.replace('-window', ''));
    if (!e.target.closest('#start-menu, .start-button')) closeStartMenu();
});
document.querySelector('.start-button').addEventListener('click', toggleStartMenu);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeStartMenu(); });
document.querySelector('#display-theme').addEventListener('change', e => {
    document.documentElement.dataset.theme = e.target.value;
});
initDragAndDrop();
initDesktopIconDrag();
fitWindowsToWorkspace();
fitDesktopIconsToWorkspace();
window.addEventListener('resize', () => {
    fitWindowsToWorkspace();
    fitDesktopIconsToWorkspace();
});
updateClock();
setInterval(updateClock, 1000);

// A deliberate desk arrangement; manual movement and window controls still work.
function arrangeWorkspace() {
    openWindow('reconciliation');
    openWindow('records');
    if (window.innerWidth < 1000) {
        setActiveWindow('reconciliation');
        return;
    }
    const available = window.innerWidth - 136;
    const registerWidth = Math.round(available * 0.43);
    const height = Math.min(620, window.innerHeight - 104);
    for (const [id, left, width] of [
        ['reconciliation', 112, registerWidth],
        ['records', 124 + registerWidth, available - registerWidth]
    ]) {
        const el = document.getElementById(id + '-window');
        el.classList.remove('maximized');
        Object.assign(el.style, { left: left + 'px', top: '36px', width: width + 'px', height: height + 'px' });
    }
}
document.addEventListener('click', e => {
    if (e.target.closest('[data-arrange]')) { arrangeWorkspace(); closeStartMenu(); }
});
