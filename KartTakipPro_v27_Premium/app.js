// --- FIREBASE CONFIG (USER SHOULD FILL THIS) ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// --- INITIALIZE FIREBASE RESILIENTLY ---
let db = null;
const isFirebaseSetup = firebaseConfig.apiKey !== "YOUR_API_KEY";
if (typeof firebase !== 'undefined' && isFirebaseSetup) {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    } catch (e) { console.error("Firebase Init Error:", e); }
}

// --- VERİ VE SENKRONİZASYON ---
let banks = JSON.parse(localStorage.getItem('kt9_banks')) || [];
let debts = JSON.parse(localStorage.getItem('kt9_debts')) || [];
let pinCode = localStorage.getItem('kt9_pin') || "1111";
if (pinCode.length !== 4) { pinCode = "1111"; localStorage.setItem('kt9_pin', pinCode); }
let enteredPin = "";
let changePinState = { step: 0, old: "", news: "" }; // 0: old, 1: new
let currentTab = "ozet";
let currentFilter = "debt";
let currentPersonId = null;
let calendar = null;
let isAuthenticated = false;

const saveData = () => {
    try {
        localStorage.setItem('kt9_banks', JSON.stringify(banks));
        localStorage.setItem('kt9_debts', JSON.stringify(debts));
        localStorage.setItem('kt9_pin', pinCode);
        renderAll();
        NotificationManager.scheduleAll();
        syncToCloud();
    } catch (e) { console.error("Local Save Error:", e); }
};

const syncToCloud = async () => {
    if (!db) return;
    updateSyncUI('SYNCING');
    try {
        await db.collection('userdata').doc('main').set({
            banks, debts, pinCode, lastSync: Date.now()
        });
        updateSyncUI('DONE');
    } catch (e) { console.error("Cloud Sync Error:", e); updateSyncUI('ERROR'); }
};

const updateSyncUI = (status) => {
    const indicator = document.getElementById('syncIndicator'); if (!indicator) return;
    if (!db) { indicator.classList.add('hidden'); return; }
    indicator.classList.remove('hidden');
    const icon = document.getElementById('syncIcon'); const text = document.getElementById('syncText');
    if (status === 'SYNCING') { icon.innerText = "🔄"; text.innerText = "EŞİTLENİYOR"; indicator.style.opacity = "0.5"; }
    else if (status === 'DONE') { icon.innerText = "☁️"; text.innerText = "BULUTTA"; indicator.style.opacity = "1"; }
    else { icon.innerText = "⚠️"; text.innerText = "HATA"; indicator.style.opacity = "1"; }
};

const loadFromCloud = async () => {
    if (!db) return;
    updateSyncUI('SYNCING');
    try {
        const doc = await db.collection('userdata').doc('main').get();
        if (doc.exists) {
            const data = doc.data();
            banks = data.banks || []; debts = data.debts || []; pinCode = data.pinCode || "111111";
            localStorage.setItem('kt9_banks', JSON.stringify(banks));
            localStorage.setItem('kt9_debts', JSON.stringify(debts));
            localStorage.setItem('kt9_pin', pinCode);
            renderAll();
        }
        updateSyncUI('DONE');
    } catch (e) { console.error("Load Error:", e); updateSyncUI('ERROR'); }
};

// --- YEDEKLEME (BACKUP/RESTORE) ---
// --- YEDEKLEME (BACKUP/RESTORE) ---
async function exportData() {
    const data = { banks, debts, pinCode, version: "v28", date: new Date().toISOString() };
    const jsonString = JSON.stringify(data, null, 2);
    const fileName = `KKPRO_Yedek_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '_')}.json`;

    // 1. WEB SHARE API (Mobile/PWA preferred)
    if (navigator.share) {
        try {
            const file = new File([jsonString], fileName, { type: 'application/json' });
            await navigator.share({
                files: [file],
                title: 'Kart Takip Pro Yedek',
                text: 'KKPRO Veri Yedek Dosyası'
            });
            return;
        } catch (e) { console.warn("Share API failed, falling back..."); }
    }

    // 2. MODERN TARAYICI (FILE SYSTEM ACCESS API)
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }]
            });
            const writable = await handle.createWritable();
            await writable.write(jsonString);
            await writable.close();
            return;
        } catch (e) { console.warn("SavePicker failed, falling back..."); }
    }

    // 3. FALLBACK: DOWNLOAD LINK
    try {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        // 4. LAST RESORT: COPY TO CLIPBOARD
        console.error("Backup failed completely, showing manual copy...");
        alert("Yedek dosyası oluşturulamadı. Verileriniz kopyalanıyor, bir yere yapıştırıp saklayın.");
        navigator.clipboard.writeText(jsonString).then(() => {
            alert("Tüm verileriniz panoya kopyalandı!");
        });
    }
}

function importData(input) {
    const file = input.files ? input.files[0] : null;
    if (!file) {
        // Manual paste fallback
        const manualData = prompt("Lütfen yedek JSON içeriğini buraya yapıştırın:");
        if (manualData) processImport(manualData);
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => processImport(e.target.result);
    reader.readAsText(file);
    input.value = "";
}

function processImport(jsonString) {
    try {
        // Clean potential prefixes like "KKTPRO YEDEK KODU:"
        if (jsonString.includes('{')) {
            jsonString = jsonString.substring(jsonString.indexOf('{'));
        }

        // Handle potential truncation (extremely basic fix by closing brackets)
        let openBrackets = (jsonString.match(/{/g) || []).length;
        let closeBrackets = (jsonString.match(/}/g) || []).length;
        while (closeBrackets < openBrackets) {
            jsonString += '}';
            closeBrackets++;
        }

        let openArrays = (jsonString.match(/\[/g) || []).length;
        let closeArrays = (jsonString.match(/]/g) || []).length;
        while (closeArrays < openArrays) {
            jsonString += ']';
            closeArrays++;
        }

        const data = JSON.parse(jsonString);
        if (!data.banks && !data.debts) throw new Error("Invalid");
        if (confirm("Mevcut veriler silinip yedek yüklenecek. Onaylıyor musunuz?")) {
            banks = data.banks || [];
            debts = data.debts || [];
            pinCode = data.pinCode || "1111";
            saveData();
            alert("Yedek başarıyla yüklendi! Uygulama yenileniyor...");
            location.reload();
        }
    } catch (err) {
        console.error("JSON Parse Error:", err);
        alert("HATA: Geçersiz veya bozuk yedek verisi! Dosyanın sonu kesilmiş olabilir.");
    }
}

// --- GÜVENLİK (PIN) ---
const updatePinUI = () => {
    const dots = document.querySelectorAll('#pinScreen .pin-dot');
    dots.forEach((dot, i) => i < enteredPin.length ? dot.classList.add('filled') : dot.classList.remove('filled'));
    if (enteredPin.length === 4) {
        if (enteredPin === pinCode) {
            isAuthenticated = true;
            sessionStorage.setItem('kt_auth', '1');
            const pinScreen = document.getElementById('pinScreen');
            pinScreen.style.opacity = '0';
            setTimeout(() => { pinScreen.style.display = 'none'; initApp(); }, 300);
        } else {
            const status = document.getElementById('pinStatus');
            status.innerText = "Hatalı Şifre!"; status.style.color = "#DA291C";
            document.getElementById('pinScreen').style.animation = "shake 0.3s";
            setTimeout(() => { enteredPin = ""; updatePinUI(); status.innerText = "Güvenli giriş için şifreyi girin"; status.style.color = ""; document.getElementById('pinScreen').style.animation = ""; }, 800);
        }
    }
};

const pressNum = n => { if (enteredPin.length < 4) { enteredPin += n; updatePinUI(); } };
const delPin = () => { enteredPin = enteredPin.slice(0, -1); updatePinUI(); };
const clearPin = () => { enteredPin = ""; updatePinUI(); };

function logoutApp() {
    sessionStorage.removeItem('kt_auth');
    location.reload();
}

// --- PREMIUM PIN DEGISTIRME ---
function changePin() {
    changePinState = { step: 0, old: "", news: "" };
    enteredPin = "";
    document.getElementById('pinChangeStatus').innerText = "Lütfen mevcut şifreyi girin";
    updateChangePinUI();
    showModal('pinChangeModal');
}

const updateChangePinUI = () => {
    const dots = document.querySelectorAll('#pinChangeModal .pin-dot');
    dots.forEach((dot, i) => i < enteredPin.length ? dot.classList.add('filled') : dot.classList.remove('filled'));
    if (enteredPin.length === 4) {
        if (changePinState.step === 0) {
            if (enteredPin === pinCode) {
                changePinState.old = enteredPin;
                changePinState.step = 1;
                enteredPin = "";
                document.getElementById('pinChangeStatus').innerText = "Yeni 4 haneli şifreyi girin";
                updateChangePinUI();
            } else {
                document.getElementById('pinChangeStatus').innerText = "Hatalı Mevcut Şifre!";
                setTimeout(() => { enteredPin = ""; updateChangePinUI(); document.getElementById('pinChangeStatus').innerText = "Lütfen mevcut şifreyi girin"; }, 1000);
            }
        } else {
            pinCode = enteredPin;
            saveData();
            document.getElementById('pinChangeStatus').innerText = "Şifre Değiştirildi!";
            setTimeout(() => { closeModal('pinChangeModal'); alert("Emniyet için uygulama yeniden başlatılacak."); location.reload(); }, 1000);
        }
    }
};

const pressChangePinNum = n => { if (enteredPin.length < 4) { enteredPin += n; updateChangePinUI(); } };
const clearChangePin = () => { enteredPin = ""; updateChangePinUI(); };

// --- NAVİGASYON ---
function switchTab(tabId, el, isBack = false) {
    currentTab = tabId;
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const targetTab = document.getElementById('tab-' + tabId); if (targetTab) targetTab.classList.add('active');
    if (!el) {
        const navItems = document.querySelectorAll('.nav-item');
        const idxMap = { ozet: 0, banka: 1, takvim: 2, more: 3, borc: 4 }; el = navItems[idxMap[tabId]];
    }
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    const titleMap = { ozet: "KKTPRO 2.0", banka: "BANKALARIM", more: "AYARLAR", borc: "BORÇ ALACAK TAKİBİ", takvim: "TAKVİM" };
    document.getElementById('headerTitle').innerText = titleMap[tabId] || "KKTPRO 2.0";
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tabId === 'borc') { closePersonDetail(); renderDebts(); }
    if (tabId === 'takvim') { CalendarManager.render(); }
    if (!isBack) { history.pushState({ tab: tabId }, "", ""); }
}
window.addEventListener('popstate', (event) => {
    if (event.state) {
        if (event.state.modal) {
            closeModal(event.state.modal, true);
        } else if (event.state.tab) {
            switchTab(event.state.tab, null, true);
        }
    }
    // Açık modal kalmışsa (manual geri işlemi için güvenlik)
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => {
        if (m.id !== 'pinScreen') closeModal(m.id, true);
    });
});

function showDetail(type, el) {
    currentFilter = type;
    document.querySelectorAll('.summary-card').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    renderDetails();
}

// --- CURRENCY MASKING ---
function maskInput(el) {
    let val = el.value; if (!val) return;
    val = val.replace(/[^0-9,.]/g, "");
    if (val.endsWith('.') && !val.substring(0, val.length - 1).includes(',')) { val = val.slice(0, -1) + ','; }
    let parts = val.split(',');
    let integerPart = parts[0].replace(/[^0-9]/g, '');
    let formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (parts.length > 1) { let decimalPart = parts[1].replace(/[^0-9]/g, '').substring(0, 2); formatted += "," + decimalPart; }
    el.value = formatted;
}
function unmask(v) { if (!v) return 0; return parseFloat(v.toString().replace(/\./g, "").replace(",", ".")) || 0; }

// --- RENDERING ---
function renderAll() { renderSummary(); renderDetails(); renderNotifications(); renderBanks(); renderDebts(); }
function renderSummary() {
    const tLimit = banks.reduce((s, b) => s + (b.limit || 0), 0);
    const tUsable = banks.reduce((s, b) => s + (b.usable || 0), 0);
    let bankDebt = tLimit - tUsable;
    let personNet = debts.reduce((s, p) => {
        const bal = (p.transactions || []).reduce((acc, t) => acc + (t.type === 'BORC' ? t.amount : -t.amount), 0);
        return s + bal;
    }, 0);
    const netDebt = bankDebt + personNet;
    document.getElementById('totalLimit').innerText = formatMoney(tLimit);
    document.getElementById('totalUsable').innerText = formatMoney(tUsable);
    const debtEl = document.getElementById('totalDebt');
    debtEl.innerText = formatMoney(Math.abs(netDebt));
    debtEl.className = `text-sm font-bold text-center ${netDebt > 0 ? 'text-[#DA291C]' : (netDebt < 0 ? 'text-green-600' : 'text-gray-800')}`;
    debtEl.parentElement.querySelector('p').innerText = netDebt >= 0 ? "TOPLAM BORÇ" : "TOPLAM ALACAK";

    const allEvents = CalendarManager.getEvents().filter(e => e.extendedProps.type === 'DUE' || e.extendedProps.type === 'TAKSIT' || e.extendedProps.type === 'VADE');
    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
    const today = new Date().setHours(0, 0, 0, 0); const upcomingFirst = allEvents.find(e => new Date(e.start) >= today);
    if (upcomingFirst) {
        const targetDate = upcomingFirst.start;
        const sameDayEvents = allEvents.filter(e => e.start === targetDate);
        const dayTotal = sameDayEvents.reduce((s, e) => s + (e.extendedProps.amount || 0), 0);

        const diff = Math.round((new Date(targetDate) - today) / 86400000);
        const countdownText = diff <= 0 ? (diff === 0 ? "BUGÜN" : `${Math.abs(diff)} GÜN GEÇTİ`) : (diff === 1 ? "YARIN" : `${diff} GÜN KALDI`);
        document.getElementById('upcomingLabel').innerText = formatDate(targetDate) + " | " + countdownText;
        document.getElementById('upcomingAmount').innerText = formatMoney(dayTotal);
    } else { document.getElementById('upcomingLabel').innerText = "ÖDEME YOK"; document.getElementById('upcomingAmount').innerText = "0,00 TL"; }
}

function renderDetails() {
    const container = document.getElementById('detailList'); const title = document.getElementById('detailTitle'); container.innerHTML = '';
    if (currentFilter === 'limit' || currentFilter === 'usable') {
        title.innerText = currentFilter === 'limit' ? "BANKA LİMİT DETAYLARI" : "KULLANILABİLİR LİMİTLER";
        [...banks].sort((a, b) => (currentFilter === 'limit' ? b.limit - a.limit : b.usable - a.usable)).forEach(b => {
            container.innerHTML += `<div class="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-800"><span class="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">${b.name}</span><span class="text-sm font-bold ${currentFilter === 'limit' ? 'text-gray-900 dark:text-gray-100' : 'text-green-600'}">${formatMoney(currentFilter === 'limit' ? b.limit : b.usable)}</span></div>`;
        });
    } else if (currentFilter === 'debt') {
        title.innerText = "KART VE KİŞİ DETAYLARI"; const items = [];
        banks.forEach(b => { const bDebt = (b.limit || 0) - (b.usable || 0); if (bDebt > 0) items.push({ name: b.name, amount: bDebt, type: 'BANK', id: b.id }); });
        debts.forEach(p => { const balance = (p.transactions || []).reduce((s, t) => s + (t.type === 'BORC' ? t.amount : -t.amount), 0); if (balance !== 0) items.push({ name: p.name, amount: Math.abs(balance), type: balance > 0 ? 'BORC' : 'ALACAK', id: p.id, raw: balance }); });
        items.sort((a, b) => b.amount - a.amount);
        items.forEach(item => {
            const color = item.type === 'ALACAK' ? 'text-green-600' : 'text-[#DA291C]';
            const label = item.type === 'BANK' ? 'BANKA' : (item.type === 'BORC' ? 'BORÇLUYUM' : 'ALACAKLIYIM');
            container.innerHTML += `<div onclick="${item.type === 'BANK' ? "switchTab('banka')" : "openPersonDetail('" + item.id + "')"}" class="flex justify-between items-center py-3 border-b dark:border-gray-800 active:bg-gray-100 transition-colors"><div class="flex flex-col"><span class="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">${item.name}</span><span class="text-[8px] font-bold text-gray-400 opacity-70">${label}</span></div><span class="text-sm font-bold ${color}">${formatMoney(item.amount)}</span></div>`;
        });
    } else { renderAllPayments(container, title); }
}

function renderAllPayments(container, title) {
    title.innerText = "ÖDEME TAKVİMİ"; const schedule = {}; const events = CalendarManager.getEvents().filter(e => e.extendedProps.type === 'DUE' || e.extendedProps.type === 'TAKSIT' || e.extendedProps.type === 'VADE');
    events.forEach(e => { if (e.extendedProps.amount > 0) schedule[e.start] = (schedule[e.start] || 0) + e.extendedProps.amount; });
    Object.keys(schedule).sort().forEach(d => {
        if (schedule[d] <= 0) return;
        const item = getRelativeInfo(d);
        container.innerHTML += `<div class="mb-4"><div onclick="toggleDayCollapse('${d}')" class="flex justify-between items-center py-3 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl active:bg-blue-50 transition-colors cursor-pointer"><div class="flex flex-col"><span class="text-xs font-bold text-gray-700 dark:text-gray-300">${formatDate(d)}</span><span class="text-[9px] ${item.color} font-bold uppercase">${item.text}</span></div><div class="flex items-center gap-3"><span class="text-sm font-bold text-[#DA291C]">${formatMoney(schedule[d])}</span><span class="text-xs text-gray-400">▼</span></div></div><div id="day-collapse-${d}" class="hidden mt-2 space-y-2 px-2 animate-slideDown">${events.filter(e => e.start === d).map(ev => `<div onclick="handleEventClick('${ev.extendedProps.type}', '${ev.extendedProps.bId}', ${ev.extendedProps.cIdx}, '${ev.extendedProps.pId}')" class="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700 rounded-xl active:bg-gray-50"><span class="text-[10px] font-bold opacity-70 uppercase">${ev.title}</span><span class="text-xs font-bold text-gray-800 dark:text-gray-200">${formatMoney(ev.extendedProps.amount)}</span></div>`).join('')}</div></div>`;
    });
}
function toggleDayCollapse(dateStr) { const el = document.getElementById(`day-collapse-${dateStr}`); if (el) el.classList.toggle('hidden'); }

function renderNotifications() {
    const dueCont = document.getElementById('dueListBody'); const cutoffCont = document.getElementById('cutoffListBody'); if (!dueCont || !cutoffCont) return;
    dueCont.innerHTML = ''; cutoffCont.innerHTML = '';
    const events = CalendarManager.getEvents();
    const dues = events.filter(e => e.extendedProps.type === 'DUE' || e.extendedProps.type === 'TAKSIT' || e.extendedProps.type === 'VADE').sort((a, b) => new Date(a.start) - new Date(b.start));
    const cutoffs = events.filter(e => e.extendedProps.type === 'CUTOFF').sort((a, b) => new Date(a.start) - new Date(b.start));
    const renderItem = (e) => {
        const diff = Math.round((new Date(e.start) - new Date().setHours(0, 0, 0, 0)) / 86400000); const isPast = diff < 0; const isToday = diff === 0;
        let textInfo = isPast ? `${Math.abs(diff)} GÜN GEÇTİ` : (isToday ? "BUGÜN SON" : `${diff} GÜN KALDI`);
        let colorClass = isPast ? "text-red-600 font-black" : (isToday ? "text-orange-600 font-black" : "text-blue-500 font-bold");
        let icon = (isPast || isToday) ? `<span class="bg-${isPast ? 'red' : 'orange'}-600 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${isPast ? 'animate-bounce' : ''}">!</span>` : `<div class="w-2 h-2 rounded-full ${e.extendedProps.type === 'CUTOFF' ? 'bg-blue-300' : 'bg-[#DA291C]'}"></div>`;
        return `<div onclick="handleEventClick('${e.extendedProps.type}', '${e.extendedProps.bId}', ${e.extendedProps.cIdx}, '${e.extendedProps.pId}')" class="ak-card p-4 flex justify-between items-center bg-white dark:bg-slate-800 border-none shadow-sm active:bg-gray-100 ${isPast ? 'bg-red-50/50 dark:bg-red-900/10 ring-1 ring-red-100 dark:ring-red-900/30' : ''}"><div class="flex items-center gap-3">${icon}<div><h4 class="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase">${e.title}</h4><p class="text-[9px] uppercase tracking-tighter ${colorClass}">${textInfo} | ${formatDate(e.start)}</p></div></div><span class="text-xs font-bold ${e.extendedProps.type === 'CUTOFF' ? 'text-blue-500' : 'text-[#DA291C]'}">${formatMoney(e.extendedProps.amount)}</span></div>`;
    };
    dues.forEach(e => dueCont.innerHTML += renderItem(e)); if (!dues.length) dueCont.innerHTML = '<div class="text-[10px] text-gray-400 p-4 text-center border-dashed border rounded-xl uppercase">Ödeme bulunmuyor</div>';
    cutoffs.forEach(e => cutoffCont.innerHTML += renderItem(e)); if (!cutoffs.length) cutoffCont.innerHTML = '<div class="text-[10px] text-gray-400 p-4 text-center border-dashed border rounded-xl uppercase">Kesim bulunmuyor</div>';
}

function handleEventClick(type, bId, cIdx, pId) { if (pId && pId !== 'undefined' && pId !== 'null') { openPersonDetail(pId); } else if (bId && bId !== 'undefined') { openEditCard(bId, cIdx); } }

function renderBanks() {
    const container = document.getElementById('bankList'); if (!container) return; container.innerHTML = '';
    banks.forEach(b => {
        const bDebt = (b.limit || 0) - (b.usable || 0);
        container.innerHTML += `<div class="ak-card p-5 relative overflow-hidden ring-1 ring-black/5 dark:ring-white/5"><div class="absolute top-0 left-0 w-1.5 h-full bg-[#DA291C]"></div><div class="flex justify-between items-start mb-5 pl-2"><div onclick="openEditBank('${b.id}')"><h3 class="font-bold text-gray-800 dark:text-gray-100 text-base uppercase">${b.name}</h3><p class="text-[10px] font-bold text-gray-400 uppercase mt-0.5 tracking-tight">KART BORÇLARI: <span class="text-[#DA291C]">${formatMoney(bDebt)}</span></p></div><div class="flex gap-1.5"><button onclick="openAddCard('${b.id}')" class="bg-gray-100/80 dark:bg-gray-700/80 text-[10px] font-bold px-4 py-2 rounded-full hover:bg-[#DA291C] hover:text-white transition-all uppercase">+ KART</button><button onclick="deleteBank('${b.id}')" class="w-8 h-8 flex items-center justify-center text-xs opacity-20 dark:opacity-40">🗑️</button></div></div><div class="space-y-2 pl-2">${(b.cards || []).map((c, i) => `<div onclick="openEditCard('${b.id}', ${i})" class="flex justify-between items-center p-3.5 bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl active:bg-red-50 dark:active:bg-red-900/20 transition-colors"><div class="flex flex-col"><span class="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">${c.name}</span>${c.bonus > 0 ? `<span class="text-[8px] font-bold text-yellow-600">✨ ${formatMoney(c.bonus)} Bonus</span>` : ''}</div><div class="text-right"><div class="text-xs font-bold text-gray-900 dark:text-gray-100">${formatMoney(c.debt)}</div><div class="text-[8px] font-bold text-gray-400 uppercase">${formatDate(c.due)}</div></div></div>`).join('') || '<p class="text-[10px] text-gray-300 italic py-2 uppercase">Kart tanımlanmadı</p>'}</div></div>`;
    });
}
function renderDebts() {
    const container = document.getElementById('personList'); if (!container) return; container.innerHTML = '';
    debts.forEach(p => {
        const balance = (p.transactions || []).reduce((s, t) => s + (t.type === 'BORC' ? t.amount : -t.amount), 0);
        const color = balance > 0 ? 'text-[#DA291C]' : (balance < 0 ? 'text-green-600' : 'text-gray-400');
        container.innerHTML += `<div onclick="openPersonDetail('${p.id}')" class="ak-card p-4 flex justify-between items-center active:bg-gray-50 dark:active:bg-gray-800"><div class="flex flex-col"><span class="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase">${p.name}</span><span class="text-[9px] text-gray-400 uppercase font-bold">${p.transactions?.length || 0} İŞLEM</span></div><div class="text-right"><span class="text-[8px] font-bold text-gray-400 uppercase block">${balance > 0 ? 'BORCUM VAR' : (balance < 0 ? 'ALACAĞIM VAR' : 'DURUM NET')}</span><span class="text-sm font-bold ${color}">${formatMoney(Math.abs(balance))}</span></div></div>`;
    });
}

// --- İŞLEM YÖNETİMİ ---
function openAddPerson() {
    document.getElementById('personName').value = ""; document.getElementById('pDueDate').value = ""; document.getElementById('pLeadTime').value = "1";
    document.getElementById('pHasVade').value = "0"; document.getElementById('btnPMainVade').classList.remove('active'); document.getElementById('btnPMainVade').querySelector('.indicator').innerText = "⚪";
    document.getElementById('pVadeContainer').classList.add('hidden'); document.getElementById('pIsInstallment').value = "0"; document.getElementById('btnPMainTaksit').classList.remove('active');
    document.getElementById('btnPMainTaksit').querySelector('.indicator').innerText = "⚪"; document.getElementById('pAmount').value = ""; document.getElementById('pTCount').value = "";
    document.getElementById('pTBaseDate').value = new Date().toISOString().split('T')[0]; document.getElementById('pInstallmentList').innerHTML = "";
    document.getElementById('pDebtEntryContainer').classList.add('hidden'); document.getElementById('pTaksitArea').classList.add('hidden'); showModal('personModal');
}
function updatePersonEntryVisibility() {
    const hasVade = document.getElementById('pHasVade').value === "1"; const isInst = document.getElementById('pIsInstallment').value === "1";
    document.getElementById('pDebtEntryContainer').classList.toggle('hidden', !hasVade && !isInst); document.getElementById('pTaksitArea').classList.toggle('hidden', !isInst);
}
function toggleVadeUI() {
    const btn = document.getElementById('btnPMainVade'); const input = document.getElementById('pHasVade'); const container = document.getElementById('pVadeContainer');
    const isActive = btn.classList.toggle('active'); input.value = isActive ? "1" : "0"; container.classList.toggle('hidden', !isActive); btn.querySelector('.indicator').innerText = isActive ? "🔴" : "⚪";
    updatePersonEntryVisibility();
}
function togglePTaksitUI() {
    const btn = document.getElementById('btnPMainTaksit'); const input = document.getElementById('pIsInstallment'); const isActive = btn.classList.toggle('active');
    input.value = isActive ? "1" : "0"; btn.querySelector('.indicator').innerText = isActive ? "🟢" : "⚪"; updatePersonEntryVisibility(); if (isActive) generatePInstallmentRows(document.getElementById('pTCount').value);
}
function generatePInstallmentRows(count) {
    const list = document.getElementById('pInstallmentList'); list.innerHTML = ''; const total = unmask(document.getElementById('pAmount').value); if (!total || count <= 0) return;
    const amountPer = (total / count).toFixed(2); let baseDate = new Date(document.getElementById('pTBaseDate').value || new Date());
    for (let i = 0; i < count; i++) {
        let d = new Date(baseDate); d.setMonth(baseDate.getMonth() + i); const dateStr = d.toISOString().split('T')[0];
        list.innerHTML += `<div class="flex gap-2 items-center bg-white dark:bg-slate-900 p-2 rounded-lg border dark:border-slate-800"><span class="text-[9px] font-bold w-6 text-center">${i + 1}.</span><input type="text" class="p-inst-amount w-full p-2 text-[10px] font-bold bg-transparent" value="${amountPer.replace('.', ',')}" oninput="maskInput(this)"><input type="date" class="p-inst-date w-full p-2 text-[10px] bg-transparent" value="${dateStr}"></div>`;
    }
}
function savePerson() {
    const name = document.getElementById('personName').value.trim(); if (!name) return;
    const hasVade = document.getElementById('pHasVade').value === "1"; const isInstallment = document.getElementById('pIsInstallment').value === "1"; const amount = unmask(document.getElementById('pAmount').value);
    let installments = null; if (isInstallment && amount > 0) {
        installments = []; const amounts = document.querySelectorAll('.p-inst-amount'); const dates = document.querySelectorAll('.p-inst-date');
        amounts.forEach((el, i) => { installments.push({ amount: unmask(el.value), date: dates[i].value }); });
    }
    const newPerson = { id: Date.now().toString(), name, hasVade, isInstallment, dueDate: hasVade ? document.getElementById('pDueDate').value : null, leadTime: document.getElementById('pLeadTime').value, transactions: [] };
    if (amount > 0) newPerson.transactions.push({ amount, desc: "BAŞLANGIÇ BORCU", type: 'BORC', installments, date: new Date().toLocaleString('tr-TR') });
    debts.push(newPerson); saveData(); closeModal('personModal'); switchTab('borc');
}
function openPersonDetail(id) {
    currentPersonId = id; const p = debts.find(x => x.id === id); if (!p) return;
    document.getElementById('detailPersonName').innerText = p.name.toUpperCase(); document.getElementById('personListView').classList.add('hidden'); document.getElementById('personDetailView').classList.remove('hidden');
    renderPersonHistory(); currentTab = 'borc'; document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-borc').classList.add('active'); const navItems = document.querySelectorAll('.nav-item'); navItems.forEach(n => n.classList.remove('active')); navItems[4].classList.add('active');
    document.getElementById('headerTitle').innerText = "BORÇ ALACAK TAKİBİ"; window.scrollTo({ top: 0, behavior: 'smooth' });
}
function closePersonDetail() { currentPersonId = null; document.getElementById('personListView').classList.remove('hidden'); document.getElementById('personDetailView').classList.add('hidden'); }
function deletePerson() { if (confirm("Bu kişi/kurum ve tüm işlem geçmişi silinsin mi?")) { debts = debts.filter(x => x.id !== currentPersonId); saveData(); closePersonDetail(); } }

function renderPersonHistory() {
    const p = debts.find(x => x.id === currentPersonId); const container = document.getElementById('transactionList'); container.innerHTML = '';
    const balance = (p.transactions || []).reduce((s, t) => s + (t.type === 'BORC' ? t.amount : -t.amount), 0);
    document.getElementById('detailPersonBalance').innerText = (balance > 0 ? "BORCUM: " : (balance < 0 ? "ALACAĞIM: " : "BAKİYE: ")) + formatMoney(Math.abs(balance));
    document.getElementById('detailPersonBalance').className = `text-sm font-bold uppercase tracking-tighter ${balance > 0 ? 'text-[#DA291C]' : (balance < 0 ? 'text-green-600' : 'text-gray-400')}`;
    [...(p.transactions || [])].reverse().forEach((t, idx) => {
        const realIdx = p.transactions.length - 1 - idx; const color = t.type === 'ALACAK' ? 'text-green-600' : 'text-[#DA291C]';
        container.innerHTML += `<div onclick="openEditTransaction(${realIdx})" class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 flex justify-between items-center shadow-sm active:bg-gray-100"><div><p class="text-[10px] font-bold text-gray-400 uppercase truncate max-w-[150px]">${t.desc || 'İŞLEM'}</p><p class="text-[8px] text-gray-300 font-bold">${t.date} ${t.installments ? `| ${t.installments.length} TAKSİT` : ''}</p></div><div class="flex items-center gap-2"><span class="text-xs font-bold ${color}">${t.type === 'ALACAK' ? '-' : '+'} ${formatMoney(t.amount)}</span><span class="text-[10px]">${t.type === 'ALACAK' ? '⬇️' : '⬆️'}</span></div></div>`;
    });
}
function openTransactionModal(type) {
    document.getElementById('transModalTitle').innerText = type === 'ALACAK' ? "Kişiye Para Verdim" : "Kişiden Para Aldım";
    document.getElementById('transType').value = type; document.getElementById('editTransIdx').value = "-1"; document.getElementById('tAmount').value = ""; document.getElementById('tDesc').value = "";
    document.getElementById('tBaseDate').value = new Date().toISOString().split('T')[0]; document.getElementById('tIsInstallment').value = "0"; document.getElementById('tCount').value = "";
    document.getElementById('btnTMainTaksit').classList.remove('active'); document.getElementById('taksitContainer').classList.add('hidden'); document.getElementById('btnDeleteTrans').classList.add('hidden'); showModal('transactionModal');
}
function toggleTaksitUI() {
    const btn = document.getElementById('btnTMainTaksit'); const input = document.getElementById('tIsInstallment'); const container = document.getElementById('taksitContainer');
    const isActive = btn.classList.toggle('active'); input.value = isActive ? "1" : "0"; container.classList.toggle('hidden', !isActive); btn.querySelector('.indicator').innerText = isActive ? "🟢" : "⚪";
    if (isActive) generateInstallmentRows(document.getElementById('tCount').value);
}
function generateInstallmentRows(count) {
    const list = document.getElementById('installmentList'); list.innerHTML = ''; const total = unmask(document.getElementById('tAmount').value); if (!total || count <= 0) return;
    const amountPer = (total / count).toFixed(2); let baseDate = new Date(document.getElementById('tBaseDate').value || new Date());
    for (let i = 0; i < count; i++) {
        let d = new Date(baseDate); d.setMonth(baseDate.getMonth() + i); const dateStr = d.toISOString().split('T')[0];
        list.innerHTML += `<div class="flex gap-2 items-center bg-white dark:bg-slate-900 p-2 rounded-lg border dark:border-slate-800"><span class="text-[9px] font-bold w-6 text-center">${i + 1}.</span><input type="text" class="inst-amount w-full p-2 text-[10px] font-bold bg-transparent" value="${amountPer.replace('.', ',')}" oninput="maskInput(this)"><input type="date" class="inst-date w-full p-2 text-[10px] bg-transparent" value="${dateStr}"></div>`;
    }
}
function saveTransaction() {
    const amount = unmask(document.getElementById('tAmount').value); const desc = document.getElementById('tDesc').value.trim(); const type = document.getElementById('transType').value; const editIdx = parseInt(document.getElementById('editTransIdx').value); if (!amount) return;
    const p = debts.find(x => x.id === currentPersonId); const isInst = document.getElementById('tIsInstallment').value === "1";
    let installments = null; if (isInst) {
        installments = []; const amounts = document.querySelectorAll('.inst-amount'); const dates = document.querySelectorAll('.inst-date');
        amounts.forEach((el, i) => { installments.push({ amount: unmask(el.value), date: dates[i].value }); });
    }
    const data = { amount, desc, type, installments, date: new Date().toLocaleString('tr-TR') }; if (editIdx === -1) p.transactions.push(data); else p.transactions[editIdx] = data;
    saveData(); closeModal('transactionModal'); renderPersonHistory();
}
function openEditTransaction(idx) {
    const p = debts.find(x => x.id === currentPersonId); const t = p.transactions[idx];
    document.getElementById('transModalTitle').innerText = "İşlemi Düzenle"; document.getElementById('editTransIdx').value = idx;
    document.getElementById('transType').value = t.type; document.getElementById('tAmount').value = t.amount.toLocaleString('tr-TR');
    document.getElementById('tDesc').value = t.desc; document.getElementById('tIsInstallment').value = t.installments ? "1" : "0";
    document.getElementById('btnTMainTaksit').classList.toggle('active', !!t.installments); document.getElementById('taksitContainer').classList.toggle('hidden', !t.installments);
    document.getElementById('btnTMainTaksit').querySelector('.indicator').innerText = t.installments ? "🟢" : "⚪";
    if (t.installments) {
        document.getElementById('tCount').value = t.installments.length; document.getElementById('tBaseDate').value = t.installments[0].date;
        const list = document.getElementById('installmentList');
        list.innerHTML = t.installments.map((ins, i) => `<div class="flex gap-2 items-center bg-white dark:bg-slate-900 p-2 rounded-lg border dark:border-slate-800"><span class="text-[9px] font-bold w-6 text-center">${i + 1}.</span><input type="text" class="inst-amount w-full p-2 text-[10px] font-bold bg-transparent" value="${ins.amount.toLocaleString('tr-TR')}" oninput="maskInput(this)"><input type="date" class="inst-date w-full p-2 text-[10px] bg-transparent" value="${ins.date}"></div>`).join('');
    }
    document.getElementById('btnDeleteTrans').classList.remove('hidden'); showModal('transactionModal');
}
function deleteTransaction() { if (confirm("Bu işlem silinsin mi?")) { const p = debts.find(x => x.id === currentPersonId); const idx = parseInt(document.getElementById('editTransIdx').value); p.transactions.splice(idx, 1); saveData(); closeModal('transactionModal'); renderPersonHistory(); } }

// --- BANKA VE KART ---
function openAddCard(bankId) { document.getElementById('targetBankId').value = bankId; document.getElementById('editCardIdx').value = "-1"; document.getElementById('cardName').value = ""; document.getElementById('cDebt').value = ""; document.getElementById('cCutoff').value = ""; document.getElementById('cDue').value = ""; document.getElementById('cBonus').value = ""; document.getElementById('cCutoffLead').value = "0"; showModal('cardModal'); }
function openEditCard(bId, idx) { const b = banks.find(x => x.id === bId); if (!b) return; const c = b.cards[idx]; document.getElementById('targetBankId').value = bId; document.getElementById('editCardIdx').value = idx; document.getElementById('cardName').value = c.name; document.getElementById('cDebt').value = (c.debt || 0).toLocaleString('tr-TR'); document.getElementById('cCutoff').value = c.cutoff || ""; document.getElementById('cDue').value = c.due || ""; document.getElementById('cBonus').value = (c.bonus || 0).toLocaleString('tr-TR'); document.getElementById('cCutoffLead').value = c.cutoffLead || "0"; showModal('cardModal'); }
function saveCard() {
    const bId = document.getElementById('targetBankId').value; const idx = parseInt(document.getElementById('editCardIdx').value); const bank = banks.find(b => b.id === bId); if (!bank) return; const data = {
        name: document.getElementById('cardName').value || "KREDİ KARTI",
        debt: unmask(document.getElementById('cDebt').value),
        cutoff: document.getElementById('cCutoff').value,
        due: document.getElementById('cDue').value,
        bonus: unmask(document.getElementById('cBonus').value),
        cutoffLead: document.getElementById('cCutoffLead').value
    }; if (idx === -1) bank.cards.push(data); else bank.cards[idx] = data; saveData(); closeModal('cardModal');
}
function openAddBank() { document.getElementById('bankModalTitle').innerText = "YENİ BANKA EKLE"; document.getElementById('editBankId').value = ""; document.getElementById('bankName').value = ""; document.getElementById('bLimit').value = ""; document.getElementById('bUsable').value = ""; showModal('bankModal'); }
function openEditBank(id) { const b = banks.find(x => x.id === id); if (!b) return; document.getElementById('bankModalTitle').innerText = "BANKA DÜZENLE"; document.getElementById('editBankId').value = b.id; document.getElementById('bankName').value = b.name; document.getElementById('bLimit').value = b.limit.toLocaleString('tr-TR'); document.getElementById('bUsable').value = b.usable.toLocaleString('tr-TR'); showModal('bankModal'); }
function saveBank() { const name = document.getElementById('bankName').value.trim(); const limit = unmask(document.getElementById('bLimit').value); const usable = unmask(document.getElementById('bUsable').value); if (!name) return; const editId = document.getElementById('editBankId').value; if (editId) { const b = banks.find(x => x.id === editId); if (b) { b.name = name; b.limit = limit; b.usable = usable; } } else { banks.push({ id: Date.now().toString(), name, limit, usable, cards: [] }); } saveData(); closeModal('bankModal'); }
function deleteBank(id) { if (confirm("Banka ve tüm kartları silinsin mi?")) { banks = banks.filter(x => x.id !== id); saveData(); } }

// --- CALENDAR ---
const CalendarManager = {
    render() {
        const calendarEl = document.getElementById('calendar'); if (calendar) calendar.destroy();
        calendar = new FullCalendar.Calendar(calendarEl, { initialView: 'dayGridMonth', locale: 'tr', height: 'auto', contentHeight: 320, aspectRatio: 1.35, headerToolbar: { left: 'prev,next', center: 'title', right: 'today' }, buttonText: { today: 'BUGÜN' }, events: this.getEvents(), dateClick: info => this.showDayDetail(info.dateStr), eventClick: info => { info.jsEvent.preventDefault(); this.showDayDetail(info.event.startStr); } }); calendar.render();
    },
    getEvents() {
        const evs = []; banks.forEach(b => {
            (b.cards || []).forEach((c, cIdx) => {
                if (c.due && c.debt > 0) evs.push({ title: `ÖDEME: ${c.name}`, start: c.due, color: '#DA291C', extendedProps: { type: 'DUE', bId: b.id, cIdx, amount: c.debt } });
                if (c.cutoff && c.cutoffLead != "-1") {
                    let d = new Date(c.cutoff); let lead = parseInt(c.cutoffLead || 0);
                    if (lead >= 100) d.setDate(d.getDate() + (lead - 100)); else d.setDate(d.getDate() - lead);
                    evs.push({ title: `KESİM: ${c.name}`, start: d.toISOString().split('T')[0], color: '#3b82f6', extendedProps: { type: 'CUTOFF', bId: b.id, cIdx, amount: c.debt } });
                }
            });
        });
        debts.forEach(p => {
            const balance = (p.transactions || []).reduce((acc, t) => acc + (t.type === 'BORC' ? t.amount : -t.amount), 0);
            if (p.hasVade && p.dueDate && Math.abs(balance) > 0) {
                evs.push({ title: `VADE: ${p.name}`, start: p.dueDate, color: '#9333ea', extendedProps: { type: 'VADE', pId: p.id, amount: Math.abs(balance) } });
            }
            (p.transactions || []).forEach(t => {
                if (t.installments) {
                    t.installments.forEach(ins => {
                        if (ins.amount > 0) {
                            evs.push({ title: `TAKSİT: ${p.name}`, start: ins.date, color: t.type === 'BORC' ? '#ea580c' : '#16a34a', extendedProps: { type: 'TAKSIT', pId: p.id, amount: ins.amount } });
                        }
                    });
                }
            });
        }); return evs;
    },
    showDayDetail(dateStr) {
        const panel = document.getElementById('dayDetailPanel'); const list = document.getElementById('dayDetailList'); document.getElementById('selectedDateTitle').innerText = formatDate(dateStr) + " DETAYI"; list.innerHTML = ''; const dayEvents = this.getEvents().filter(e => e.start === dateStr); if (dayEvents.length === 0) list.innerHTML = '<p class="text-[10px] text-gray-400 italic uppercase">İşlem bulunmuyor.</p>';
        else dayEvents.forEach(ev => { list.innerHTML += `<div onclick="handleEventClick('${ev.extendedProps.type}', '${ev.extendedProps.bId}', ${ev.extendedProps.cIdx}, '${ev.extendedProps.pId}')" class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl active:bg-gray-100 transition-colors"><span class="text-xs font-bold" style="color:${ev.color}">${ev.title.toUpperCase()}</span><span class="text-xs font-bold text-gray-800 dark:text-gray-100">${ev.extendedProps.amount > 0 ? formatMoney(ev.extendedProps.amount) : '-'}</span></div>`; }); panel.classList.remove('hidden');
    }
};

// --- NOTIFICATION ---
const NotificationManager = {
    async requestPermission() { if ("Notification" in window) return await Notification.requestPermission() === "granted"; return false; },
    scheduleAll() { if (Notification.permission !== "granted") return; this.checkAndNotify(); },
    checkAndNotify() {
        const now = new Date(); const hr = now.getHours(); const min = now.getMinutes(); const events = CalendarManager.getEvents(); const todayStr = now.toISOString().split('T')[0];
        if (hr === 11) { const todayPayments = events.filter(e => e.start === todayStr && (e.extendedProps.type === 'DUE' || e.extendedProps.type === 'TAKSIT' || e.extendedProps.type === 'VADE')); if (todayPayments.length) { const total = todayPayments.reduce((s, e) => s + (e.extendedProps.amount || 0), 0); this.send("BUGÜN ÖDEME GÜNÜ", `Toplam ${formatMoney(total)} tutarında ${todayPayments.length} ödemeniz var.`); } }
        if (hr === 14 && min === 53) {
            const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
            const tomorrowPayments = events.filter(e => e.start === tomorrow && (e.extendedProps.type === 'DUE' || e.extendedProps.type === 'TAKSIT' || e.extendedProps.type === 'VADE'));
            if (tomorrowPayments.length) { const total = tomorrowPayments.reduce((s, e) => s + (e.extendedProps.amount || 0), 0); this.send("YARIN ÖDEMENİZ VAR", `Yarın ${formatMoney(total)} tutarında ödemeniz bulunmaktadır.`); }
            const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
            const yesterdayCutoffs = events.filter(e => e.start === yesterday && e.extendedProps.type === 'CUTOFF');
            if (yesterdayCutoffs.length) this.send("EKSTRE KESİLDİ", `${yesterdayCutoffs.length} adet kartınızın ekstresi dün kesildi.`);
        }
    },
    send(title, body) { new Notification(title, { body, icon: './icon.png' }); }
};

// --- BONUS ---
function showBonusList() { const list = document.getElementById('bonusList'); let total = 0; list.innerHTML = ''; banks.forEach(b => { (b.cards || []).forEach((c, idx) => { if (c.bonus > 0) { total += c.bonus; list.innerHTML += `<div onclick="openEditCard('${b.id}', ${idx})" class="ak-card p-4 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 active:bg-yellow-50"><div class="flex flex-col"><span class="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase">${b.name}</span><span class="text-[9px] text-gray-400 uppercase font-bold">${c.name}</span></div><span class="text-sm font-bold text-yellow-600">${formatMoney(c.bonus)}</span></div>`; } }); }); if (total === 0) list.innerHTML = '<p class="text-xs text-gray-400 text-center py-8 italic uppercase">Birikmiş bonus bulunmuyor.</p>'; document.getElementById('totalBonusAmount').innerText = formatMoney(total); showModal('bonusModal'); }

// --- UTILS ---
const formatMoney = v => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(v || 0) + " TL";
const formatDate = d => d ? d.split('-').reverse().join('.') : "-";
function getRelativeInfo(d) { if (!d) return { text: "", color: "" }; const diff = Math.round((new Date(d) - new Date().setHours(0, 0, 0, 0)) / 86400000); if (diff < 0) return { text: `${Math.abs(diff)} GÜN GEÇTİ`, color: "text-red-500" }; if (diff === 0) return { text: "BUGÜN", color: "text-orange-600" }; return { text: `${diff} GÜN KALDI`, color: "text-blue-500" }; }
function navigateToDate(d) { switchTab('takvim'); setTimeout(() => { if (CalendarManager) { CalendarManager.showDayDetail(d); document.getElementById('dayDetailPanel').scrollIntoView({ behavior: 'smooth' }); } }, 400); }
function toggleSection(id, header) {
    const el = document.getElementById(id); if (!el) return;
    const isHidden = el.classList.toggle('hidden');
    const icon = header.querySelector('.toggle-icon');
    if (icon) icon.innerText = isHidden ? '▶' : '▼';
}
function showModal(id) {
    document.getElementById(id).classList.remove('hidden');
    history.pushState({ modal: id }, "", "");
}
function closeModal(id, isBack = false) {
    document.getElementById(id).classList.add('hidden');
    if (!isBack && history.state && history.state.modal === id) {
        history.back();
    }
}

// --- BOOT ---
function initApp() {
    if (db) loadFromCloud().then(() => { renderAll(); NotificationManager.requestPermission().then(granted => { if (granted) NotificationManager.scheduleAll(); }); setInterval(() => NotificationManager.checkAndNotify(), 60000); });
    else { renderAll(); NotificationManager.requestPermission().then(granted => { if (granted) NotificationManager.scheduleAll(); }); setInterval(() => NotificationManager.checkAndNotify(), 60000); }
}
window.addEventListener('load', () => {
    document.querySelectorAll('.modal-overlay').forEach(overlay => { overlay.addEventListener('click', () => { if (overlay.id !== 'pinScreen' && overlay.id !== 'pinChangeModal') closeModal(overlay.id); }); });
    if (!isAuthenticated) { document.getElementById('pinScreen').style.display = 'flex'; }
    history.replaceState({ tab: 'ozet' }, "", "");
});
