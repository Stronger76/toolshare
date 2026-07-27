// Global Modal Close Function (Attached directly to window)
window.closeAllModals = function() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.body.classList.remove('modal-open');
};

// Unregister Service Workers & Nuke Cache
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}
if ('caches' in window) {
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
}

// Global Application State
let users = [];
let currentUser = null;
let currentTools = [];
let selectedTool = null;
let selectedToolIds = new Set(); // For batch selection

// Utility to group rentals by renter and start date
function groupRentals(rentalList) {
  const groups = {};
  rentalList.forEach(r => {
    const key = `${r.renter_id}_${r.start_date}`;
    if (!groups[key]) {
      groups[key] = {
        id: r.id, // primary id for pdf (can be the first tool's id)
        renter_name: r.renter_name,
        owner_name: r.owner_name,
        start_date: r.start_date,
        end_date: r.end_date,
        status: 'returned',
        total_price: 0,
        tools: [],
        tool_names: []
      };
    }
    groups[key].tools.push(r);
    groups[key].tool_names.push(r.tool_name);
    groups[key].total_price += r.total_price;
    if (r.status === 'active') {
      groups[key].status = 'active';
    }
    if (new Date(r.end_date) > new Date(groups[key].end_date)) {
      groups[key].end_date = r.end_date;
    }
  });

  return Object.values(groups).map(g => {
    if (g.tools.length === 1) {
      g.display_name = g.tool_names[0];
      g.image_url = g.tools[0].image_url;
      g.tool_name = g.tool_names[0]; // for compatibility
    } else {
      g.display_name = `${g.tools.length} utilaje (${g.tool_names.join(', ')})`;
      g.image_url = g.tools[0].image_url;
      g.tool_name = g.display_name;
    }
    return g;
  }).sort((a, b) => b.id - a.id);
}

// DOM Elements
const userSelect = document.getElementById('user-select');
const userBalance = document.getElementById('user-balance');
const btnDepositTrigger = document.getElementById('btn-deposit-trigger');
const toolsGrid = document.getElementById('tools-grid');
const searchInput = document.getElementById('search-input');
const filterCategory = document.getElementById('filter-category');
const filterStatus = document.getElementById('filter-status');
const filterSort = document.getElementById('filter-sort');
const navTabs = document.querySelectorAll('.nav-tab');
const tabContents = document.querySelectorAll('.tab-content');
const tabBtnAdmin = document.getElementById('tab-btn-admin');

// Form & Modal Elements
const listToolForm = document.getElementById('list-tool-form');

// Detail Modal
const modalToolDetail = document.getElementById('modal-tool-detail');
const mdClose = document.getElementById('md-close');
const mdImg = document.getElementById('md-img');
const mdCategory = document.getElementById('md-category');
const mdName = document.getElementById('md-name');
const mdOwner = document.getElementById('md-owner');
const mdPrice = document.getElementById('md-price');
const mdDesc = document.getElementById('md-desc');
const rentStartInput = document.getElementById('rent-start');
const rentEndInput = document.getElementById('rent-end');
const calcDayPrice = document.getElementById('calc-day-price');
const calcDays = document.getElementById('calc-days');
const calcTotal = document.getElementById('calc-total');
const btnConfirmRent = document.getElementById('btn-confirm-rent');
const rentClientSelect = document.getElementById('rent-client-select');

// Deposit Modal
const modalDeposit = document.getElementById('modal-deposit');
const mdDepositClose = document.getElementById('md-deposit-close');
const depositForm = document.getElementById('deposit-form');
const depositAmountInput = document.getElementById('deposit-amount');
const quickAmountBtns = document.querySelectorAll('.quick-amount-btn');

// Add User Modal
const btnAddUserTrigger = document.getElementById('btn-add-user-trigger');
const modalAddUser = document.getElementById('modal-add-user');
const mdAddUserClose = document.getElementById('md-add-user-close');
const addUserForm = document.getElementById('add-user-form');
const newUsernameInput = document.getElementById('new-username');
const newEmailInput = document.getElementById('new-email');
const newBalanceInput = document.getElementById('new-balance');
const newRoleSelect = document.getElementById('new-role');

// Edit User Modal
const modalEditUser = document.getElementById('modal-edit-user');
const mdEditUserClose = document.getElementById('md-edit-user-close');
const editUserForm = document.getElementById('edit-user-form');
const editUserIdInput = document.getElementById('edit-user-id');
const editUsernameInput = document.getElementById('edit-username');
const editEmailInput = document.getElementById('edit-email');
const editBalanceInput = document.getElementById('edit-balance');
const editRoleSelect = document.getElementById('edit-role');

// Extend Rental Modal
const modalExtendRental = document.getElementById('modal-extend-rental');
const mdExtendClose = document.getElementById('md-extend-close');
const extendRentalForm = document.getElementById('extend-rental-form');
const extendRentalIdInput = document.getElementById('extend-rental-id');
const extendDailyPriceInput = document.getElementById('extend-daily-price');
const extendCurrentEndInput = document.getElementById('extend-current-end');
const extendNewEndInput = document.getElementById('extend-new-end');
const extendCalcDays = document.getElementById('extend-calc-days');
const extendCalcTotal = document.getElementById('extend-calc-total');
const btnConfirmExtend = document.getElementById('btn-confirm-extend');

// Contract / Proces-Verbal Modal
const modalContract = document.getElementById('modal-contract');
const mdContractClose = document.getElementById('md-contract-close');
const btnCloseContract = document.getElementById('btn-close-contract');
const btnPrintContract = document.getElementById('btn-print-contract');
const contractPrintArea = document.getElementById('contract-print-area');

// PWA Install Elements
const pwaInstallBanner = document.getElementById('pwa-install-banner');
const btnPwaInstall = document.getElementById('btn-pwa-install');
const btnPwaClose = document.getElementById('btn-pwa-close');

// Admin Panel DOM tables
const adminUsersTable = document.getElementById('admin-users-table');
const adminRentalsTable = document.getElementById('admin-rentals-table');
const adminToolsTable = document.getElementById('admin-tools-table');

// Backup & Restore Modal Elements
const btnBackupTrigger = document.getElementById('btn-backup-trigger');
const modalBackup = document.getElementById('modal-backup');
const btnExportBackup = document.getElementById('btn-export-backup');
const btnImportBackupTrigger = document.getElementById('btn-import-backup-trigger');
const importBackupFile = document.getElementById('import-backup-file');

// Service Worker Cleanup & Cache Purge
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
  if (window.caches) {
    caches.keys().then(names => {
      for (let name of names) caches.delete(name);
    });
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  setupDateLimits();
  await loadCategories();
  await loadUsers();
  await loadTools();
  await loadAdminPanelData();
  await loadDashboardStats();
  setupPwaInstallPrompt();
});

// Setup Date Limits (cannot rent in the past)
function setupDateLimits() {
  const today = new Date().toISOString().split('T')[0];
  rentStartInput.min = today;
  rentEndInput.min = today;
  
  // Default dates: start is today, end is tomorrow
  rentStartInput.value = today;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  rentEndInput.value = tomorrow.toISOString().split('T')[0];
}

// Load Users from Backend
async function loadUsers() {
  try {
    const res = await fetch('/api/users', { headers: { 'Bypass-Tunnel-Reminder': 'true' } });
    if (!res.ok) return;
    users = await res.json();
    
    if (userSelect) userSelect.innerHTML = '';
    if (rentClientSelect) rentClientSelect.innerHTML = '';

    users.forEach(u => {
      if (userSelect) {
        const option = document.createElement('option');
        option.value = u.id;
        option.textContent = `${u.username} (${u.role === 'admin' ? 'Admin' : 'Utilizator'})`;
        userSelect.appendChild(option);
      }

      if (rentClientSelect && u.username !== 'Admin') {
        const clientOpt = document.createElement('option');
        clientOpt.value = u.id;
        clientOpt.textContent = `${u.username} (${u.email})`;
        rentClientSelect.appendChild(clientOpt);
      }
    });

    const savedUserId = localStorage.getItem('toolshare_user_id');
    const adminUser = users.find(u => u.username === 'Admin') || users[0];
    const targetUserId = (savedUserId && users.some(u => u.id == savedUserId)) ? savedUserId : (adminUser ? adminUser.id : null);

    if (userSelect && targetUserId) {
      userSelect.value = targetUserId;
    }
    
    if (targetUserId) {
      await selectUser(targetUserId);
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

// Select/Switch Active User
async function selectUser(userId) {
  if (!userId) return;
  localStorage.setItem('toolshare_user_id', userId);
  
  try {
    const res = await fetch(`/api/users/${userId}`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } });
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.user) return;
    currentUser = data.user;
    
    if (userBalance) {
      userBalance.textContent = `${formatCurrency(currentUser.balance)}`;
    }
    
    if (tabBtnAdmin) {
      if (currentUser.role === 'admin') {
        tabBtnAdmin.classList.remove('hidden');
      } else {
        tabBtnAdmin.classList.add('hidden');
      }
    }
    
    renderProfileDashboard(data);
    
    if (currentTools.length > 0) {
      renderTools(currentTools);
    }
  } catch (err) {
    console.error('Error selecting user:', err);
  }
}

// Load Tools list from API
async function loadTools() {
  const search = searchInput.value;
  const category = filterCategory.value;
  const status = filterStatus ? filterStatus.value : '';
  const sort = filterSort ? filterSort.value : 'newest';
  
  toolsGrid.innerHTML = '<div class="loading-spinner"></div>';
  
  let url = `/api/tools?`;
  if (search) url += `search=${encodeURIComponent(search)}&`;
  if (category) url += `category=${encodeURIComponent(category)}&`;
  if (status) url += `status=${encodeURIComponent(status)}&`;
  if (sort) url += `sort=${encodeURIComponent(sort)}&`;

  try {
    const res = await fetch(url);
    currentTools = await res.json();
    renderTools(currentTools);
  } catch (err) {
    showToast('Eroare la încărcarea uneltelor.', 'error');
    toolsGrid.innerHTML = '<p class="empty-text">Nu s-au putut încărca uneltele.</p>';
    console.error(err);
  }
}

// Render Tools in Main Grid
function renderTools(tools) {
  toolsGrid.innerHTML = '';
  
  if (tools.length === 0) {
    toolsGrid.innerHTML = '<p class="empty-text">Nicio unealtă nu corespunde criteriilor de căutare.</p>';
    return;
  }

  tools.forEach(tool => {
    const isOwner = currentUser && tool.owner_id === currentUser.id;
    const isRented = tool.status === 'rented';
    
    let badgeHtml = isRented
      ? `<span class="tool-badge badge-rented">Închiriată / Împrumutată</span>`
      : `<span class="tool-badge badge-available">Disponibilă</span>`;

    const priceText = `${formatCurrency(tool.price)} / zi`;
    
    const card = document.createElement('div');
    card.className = 'tool-card card';
    if (selectedToolIds.has(tool.id)) card.classList.add('selected');
    
    card.innerHTML = `
      <div class="tool-card-checkbox" data-select-id="${tool.id}" title="Selectează pentru predare în lot">${selectedToolIds.has(tool.id) ? '✓' : ''}</div>
      <div class="tool-card-header">
        ${badgeHtml}
        <img class="tool-card-img" src="${tool.image_url}" alt="${tool.name}">
      </div>
      <div class="tool-card-body">
        <span class="tool-card-category">${tool.category}</span>
        <h3 class="tool-card-title">${tool.name}</h3>
        <p class="tool-card-desc">${tool.description}</p>
        <div class="tool-card-footer">
          <div class="tool-price-wrapper">
            <span class="tool-price-val">${priceText}</span>
            <span class="tool-price-unit">Magazie</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm ${isRented ? 'btn-outline' : 'btn-primary'} btn-action" data-id="${tool.id}">
              ${isRented ? 'Împrumutată' : 'Împrumută'}
            </button>
            <button class="btn btn-sm btn-danger btn-delete-card-tool" data-id="${tool.id}" title="Șterge utilaj">🗑️</button>
          </div>
        </div>
      </div>
    `;

    // Checkbox click — toggle selection (only for available tools)
    card.querySelector('.tool-card-checkbox').addEventListener('click', (e) => {
      e.stopPropagation();
      if (isRented) {
        showToast('Această sculă este deja împrumutată.', 'error');
        return;
      }
      toggleToolSelection(tool.id, card);
    });
    
    card.querySelector('.btn-action').addEventListener('click', (e) => {
      e.stopPropagation();
      openToolDetail(tool.id);
    });

    card.querySelector('.btn-delete-card-tool').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Sigur dorești să ștergi definitiv utilajul "${tool.name}" din magazie?`)) return;

      try {
        const res = await fetch(`/api/admin/tools/${tool.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`Utilajul "${tool.name}" a fost șters!`, 'success');
        await loadTools();
        await loadDashboardStats();
        await loadAdminPanelData();
      } catch (err) {
        showToast(err.message || 'Eroare la ștergerea utilajului.', 'error');
      }
    });

    card.addEventListener('click', () => {
      openToolDetail(tool.id);
    });

    toolsGrid.appendChild(card);
  });
}

// Open Details Modal for a Tool
async function openToolDetail(toolId) {
  try {
    const res = await fetch(`/api/tools/${toolId}`);
    if (!res.ok) throw new Error();
    selectedTool = await res.json();

    mdName.textContent = selectedTool.name;
    mdCategory.textContent = selectedTool.category;
    mdDesc.textContent = selectedTool.description;
    mdOwner.textContent = selectedTool.owner_name;
    mdImg.src = selectedTool.image_url;
    mdPrice.textContent = `${formatCurrency(selectedTool.price)} / zi`;
    calcDayPrice.textContent = `${formatCurrency(selectedTool.price)}`;

    // Set QR Code Image
    const qrImg = document.getElementById('md-qr-img');
    if (qrImg) {
      const qrData = `${window.location.origin}/?tool=${selectedTool.id}`;
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
    }

    // Set Health Badge
    const healthBadge = document.getElementById('md-health-badge');
    const hStatus = selectedTool.health_status || 'ok';
    if (healthBadge) {
      if (hStatus === 'maintenance') {
        healthBadge.textContent = '🛠️ În Szerviz / Revizie';
        healthBadge.style.background = 'rgba(234, 179, 8, 0.15)';
        healthBadge.style.color = 'var(--orange)';
      } else if (hStatus === 'broken') {
        healthBadge.textContent = '🔴 Defect / Inactiv';
        healthBadge.style.background = 'rgba(239, 68, 68, 0.15)';
        healthBadge.style.color = 'var(--danger)';
      } else {
        healthBadge.textContent = '🟢 Funcțional';
        healthBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        healthBadge.style.color = 'var(--emerald)';
      }
    }

    // Set Datepicker Default Values (Today & Tomorrow)
    setupDateLimits();

    // Always fetch latest users for installer dropdown
    const resUsers = await fetch('/api/users');
    users = await resUsers.json();
    
    rentClientSelect.innerHTML = '';
    const installers = users.filter(u => u.username !== 'Admin');
    if (installers.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '-- Niciun instalator înregistrat (Adaugă din Registru) --';
      rentClientSelect.appendChild(opt);
    } else {
      installers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `👨‍🔧 ${u.username} (${u.email})`;
        rentClientSelect.appendChild(opt);
      });
      rentClientSelect.selectedIndex = 0;
    }

    calculateRentCost();

    const isRented = selectedTool.status === 'rented';
    const isMaintenance = hStatus === 'maintenance' || hStatus === 'broken';

    if (isRented) {
      btnConfirmRent.disabled = true;
      btnConfirmRent.textContent = 'Este împrumutată în acest moment';
    } else if (isMaintenance) {
      btnConfirmRent.disabled = true;
      btnConfirmRent.textContent = '🛠️ În szerviz / reparații (Predare blocată)';
    } else if (installers.length === 0) {
      btnConfirmRent.disabled = true;
      btnConfirmRent.textContent = 'Adaugă mai întâi un instalator';
    } else {
      btnConfirmRent.disabled = false;
      btnConfirmRent.textContent = 'Înregistrează împrumutul';
    }

    modalToolDetail.classList.add('active');
    document.body.classList.add('modal-open');
  } catch (err) {
    showToast('Nu s-au putut încărca detaliile uneltei.', 'error');
  }
}

// Calculate Rental Duration and Cost
function calculateRentCost() {
  if (!selectedTool) return;

  const start = new Date(rentStartInput.value);
  const end = new Date(rentEndInput.value);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    calcDays.textContent = '0 zile';
    calcTotal.textContent = '0 RON';
    btnConfirmRent.disabled = true;
    return;
  }

  if (end < start) {
    calcDays.textContent = 'Perioadă nevalidă';
    calcTotal.textContent = '0 RON';
    btnConfirmRent.disabled = true;
    showToast('Data de returnare nu poate fi înainte de data de luare!', 'error');
    return;
  }

  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  calcDays.textContent = `${diffDays} ${diffDays === 1 ? 'zi' : 'zile'}`;
  const total = diffDays * selectedTool.price;
  calcTotal.textContent = `${formatCurrency(total)}`;
  
  if (selectedTool.status === 'available') {
    btnConfirmRent.disabled = false;
  }
}

// Confirm and process tool rental/borrowing
btnConfirmRent.addEventListener('click', async () => {
  if (!selectedTool) return;

  const renter_id = rentClientSelect.value;
  if (!renter_id) {
    showToast('Vă rugăm să selectați persoana care împrumută!', 'error');
    return;
  }

  const start = rentStartInput.value;
  const end = rentEndInput.value;
  const startD = new Date(start);
  const endD = new Date(end);
  const diffDays = Math.ceil(Math.abs(endD - startD) / (1000 * 60 * 60 * 24)) + 1;
  const totalPrice = diffDays * selectedTool.price;

  btnConfirmRent.disabled = true;
  btnConfirmRent.textContent = 'Se înregistrează...';

  try {
    const res = await fetch(`/api/tools/${selectedTool.id}/rent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        renter_id,
        start_date: start,
        end_date: end,
        total_price: totalPrice
      })
    });

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Tranzacție eșuată');
    }

    showToast('Împrumut înregistrat cu succes!', 'success');
    closeAllModals();
    if (currentUser) await selectUser(currentUser.id);
    await loadTools();
  } catch (err) {
    showToast(err.message || 'Eroare la procesarea împrumutului.', 'error');
    btnConfirmRent.disabled = false;
    btnConfirmRent.textContent = 'Înregistrează împrumutul';
  }
});

// Render User Profile & Borrowing History
function renderProfileDashboard(userData) {
  if (!userData || !userData.user) return;
  document.getElementById('profile-name').textContent = userData.user.username;
  document.getElementById('profile-email').textContent = userData.user.email;
  document.getElementById('profile-initials').textContent = userData.user.username.charAt(0).toUpperCase();

  document.getElementById('stat-listed').textContent = userData.listedTools.length;
  
  const activeRentals = userData.rentals.filter(r => r.status === 'active');
  document.getElementById('stat-rented').textContent = activeRentals.length;

  // Render Borrowed Tools (Who, When borrowed, When expected return)
  const rentalsList = document.getElementById('profile-rentals');
  rentalsList.innerHTML = '';
  
  if (userData.rentals.length === 0) {
    rentalsList.innerHTML = '<p class="empty-text">Nu ai niciun împrumut înregistrat.</p>';
  } else {
    const groupedRentals = groupRentals(userData.rentals);

    groupedRentals.forEach(rental => {
      const item = document.createElement('div');
      item.className = 'profile-item';
      
      const isActive = rental.status === 'active';
      const statusBadge = isActive 
        ? `<span class="badge badge-accent">Activ (Returnare: ${rental.end_date})</span>`
        : `<span class="badge" style="background-color: rgba(255,255,255,0.05); color: var(--text-muted)">Returnată</span>`;
      
      const activeToolIds = rental.tools.filter(t => t.status === 'active').map(t => t.id).join(',');

      const actionButtons = `
        <button class="btn btn-sm btn-outline btn-contract" data-rental-id="${rental.id}">Proces-Verbal (PDF)</button>
        ${isActive ? `
          <button class="btn btn-sm btn-outline btn-extend" data-ids="${activeToolIds}" data-end="${rental.end_date}">Prelungește</button>
          <button class="btn btn-sm btn-primary btn-return" data-rental-id="${rental.id}">Returnează</button>
        ` : ''}
      `;

      item.innerHTML = `
        <img class="profile-item-img" src="${rental.image_url}" alt="${rental.display_name}">
        <div class="profile-item-details">
          <div class="profile-item-name">${rental.display_name}</div>
          <div class="profile-item-meta">Proprietar: ${rental.owner_name} | Perioadă: <span>${rental.start_date} -> ${rental.end_date}</span> | ${statusBadge}</div>
        </div>
        <div>
          <div class="profile-item-price">${formatCurrency(rental.total_price)}</div>
          <div style="margin-top: 6px; display: flex; gap: 6px; justify-content: flex-end;">${actionButtons}</div>
        </div>
      `;

      item.querySelector('.btn-contract').addEventListener('click', () => {
        openContractModal(rental.id);
      });

      if (isActive) {
        item.querySelector('.btn-extend').addEventListener('click', (e) => {
          const ids = e.target.getAttribute('data-ids');
          openExtendModal(ids, rental.end_date);
        });

        item.querySelector('.btn-return').addEventListener('click', async (e) => {
          const btn = e.target;
          btn.disabled = true;
          btn.textContent = 'Se returnează...';
          
          try {
            const activeTools = rental.tools.filter(t => t.status === 'active');
            await Promise.all(activeTools.map(t => fetch(`/api/rentals/${t.id}/return`, { method: 'POST' })));
            showToast('Utilaj(ele) returnat(e) cu succes!', 'success');
            await selectUser(currentUser.id);
            await loadTools();
          } catch (err) {
            showToast('Eroare la returnare.', 'error');
            btn.disabled = false;
            btn.textContent = 'Returnează';
          }
        });
      }

      rentalsList.appendChild(item);
    });
  }

  // Render My Offered Tools
  const listingsList = document.getElementById('profile-listings');
  listingsList.innerHTML = '';
  
  if (userData.listedTools.length === 0) {
    listingsList.innerHTML = '<p class="empty-text">Nu ai adăugat nicio unealtă proprie.</p>';
  } else {
    userData.listedTools.forEach(tool => {
      const item = document.createElement('div');
      item.className = 'profile-item';
      
      let statusText = tool.status === 'rented' 
        ? '<span style="color: var(--danger)">Împrumutată în prezent</span>'
        : '<span style="color: var(--success)">Disponibilă</span>';

      item.innerHTML = `
        <img class="profile-item-img" src="${tool.image_url}" alt="${tool.name}">
        <div class="profile-item-details">
          <div class="profile-item-name">${tool.name}</div>
          <div class="profile-item-meta">${tool.category} | Status: ${statusText}</div>
        </div>
        <div class="profile-item-price">
          ${formatCurrency(tool.price)}/zi
        </div>
      `;
      listingsList.appendChild(item);
    });
  }
}

// Admin Panel Fetch & Render Logic
async function loadAdminPanelData() {
  try {
    const resUsers = await fetch('/api/users');
    const allUsers = await resUsers.json();
    renderAdminUsers(allUsers);

    const resRentals = await fetch('/api/admin/rentals');
    const allRentals = await resRentals.json();
    renderAdminRentals(allRentals);

    const resTools = await fetch('/api/admin/tools');
    const allTools = await resTools.json();
    renderAdminTools(allTools);

  } catch (err) {
    console.error('Error loading admin panel data:', err);
  }
}

// Render Installers list in Admin Registru
async function renderAdminUsers(userList) {
  adminUsersTable.innerHTML = '';

  try {
    const statsRes = await fetch('/api/dashboard/stats');
    const statsData = await statsRes.json();
    const instStatsMap = {};
    if (statsData && statsData.installerStats) {
      statsData.installerStats.forEach(i => { instStatsMap[i.id] = i.active_tools; });
    }

    const installers = userList.filter(u => u.username !== 'Admin');
    if (installers.length === 0) {
      adminUsersTable.innerHTML = `<tr><td colspan="5" class="empty-text" style="text-align: center; padding: 24px;">Niciun instalator înregistrat în sistem. Apasă pe <strong>"+ Adaugă Instalator Nou"</strong> pentru a crea primii instalatori.</td></tr>`;
      return;
    }

    installers.forEach(u => {
      const tr = document.createElement('tr');
      const activeToolsCount = instStatsMap[u.id] || 0;

      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--text-primary);">👨‍🔧 ${u.username}</td>
        <td>${u.email}</td>
        <td><span class="badge badge-outline" style="border: 1px solid var(--border); color: var(--text-secondary);">INSTALATOR</span></td>
        <td><span class="badge ${activeToolsCount > 0 ? 'badge-accent' : ''}" style="${activeToolsCount === 0 ? 'background-color: rgba(255,255,255,0.05); color: var(--text-muted);' : ''}">${activeToolsCount} utilaje în custodie</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-outline btn-edit-user" data-id="${u.id}">Editează</button>
            <button class="btn btn-sm btn-danger btn-delete-user" data-id="${u.id}">Șterge</button>
          </div>
        </td>
      `;

      tr.querySelector('.btn-edit-user').addEventListener('click', () => {
        editUserIdInput.value = u.id;
        editUsernameInput.value = u.username;
        editEmailInput.value = u.email;
        editBalanceInput.value = u.balance;
        editRoleSelect.value = u.role;

        modalEditUser.classList.add('active');
        document.body.classList.add('modal-open');
      });

      const btnDelete = tr.querySelector('.btn-delete-user');
      if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
          if (!confirm(`Sigur dorești să ștergi instalatorul "${u.username}" și toate împrumuturile asociate?`)) return;

          try {
            const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showToast(`Instalatorul "${u.username}" a fost șters din registru!`, 'success');
            await loadUsers();
            await loadAdminPanelData();
            await loadDashboardStats();
          } catch (err) {
            showToast(err.message || 'Eroare la ștergerea instalatorului.', 'error');
          }
        });
      }

      adminUsersTable.appendChild(tr);
    });
  } catch (err) {
    console.error('Error rendering admin users:', err);
  }
}

// Render Master Borrowing Log in Admin Panel (Who, When borrowed, When expected return date)
function renderAdminRentals(rentalList) {
  adminRentalsTable.innerHTML = '';
  
  if (rentalList.length === 0) {
    adminRentalsTable.innerHTML = `<tr><td colspan="8" class="empty-text" style="text-align: center;">Niciun împrumut înregistrat în sistem.</td></tr>`;
    return;
  }

  const groupedRentals = groupRentals(rentalList);

  groupedRentals.forEach(r => {
    const tr = document.createElement('tr');
    const isActive = r.status === 'active';
    
    const statusLabel = isActive 
      ? `<span class="badge badge-accent">Împrumut Activ</span>`
      : `<span class="badge" style="background-color: rgba(255,255,255,0.05); color: var(--text-muted)">Returnată</span>`;
    
    // Convert active tools in group to comma-separated list for extend modal
    const activeToolIds = r.tools.filter(t => t.status === 'active').map(t => t.id).join(',');

    const actionBtns = `
      <div style="display: flex; gap: 4px; flex-wrap: wrap;">
        <button class="btn btn-sm btn-outline btn-admin-contract" data-id="${r.id}" title="Descarcă Proces-Verbal PDF">PDF</button>
        ${isActive ? `
          <button class="btn btn-sm btn-quick-return btn-admin-quick-return" data-id="${r.id}" title="Returnare rapidă">✅ Visszavettem</button>
          <button class="btn btn-sm btn-outline btn-admin-extend" data-ids="${activeToolIds}" data-end="${r.end_date}">Prelungește</button>
          <button class="btn btn-sm btn-danger btn-admin-cancel" data-id="${r.id}">Forțează</button>
        ` : ''}
      </div>
    `;

    tr.innerHTML = `
      <td>#${r.id}</td>
      <td style="font-weight: 600; color: var(--text-primary);">${r.display_name}</td>
      <td style="color: var(--cyan); font-weight: 600;">${r.renter_name}</td>
      <td>${r.owner_name}</td>
      <td>${r.start_date}</td>
      <td style="font-weight: 600;">${r.end_date}</td>
      <td>${statusLabel}</td>
      <td>${actionBtns}</td>
    `;

    tr.querySelector('.btn-admin-contract').addEventListener('click', () => {
      openContractModal(r.id);
    });

    if (isActive) {
      // Quick Return — no confirmation, instant action (batch)
      tr.querySelector('.btn-admin-quick-return').addEventListener('click', async (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = '⏳...';
        try {
          const activeTools = r.tools.filter(t => t.status === 'active');
          await Promise.all(activeTools.map(t => 
            fetch(`/api/admin/rentals/${t.id}/cancel`, { method: 'POST' }).then(res => {
              if (!res.ok) throw new Error();
            })
          ));
          showToast(`✅ „${r.display_name}" visszavéve (${r.renter_name})`, 'success');
          await loadAdminPanelData();
          await loadTools();
        } catch (err) {
          showToast('Eroare la returnare.', 'error');
          btn.disabled = false;
          btn.textContent = '✅ Visszavettem';
        }
      });

      tr.querySelector('.btn-admin-extend').addEventListener('click', (e) => {
        const ids = e.target.getAttribute('data-ids');
        openExtendModal(ids, r.end_date); // we pass comma-separated ids now
      });

      // Force Return (batch)
      tr.querySelector('.btn-admin-cancel').addEventListener('click', async () => {
        if (!confirm(`Sigur dorești să forțezi înregistrarea ca returnată pentru:\n${r.display_name}\nîmprumutat(e) de ${r.renter_name}?`)) return;
        
        try {
          const activeTools = r.tools.filter(t => t.status === 'active');
          await Promise.all(activeTools.map(t => fetch(`/api/admin/rentals/${t.id}/cancel`, { method: 'POST' })));
          
          showToast('Utilaj(ele) marcate ca returnate de Admin.', 'success');
          await loadAdminPanelData();
          await loadTools();
        } catch (err) {
          showToast('Eroare la returnarea forțată.', 'error');
        }
      });
    }

    adminRentalsTable.appendChild(tr);
  });
}

// Render all tools in system (Admin view)
function renderAdminTools(toolList) {
  adminToolsTable.innerHTML = '';
  
  if (toolList.length === 0) {
    adminToolsTable.innerHTML = `<tr><td colspan="7" class="empty-text" style="text-align: center;">Nicio unealtă înregistrată.</td></tr>`;
    return;
  }

  toolList.forEach(t => {
    const tr = document.createElement('tr');
    
    let statusBadge = t.status === 'available'
      ? `<span class="badge badge-available">Disponibilă</span>`
      : `<span class="badge badge-rented">Împrumutată</span>`;

    tr.innerHTML = `
      <td>#${t.id}</td>
      <td style="font-weight: 600; color: var(--text-primary);">${t.name}</td>
      <td>${t.owner_name}</td>
      <td>${t.category}</td>
      <td>${formatCurrency(t.price)}/zi</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-sm btn-danger btn-admin-delete" data-id="${t.id}">Șterge</button>
      </td>
    `;

    tr.querySelector('.btn-admin-delete').addEventListener('click', async () => {
      if (!confirm(`Sigur dorești să ștergi unealta "${t.name}" din registrul central?`)) return;

      try {
        const res = await fetch(`/api/admin/tools/${t.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        
        showToast('Unealtă ștearsă din sistem.', 'success');
        await loadAdminPanelData();
        await loadTools();
      } catch (err) {
        showToast('Eroare la ștergerea uneltei.', 'error');
      }
    });

    adminToolsTable.appendChild(tr);
  });
}

// Deposit Form handler
depositForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const amount = parseInt(depositAmountInput.value);
  if (isNaN(amount) || amount <= 0) {
    showToast('Introdu o sumă validă!', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/users/${currentUser.id}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });

    if (!res.ok) throw new Error();
    
    showToast(`Soldul tău a fost alimentat cu ${formatCurrency(amount)}!`, 'success');
    closeAllModals();
    await selectUser(currentUser.id);
  } catch (err) {
    showToast('Eroare la alimentarea soldului.', 'error');
  }
});

// Listing a new tool form handler
listToolForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('tool-name').value.trim();
  const category = document.getElementById('tool-category').value;
  const price = parseFloat(document.getElementById('tool-price').value);
  const description = document.getElementById('tool-description').value.trim();
  const image_url = document.getElementById('tool-image').value;
  const owner_id = (currentUser && currentUser.id) ? currentUser.id : 1;

  if (!name || !category || isNaN(price) || !description) {
    showToast('Vă rugăm să completați toate câmpurile obligatorii!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/tools', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true'
      },
      body: JSON.stringify({
        owner_id,
        name,
        description,
        category,
        price,
        image_url
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(`Utilajul "${name}" a fost adăugat cu succes în magazie!`, 'success');
    listToolForm.reset();
    
    document.getElementById('tab-btn-browse').click();
    await loadTools();
    await loadDashboardStats();
    await loadAdminPanelData();
  } catch (err) {
    showToast(err.message || 'Eroare la adăugarea utilajului.', 'error');
  }
});

// Add User form handler
addUserForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = newUsernameInput.value.trim();
  const email = newEmailInput.value.trim();
  const balance = parseFloat(newBalanceInput.value) || 100;
  const role = newRoleSelect.value;

  if (!username || !email) {
    showToast('Numele și contactul sunt obligatorii!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true'
      },
      body: JSON.stringify({ username, email, balance, role })
    });

    let data;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      throw new Error('Răspuns invalid de la server. Vă rugăm reîncărcați pagina.');
    }

    if (!res.ok) throw new Error(data.error || 'Eroare la crearea instalatorului.');

    showToast(`Instalatorul "${username}" a fost adăugat în registru!`, 'success');
    addUserForm.reset();
    closeAllModals();
    
    await loadUsers();
    await loadAdminPanelData();
    await loadDashboardStats();
  } catch (err) {
    showToast(err.message || 'Eroare la adăugarea instalatorului.', 'error');
  }
});

// Edit User form handler
editUserForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const userId = editUserIdInput.value;
  const username = editUsernameInput.value.trim();
  const email = editEmailInput.value.trim();
  const balance = parseFloat(editBalanceInput.value) || 0;
  const role = editRoleSelect.value;

  if (!username || !email) {
    showToast('Numele și emailul sunt obligatorii!', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, balance, role })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(`Datele utilizatorului "${username}" au fost salvate!`, 'success');
    closeAllModals();

    await loadUsers();
    if (currentUser.id == userId) {
      await selectUser(userId);
    }
    await loadAdminPanelData();
  } catch (err) {
    showToast(err.message || 'Eroare la actualizarea utilizatorului.', 'error');
  }
});

// Open Extend Rental Modal
async function openExtendModal(rentalIdsStr, currentEndDate) {
  try {
    const firstId = rentalIdsStr.toString().split(',')[0];
    const res = await fetch(`/api/rentals/${firstId}/contract`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    // Sum of daily prices for all active tools in this group
    const activeItems = data.items.filter(i => rentalIdsStr.includes(i.rental_id.toString()));
    const totalDailyPrice = activeItems.reduce((sum, item) => sum + item.daily_price, 0);

    window.currentExtendItems = activeItems;
    extendRentalIdInput.value = rentalIdsStr;
    extendDailyPriceInput.value = totalDailyPrice;
    extendCurrentEndInput.value = currentEndDate;

    const curEnd = new Date(currentEndDate);
    curEnd.setDate(curEnd.getDate() + 1);
    const minDateStr = curEnd.toISOString().split('T')[0];

    extendNewEndInput.min = minDateStr;
    extendNewEndInput.value = minDateStr;

    calculateExtendCost();

    modalExtendRental.classList.add('active');
    document.body.classList.add('modal-open');
  } catch (err) {
    showToast('Nu s-au putut încărca datele pentru prelungire.', 'error');
  }
}

function calculateExtendCost() {
  const currentEnd = new Date(extendCurrentEndInput.value);
  const newEnd = new Date(extendNewEndInput.value);
  const dailyPrice = parseFloat(extendDailyPriceInput.value) || 0;

  if (isNaN(currentEnd.getTime()) || isNaN(newEnd.getTime()) || newEnd <= currentEnd) {
    extendCalcDays.textContent = '0 zile';
    extendCalcTotal.textContent = '0 RON';
    btnConfirmExtend.disabled = true;
    return;
  }

  const diffTime = Math.abs(newEnd - currentEnd);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  extendCalcDays.textContent = `${diffDays} ${diffDays === 1 ? 'zi' : 'zile'}`;
  const totalCost = diffDays * dailyPrice;
  extendCalcTotal.textContent = formatCurrency(totalCost);
  btnConfirmExtend.disabled = false;
}

extendNewEndInput.addEventListener('change', calculateExtendCost);

extendRentalForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const new_end_date = extendNewEndInput.value;
  const currentEnd = new Date(extendCurrentEndInput.value);
  const newEnd = new Date(new_end_date);
  
  const diffTime = Math.abs(newEnd - currentEnd);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  btnConfirmExtend.disabled = true;
  btnConfirmExtend.textContent = 'Se prelungeste...';

  try {
    if (window.currentExtendItems && window.currentExtendItems.length > 0) {
      await Promise.all(window.currentExtendItems.map(item => {
        const itemAdditionalPrice = diffDays * item.daily_price;
        return fetch(`/api/rentals/${item.rental_id}/extend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_end_date, additional_price: itemAdditionalPrice })
        }).then(res => {
          if (!res.ok) throw new Error();
        });
      }));
    }

    showToast('Împrumut(uri) prelungit(e) cu succes!', 'success');
    closeAllModals();

    if (currentUser) await selectUser(currentUser.id);
    await loadTools();
    if (typeof loadAdminPanelData === 'function') await loadAdminPanelData();
  } catch (err) {
    showToast('Eroare la prelungirea împrumutului.', 'error');
  } finally {
    btnConfirmExtend.disabled = false;
    btnConfirmExtend.textContent = 'Salvează Prelungirea';
  }
});

// Open Printable Contract / Proces-Verbal Modal
async function openContractModal(rentalId) {
  try {
    const res = await fetch(`/api/rentals/${rentalId}/contract`);
    if (!res.ok) throw new Error();
    const c = await res.json();

    const todayStr = new Date().toLocaleDateString('ro-RO');
    const maxEndDate = c.items.reduce((max, item) => item.end_date > max ? item.end_date : max, c.start_date);

    contractPrintArea.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 12px;">
        <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; color: #0f172a;">PROCES-VERBAL DE PREDARE-PRIMIRE ECHIPAMENTE</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Nr. Înregistrare: #${c.id} | Data eliberării: ${todayStr}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; font-size: 13px;">
        <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <strong style="color: #0f172a; display: block; margin-bottom: 2px;">PREDĂTOR (Proprietar):</strong>
          <div>Nume: <strong>${c.owner_name}</strong></div>
          <div>Email: ${c.owner_email}</div>
        </div>

        <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <strong style="color: #0f172a; display: block; margin-bottom: 2px;">PRIMITOR (Chiriaș):</strong>
          <div>Nume: <strong>${c.renter_name}</strong></div>
          <div>Email: ${c.renter_email}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; text-align: left;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 6px;">Denumire Echipament</th>
            <th style="padding: 6px;">Categorie</th>
            <th style="padding: 6px;">Perioadă Împrumut</th>
            <th style="padding: 6px; text-align: right;">Valoare Totală</th>
          </tr>
        </thead>
        <tbody>
          ${c.items.map(item => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 6px; font-weight: 600;">${item.tool_name}</td>
              <td style="padding: 8px 6px;">${item.tool_category}</td>
              <td style="padding: 8px 6px;">${c.start_date} &rarr; ${item.end_date}</td>
              <td style="padding: 8px 6px; text-align: right; font-weight: 700;">${formatCurrency(item.total_price)}</td>
            </tr>
          `).join('')}
          <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
            <td colspan="3" style="padding: 8px 6px; text-align: right;">TOTAL GENERAL CONTRACT:</td>
            <td style="padding: 8px 6px; text-align: right; font-weight: 800; color: #007aff;">${formatCurrency(c.total_contract_price)}</td>
          </tr>
        </tbody>
      </table>

      <div style="font-size: 12px; color: #475569; margin-bottom: 24px; line-height: 1.4; background: #fffbeb; border: 1px solid #fef3c7; padding: 8px; border-radius: 6px;">
        Primitorul declară că a preluat echipamentele de mai sus în stare bună de funcționare și se obligă să le restituie cel târziu la data de <strong>${maxEndDate}</strong>.
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 30px; font-size: 12px;">
        <div style="text-align: center; width: 45%;">
          <div style="border-bottom: 1px dashed #94a3b8; padding-bottom: 30px; font-weight: 600;">Semnătură Predător (${c.owner_name})</div>
        </div>
        <div style="text-align: center; width: 45%;">
          <div style="border-bottom: 1px dashed #94a3b8; padding-bottom: 30px; font-weight: 600;">Semnătură Primitor (${c.renter_name})</div>
        </div>
      </div>
    `;

    modalContract.classList.add('active');
    document.body.classList.add('modal-open');
  } catch (err) {
    showToast('Nu s-a putut genera procesul-verbal.', 'error');
  }
}

// Load Executive Dashboard Stats and Visual Charts
async function loadDashboardStats() {
  try {
    const res = await fetch('/api/dashboard/stats');
    if (!res.ok) return;
    const stats = await res.json();

    const elTotal = document.getElementById('db-stat-total');
    if (elTotal) elTotal.textContent = stats.totalTools;
    const elAvailable = document.getElementById('db-stat-available');
    if (elAvailable) elAvailable.textContent = stats.availableTools;
    const elRented = document.getElementById('db-stat-rented');
    if (elRented) elRented.textContent = stats.rentedTools;
    const elOverdue = document.getElementById('db-stat-overdue');
    if (elOverdue) elOverdue.textContent = stats.overdueCount;
    const elInstallers = document.getElementById('db-stat-installers');
    if (elInstallers) elInstallers.textContent = stats.totalInstallers;

    // Render Utilization Rate Progress Bar
    const utilBar = document.getElementById('db-utilization-bar');
    const utilText = document.getElementById('db-utilization-text');
    if (utilBar && utilText) {
      const pct = stats.utilizationRate || 0;
      utilBar.style.width = pct + '%';
      utilText.textContent = `${pct}% grad de ocupare pe teren`;
    }

    // Render Category Chips
    const chipsContainer = document.getElementById('db-category-chips');
    if (chipsContainer && stats.categoryStats) {
      chipsContainer.innerHTML = '';
      const allChip = document.createElement('div');
      allChip.className = 'category-chip active';
      allChip.innerHTML = `Toate <span class="category-chip-count">${stats.totalTools}</span>`;
      allChip.addEventListener('click', () => {
        filterCategory.value = '';
        document.getElementById('tab-btn-browse').click();
        loadTools();
      });
      chipsContainer.appendChild(allChip);

      stats.categoryStats.forEach(cat => {
        const chip = document.createElement('div');
        chip.className = 'category-chip';
        chip.innerHTML = `${cat.category} <span class="category-chip-count">${cat.count}</span>`;
        chip.addEventListener('click', () => {
          filterCategory.value = cat.category;
          document.getElementById('tab-btn-browse').click();
          loadTools();
        });
        chipsContainer.appendChild(chip);
      });
    }

    // Render Installer breakdown chart bars
    const breakdownContainer = document.getElementById('db-installer-breakdown');
    if (breakdownContainer) {
      breakdownContainer.innerHTML = '';
      if (!stats.installerStats || stats.installerStats.length === 0) {
        breakdownContainer.innerHTML = '<p class="empty-text">Niciun instalator înregistrat.</p>';
      } else {
        const maxTools = Math.max(...stats.installerStats.map(i => i.active_tools), 1);
        stats.installerStats.forEach(inst => {
          const pct = Math.round((inst.active_tools / maxTools) * 100);
          const div = document.createElement('div');
          div.className = 'breakdown-item';
          div.innerHTML = `
            <div class="breakdown-header">
              <span>👨‍🔧 ${inst.username}</span>
              <span style="color: ${inst.active_tools > 0 ? 'var(--cyan)' : 'var(--text-muted)'}; font-weight: 700;">${inst.active_tools} utilaje pe teren</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: ${inst.active_tools > 0 ? Math.max(pct, 10) : 0}%;"></div>
            </div>
          `;
          breakdownContainer.appendChild(div);
        });
      }
    }

    // Render Overdue Alerts List
    const overdueContainer = document.getElementById('db-overdue-list');
    if (overdueContainer) {
      overdueContainer.innerHTML = '';

      const rentalsRes = await fetch('/api/admin/rentals');
      const allRentals = await rentalsRes.json();
      const todayStr = new Date().toISOString().split('T')[0];
      const overdueRentals = allRentals.filter(r => r.status === 'active' && r.end_date < todayStr);

      if (overdueRentals.length === 0) {
        overdueContainer.innerHTML = '<p class="empty-text" style="color: var(--emerald);">✅ Toate returnările sunt la zi! Nicio sculă cu termen depășit.</p>';
      } else {
        overdueRentals.forEach(r => {
          const item = document.createElement('div');
          item.className = 'overdue-item';
          
          const targetUser = users ? users.find(u => u.id === r.renter_id) : null;
          const rawPhone = (targetUser && targetUser.phone) ? targetUser.phone : r.renter_email;
          const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '') : '';
          const finalPhone = cleanPhone.startsWith('0') ? '40' + cleanPhone.substring(1) : cleanPhone;

          const waMsg = encodeURIComponent(`Salut ${r.renter_name}! Utilajul "${r.tool_name}" preluat din magazie trebuia returnat la data de ${r.end_date}. Când poți trece pe la magazie pentru predare? Mulțumesc!`);
          const waUrl = finalPhone ? `https://wa.me/${finalPhone}?text=${waMsg}` : `https://wa.me/?text=${waMsg}`;

          item.innerHTML = `
            <div class="overdue-details">
              <span class="overdue-tool-name">⚠️ ${r.tool_name}</span>
              <span class="overdue-meta">Custode: <strong>${r.renter_name}</strong> | Retur: <strong>${r.end_date}</strong></span>
            </div>
            <div style="display: flex; gap: 6px;">
              <a href="${waUrl}" target="_blank" class="btn btn-sm" style="background: #25d366; color: #fff; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">💬 WhatsApp</a>
              <button class="btn btn-sm btn-danger btn-return-overdue" data-id="${r.id}">Preluat înapoi</button>
            </div>
          `;
          item.querySelector('.btn-return-overdue').addEventListener('click', async () => {
            try {
              const res = await fetch(`/api/rentals/${r.id}/return`, { method: 'POST' });
              if (!res.ok) throw new Error();
              showToast('Utilaj marcat ca preluat înapoi!', 'success');
              await loadDashboardStats();
              await loadTools();
              await loadAdminPanelData();
            } catch (err) {
              showToast('Eroare la marcarea returnării.', 'error');
            }
          });
          overdueContainer.appendChild(item);
        });
      }
    }

    // Render Chrono-Log Activity Feed
    const chronoContainer = document.getElementById('db-chrono-feed');
    if (chronoContainer) {
      chronoContainer.innerHTML = '';
      if (!stats.recentActivity || stats.recentActivity.length === 0) {
        chronoContainer.innerHTML = '<p class="empty-text">Nicio activitate înregistrată recent.</p>';
      } else {
        stats.recentActivity.forEach(act => {
          const item = document.createElement('div');
          item.className = 'chrono-item';
          const isActive = act.status === 'active';

          item.innerHTML = `
            <div class="chrono-icon" style="background: ${isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color: ${isActive ? 'var(--cyan)' : 'var(--emerald)'};">
              ${isActive ? '📦' : '✅'}
            </div>
            <div class="chrono-text">
              <strong>${act.renter_name}</strong> a ${isActive ? 'preluat' : 'returnat'} <strong>${act.tool_name}</strong>
              <div class="chrono-time">Perioadă: ${act.start_date} -> ${act.end_date}</div>
            </div>
          `;
          chronoContainer.appendChild(item);
        });
      }
    }

  } catch (err) {
    console.error('Error loading dashboard stats:', err);
  }
}

// Global Categories State
let categories = [];

// Load Categories from API
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    categories = await res.json();
    
    renderCategoriesTable(categories);
    populateCategoryDropdowns(categories);
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

// Render Categories Management Table
function renderCategoriesTable(catList) {
  const categoriesTableBody = document.getElementById('categories-table-body');
  if (!categoriesTableBody) return;

  categoriesTableBody.innerHTML = '';
  if (catList.length === 0) {
    categoriesTableBody.innerHTML = `<tr><td colspan="4" class="empty-text">Nicio categorie definită.</td></tr>`;
    return;
  }

  catList.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${c.icon || '/images/default.svg'}" style="width: 26px; height: 26px; vertical-align: middle;"></td>
      <td style="font-weight: 600; color: var(--text-primary);">${c.name}</td>
      <td><span class="badge" style="background: rgba(255,255,255,0.05); color: var(--cyan);">${c.tool_count || 0} utilaje</span></td>
      <td>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-sm btn-outline btn-edit-cat" data-id="${c.id}">Editează</button>
          <button class="btn btn-sm btn-danger btn-delete-cat" data-id="${c.id}">Șterge</button>
        </div>
      </td>
    `;

    tr.querySelector('.btn-edit-cat').addEventListener('click', () => editCategory(c));
    tr.querySelector('.btn-delete-cat').addEventListener('click', () => deleteCategory(c));

    categoriesTableBody.appendChild(tr);
  });
}

// Populate Category Dropdowns across Application
function populateCategoryDropdowns(catList) {
  // 1. Filter dropdown in Catalog
  if (filterCategory) {
    const currentVal = filterCategory.value;
    filterCategory.innerHTML = `<option value="">Toate categoriile</option>`;
    catList.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      filterCategory.appendChild(opt);
    });
    filterCategory.value = currentVal;
  }

  // 2. Add Tool Form category dropdown
  const toolCategorySelect = document.getElementById('tool-category');
  if (toolCategorySelect) {
    const currentVal = toolCategorySelect.value;
    toolCategorySelect.innerHTML = `<option value="" disabled selected>Alege categoria *</option>`;
    catList.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      toolCategorySelect.appendChild(opt);
    });
    if (currentVal) toolCategorySelect.value = currentVal;
  }
}

// Edit/Rename Category
async function editCategory(cat) {
  const newName = prompt(`Redenumește categoria "${cat.name}":`, cat.name);
  if (!newName || newName.trim() === '' || newName.trim() === cat.name) return;

  try {
    const res = await fetch(`/api/categories/${cat.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), icon: cat.icon })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(`Categoria a fost redenumită în "${newName.trim()}"!`, 'success');
    await loadCategories();
    await loadTools();
  } catch (err) {
    showToast(err.message || 'Eroare la redactarea categoriei.', 'error');
  }
}

// Delete Category
async function deleteCategory(cat) {
  if (!confirm(`Sigur dorești să ștergi categoria "${cat.name}"?`)) return;

  try {
    const res = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(`Categoria "${cat.name}" a fost ștearsă!`, 'success');
    await loadCategories();
  } catch (err) {
    showToast(err.message || 'Eroare la ștergerea categoriei.', 'error');
  }
}

// Setup DOM Event Listeners
function setupEventListeners() {
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      const target = tab.dataset.target;
      const targetEl = document.getElementById(target);
      if (targetEl) targetEl.classList.add('active');
      
      if (target === 'tab-dashboard') {
        loadDashboardStats();
      }
      if (target === 'tab-rentals' || target === 'tab-installers') {
        loadAdminPanelData();
      }
      if (target === 'tab-browse') {
        loadTools();
      }
    });
  });

  const btnAddInstallerPage = document.getElementById('btn-add-installer-page');
  if (btnAddInstallerPage) {
    btnAddInstallerPage.addEventListener('click', () => {
      modalAddUser.classList.add('active');
      document.body.classList.add('modal-open');
    });
  }

  // Theme Switcher Logic (Default: Light Mode)
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
      if (btnThemeToggle) btnThemeToggle.textContent = '🌙 Mod Întunecat';
    } else {
      document.body.classList.remove('dark-theme');
      if (btnThemeToggle) btnThemeToggle.textContent = '☀️ Mod Luminos';
    }
    localStorage.setItem('toolshare_theme', theme);
  }

  const savedTheme = localStorage.getItem('toolshare_theme') || 'light';
  applyTheme(savedTheme);

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-theme');
      applyTheme(isDark ? 'light' : 'dark');
    });
  }

  // CSV Export Trigger
  const btnExportCsv = document.getElementById('btn-export-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      window.open('/api/export/csv?type=tools', '_blank');
      showToast('Export inventar scule descărcat în Excel/CSV!', 'success');
    });
  }

  // Category Manager Modal Trigger
  const btnCategoriesTrigger = document.getElementById('btn-categories-trigger');
  const modalCategories = document.getElementById('modal-categories');
  if (btnCategoriesTrigger && modalCategories) {
    btnCategoriesTrigger.addEventListener('click', () => {
      modalCategories.classList.add('active');
      document.body.classList.add('modal-open');
    });
  }

  // Add Category Form Handler
  const addCategoryForm = document.getElementById('add-category-form');
  if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const catNameInput = document.getElementById('new-cat-name');
      const catIconInput = document.getElementById('new-cat-icon');
      const name = catNameInput.value.trim();
      const icon = catIconInput.value;

      if (!name) return;

      try {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, icon })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`Categorie noua "${name}" adăugată!`, 'success');
        catNameInput.value = '';
        await loadCategories();
      } catch (err) {
        showToast(err.message || 'Eroare la adăugarea categoriei.', 'error');
      }
    });
  }

  // Live Icon Preview Handler
  const toolImageSelect = document.getElementById('tool-image');
  const iconPreviewImg = document.getElementById('icon-preview-img');
  if (toolImageSelect && iconPreviewImg) {
    toolImageSelect.addEventListener('change', () => {
      iconPreviewImg.src = toolImageSelect.value;
    });
  }

  // Quick Action Hub Listeners
  const qaRent = document.getElementById('qa-rent-tool');
  if (qaRent) {
    qaRent.addEventListener('click', () => {
      document.getElementById('tab-btn-browse').click();
    });
  }

  const qaAddTool = document.getElementById('qa-add-tool');
  if (qaAddTool) {
    qaAddTool.addEventListener('click', () => {
      document.getElementById('tab-btn-list').click();
    });
  }

  const qaAddInstaller = document.getElementById('qa-add-installer');
  if (qaAddInstaller && modalAddUser) {
    qaAddInstaller.addEventListener('click', () => {
      modalAddUser.classList.add('active');
      document.body.classList.add('modal-open');
    });
  }

  const qaCategories = document.getElementById('qa-categories');
  if (qaCategories && modalCategories) {
    qaCategories.addEventListener('click', () => {
      modalCategories.classList.add('active');
      document.body.classList.add('modal-open');
    });
  }

  // Dashboard Quick Search
  const dbQuickSearch = document.getElementById('db-quick-search');
  if (dbQuickSearch) {
    dbQuickSearch.addEventListener('input', debounce(() => {
      const q = dbQuickSearch.value.trim();
      if (!q) return;
      searchInput.value = q;
      document.getElementById('tab-btn-browse').click();
      loadTools();
    }, 500));
  }

  document.getElementById('logo-home').addEventListener('click', () => {
    document.getElementById('tab-btn-dashboard').click();
  });

  userSelect.addEventListener('change', (e) => {
    selectUser(e.target.value);
  });

  searchInput.addEventListener('input', debounce(loadTools, 300));
  filterCategory.addEventListener('change', loadTools);
  if (filterStatus) filterStatus.addEventListener('change', loadTools);
  if (filterSort) filterSort.addEventListener('change', loadTools);

  rentStartInput.addEventListener('change', () => {
    rentEndInput.min = rentStartInput.value;
    calculateRentCost();
  });
  rentEndInput.addEventListener('change', calculateRentCost);

  document.querySelectorAll('.btn-duration').forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.days);
      const startStr = rentStartInput.value || new Date().toISOString().split('T')[0];
      const start = new Date(startStr);
      const end = new Date(start);
      end.setDate(end.getDate() + (days - 1));
      rentEndInput.value = end.toISOString().split('T')[0];
      calculateRentCost();
    });
  });

  btnDepositTrigger.addEventListener('click', () => {
    modalDeposit.classList.add('active');
    document.body.classList.add('modal-open');
  });

  quickAmountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      depositAmountInput.value = btn.dataset.value;
    });
  });

  btnAddUserTrigger.addEventListener('click', () => {
    modalAddUser.classList.add('active');
    document.body.classList.add('modal-open');
  });

  const btnDeleteToolModal = document.getElementById('btn-delete-tool-modal');
  if (btnDeleteToolModal) {
    btnDeleteToolModal.addEventListener('click', async () => {
      if (!selectedTool) return;
      if (!confirm(`Sigur dorești să ștergi definitiv utilajul "${selectedTool.name}" din magazie?`)) return;

      try {
        const res = await fetch(`/api/admin/tools/${selectedTool.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`Utilajul "${selectedTool.name}" a fost șters din magazie!`, 'success');
        closeAllModals();
        await loadTools();
        await loadDashboardStats();
        await loadAdminPanelData();
      } catch (err) {
        showToast(err.message || 'Eroare la ștergerea utilajului.', 'error');
      }
    });
  }

  if (btnBackupTrigger && modalBackup) {
    btnBackupTrigger.addEventListener('click', () => {
      modalBackup.classList.add('active');
      document.body.classList.add('modal-open');
    });
  }

  if (btnExportBackup) {
    btnExportBackup.addEventListener('click', () => {
      window.location.href = '/api/backup/export';
      showToast('Descărcare fișier backup pornită!', 'success');
    });
  }

  if (btnImportBackupTrigger && importBackupFile) {
    btnImportBackupTrigger.addEventListener('click', () => importBackupFile.click());
    
    importBackupFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const backupJson = JSON.parse(event.target.result);
          if (!confirm('Atenție! Această acțiune va înlocui datele curente cu cele din fișierul backup. Continuați?')) return;

          const res = await fetch('/api/backup/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(backupJson)
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          showToast('Restaurare date finalizată cu succes!', 'success');
          closeAllModals();
          await loadUsers();
          await loadTools();
          await loadAdminPanelData();
          await loadDashboardStats();
        } catch (err) {
          showToast(err.message || 'Fișier backup invalid.', 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  // Universal Modal Close Event Delegation (Click X or Backdrop)
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-close-modal') || e.target.classList.contains('modal-backdrop')) {
      closeAllModals();
    }
  });

  if (btnCloseContract) btnCloseContract.addEventListener('click', closeAllModals);
  if (btnPrintContract) {
    btnPrintContract.addEventListener('click', () => {
      window.print();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.body.classList.remove('modal-open');
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function formatCurrency(amount) {
  if (amount === 0 || amount === '0') {
    return '0 RON (Gratuit)';
  }
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }).format(amount);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';

  toast.innerHTML = `
    <span>${icon} ${message}</span>
    <span class="toast-close">&times;</span>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'none';
    toast.offsetHeight;
    toast.style.animation = 'slideUp 0.3s reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

function setupPwaInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    pwaInstallBanner.classList.remove('hidden');
  });

  btnPwaInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    deferredPrompt = null;
    pwaInstallBanner.classList.add('hidden');
  });

  btnPwaClose.addEventListener('click', () => {
    pwaInstallBanner.classList.add('hidden');
  });

  window.addEventListener('appinstalled', (evt) => {
    showToast('Aplicația ToolShare a fost instalată cu succes!', 'success');
    pwaInstallBanner.classList.add('hidden');
  });
}

// ==================== BATCH SELECTION & MULTI-RENT LOGIC ====================

function toggleToolSelection(toolId, cardElement) {
  if (selectedToolIds.has(toolId)) {
    selectedToolIds.delete(toolId);
    cardElement.classList.remove('selected');
    cardElement.querySelector('.tool-card-checkbox').textContent = '';
  } else {
    selectedToolIds.add(toolId);
    cardElement.classList.add('selected');
    cardElement.querySelector('.tool-card-checkbox').textContent = '✓';
  }
  updateBatchBar();
}

async function updateBatchBar() {
  const bar = document.getElementById('batch-bar');
  const countEl = document.getElementById('batch-count');
  const installerSelect = document.getElementById('batch-installer');
  const batchStart = document.getElementById('batch-start');
  const batchEnd = document.getElementById('batch-end');

  if (selectedToolIds.size === 0) {
    bar.style.display = 'none';
    return;
  }

  countEl.textContent = selectedToolIds.size;
  bar.style.display = 'block';

  // Set default dates (today + 1 day)
  if (!batchStart.value) {
    const today = new Date();
    batchStart.value = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    batchEnd.value = tomorrow.toISOString().split('T')[0];
  }

  // Populate installer dropdown
  if (installerSelect.options.length <= 1) {
    try {
      const res = await fetch('/api/users');
      const allUsers = await res.json();
      installerSelect.innerHTML = '';
      const installers = allUsers.filter(u => u.username !== 'Admin');
      installers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `👨‍🔧 ${u.username}`;
        installerSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Error loading installers for batch bar:', err);
    }
  }
}

function clearBatchSelection() {
  selectedToolIds.clear();
  document.querySelectorAll('.tool-card.selected').forEach(card => {
    card.classList.remove('selected');
    const cb = card.querySelector('.tool-card-checkbox');
    if (cb) cb.textContent = '';
  });
  updateBatchBar();
}

async function batchRent() {
  const installerSelect = document.getElementById('batch-installer');
  const batchStart = document.getElementById('batch-start');
  const batchEnd = document.getElementById('batch-end');
  const btnBatch = document.getElementById('btn-batch-rent');

  const renter_id = installerSelect.value;
  const start = batchStart.value;
  const end = batchEnd.value;

  if (!renter_id) {
    showToast('Selectează un instalator!', 'error');
    return;
  }
  if (!start || !end) {
    showToast('Completează datele de început și sfârșit!', 'error');
    return;
  }
  if (new Date(end) < new Date(start)) {
    showToast('Data de returnare nu poate fi înaintea datei de preluare!', 'error');
    return;
  }

  const toolIds = Array.from(selectedToolIds);
  btnBatch.disabled = true;
  btnBatch.textContent = `⏳ Se predau ${toolIds.length} utilaje...`;

  let successCount = 0;
  let failCount = 0;

  for (const toolId of toolIds) {
    const tool = currentTools.find(t => t.id === toolId);
    if (!tool || tool.status === 'rented') {
      failCount++;
      continue;
    }

    const startD = new Date(start);
    const endD = new Date(end);
    const diffDays = Math.ceil(Math.abs(endD - startD) / (1000 * 60 * 60 * 24)) + 1;
    const totalPrice = diffDays * tool.price;

    try {
      const res = await fetch(`/api/tools/${toolId}/rent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          renter_id,
          start_date: start,
          end_date: end,
          total_price: totalPrice
        })
      });
      if (res.ok) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      failCount++;
    }
  }

  if (successCount > 0) {
    showToast(`✅ ${successCount} utilaj(e) predate cu succes!${failCount > 0 ? ` (${failCount} eșuate)` : ''}`, 'success');
  } else {
    showToast('❌ Niciun utilaj nu a putut fi predat.', 'error');
  }

  clearBatchSelection();
  btnBatch.disabled = false;
  btnBatch.textContent = '🚀 Predă Toate Selectate';

  await loadTools();
  await loadDashboardStats();
  if (typeof loadAdminPanelData === 'function') await loadAdminPanelData();
}

// Wire up batch bar buttons
document.getElementById('btn-batch-rent').addEventListener('click', batchRent);
document.getElementById('btn-batch-cancel').addEventListener('click', clearBatchSelection);
