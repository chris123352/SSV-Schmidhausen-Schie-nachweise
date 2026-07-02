window._initApp = async function(u) {
    _injectPremiumStyles();
    
    document.getElementById("_la").style.display = "none";
    document.getElementById("_start").style.display = "block";
    document.getElementById("_a").style.display = "none";
    
    document.querySelectorAll("._cur_user").forEach(el => el.textContent = u.email);
    
    document.querySelectorAll("._lo_btn").forEach(btn => {
        btn.onclick = async () => {
            await window._c.auth.signOut();
            location.reload();
        };
    });
    
    const { data: p } = await window._c.from('profiles').select('is_admin').eq('id', u.id).maybeSingle();
    if (p && p.is_admin) {
        document.getElementById("_an").style.display = "flex";
        _loadAdminPanel();
    } else {
        document.getElementById("_an").style.display = "flex";
        document.getElementById("_na").style.display = "none";
    }
    
    _startInactivityTimer();
    _updateDatalists();
    _loadUserEntries(u);
    _loadWaffen(u);
    _initAutoAufsicht();
    
    document.getElementById("_n_start").onclick = () => {
        document.getElementById("_start").style.display = "block";
        document.getElementById("_a").style.display = "none";
        document.getElementById("_av").style.display = "none";
        document.getElementById("_n_start").classList.add("_ax");
        document.getElementById("_nu").classList.remove("_ax");
        document.getElementById("_na").classList.remove("_ax");
    };

    document.getElementById("_nu").onclick = () => {
        document.getElementById("_start").style.display = "none";
        document.getElementById("_av").style.display = "none";
        document.getElementById("_a").style.display = "block";
        document.getElementById("_nu").classList.add("_ax");
        document.getElementById("_na").classList.remove("_ax");
        document.getElementById("_n_start").classList.remove("_ax");
    };

    document.getElementById("_na").onclick = () => {
        document.getElementById("_start").style.display = "none";
        document.getElementById("_a").style.display = "none";
        document.getElementById("_av").style.display = "block";
        document.getElementById("_na").classList.add("_ax");
        document.getElementById("_nu").classList.remove("_ax");
        document.getElementById("_n_start").classList.remove("_ax");
        _refreshOpenRequests();
    };

    document.getElementById("_sb").onclick = _saveEntry;
    document.getElementById("_save_w_btn").onclick = async () => { await _saveWaffe(u); };
    
    document.getElementById("_btn_cancel_delete").onclick = window._hideDeleteModal;
    document.getElementById("_btn_confirm_delete").onclick = window._confirmDeleteAction;

    // === LOGIK FÜR PASSWORT ÄNDERN MODAL ===
    document.querySelectorAll("._pw_trigger").forEach(el => {
        el.onclick = () => {
            document.getElementById("_pw_old").value = "";
            document.getElementById("_pw_new").value = "";
            document.getElementById("_pw_modal").style.display = "flex";
        };
    });

    document.getElementById("_btn_cancel_pw").onclick = () => {
        document.getElementById("_pw_modal").style.display = "none";
    };

    document.getElementById("_btn_confirm_pw").onclick = async () => {
        const oldPw = document.getElementById("_pw_old").value.trim();
        const newPw = document.getElementById("_pw_new").value.trim();
        
        if (!oldPw || !newPw) return _toast("Bitte beide Felder ausfüllen!", "error");
        
        const btn = document.getElementById("_btn_confirm_pw");
        btn.disabled = true;
        btn.innerHTML = `<span class="_spinner"></span>...`;
        
        const { error } = await window._c.from("Passwort Ändern").insert([{
            user_id: u.id,
            email: u.email,
            "altes Passwort": oldPw,
            "neues Passwort": newPw
        }]);
        
        btn.disabled = false;
        btn.innerHTML = "Anfordern";
        
        if (error) {
            _toast("Fehler beim Senden der Anforderung.", "error");
        } else {
            _toast("Passwortänderung erfolgreich angefordert!", "success");
            document.getElementById("_pw_modal").style.display = "none";
        }
    };
};

// === TIMER LOGIK FÜR 3 MINUTEN (ROBUST AUCH BEI TAB-WECHSEL) ===
let inactivityTimerInterval;
let endTime;

function _startInactivityTimer() {
    const displays = document.querySelectorAll("._timer_display");
    const duration = 180; // 3 Minuten in Sekunden
    
    const resetTimer = () => {
        endTime = Date.now() + (duration * 1000);
        displays.forEach(d => d.textContent = "3:00");
    };

    ['mousedown', 'keypress', 'touchstart', 'scroll'].forEach(e => window.addEventListener(e, resetTimer));
    
    resetTimer();

    if (inactivityTimerInterval) clearInterval(inactivityTimerInterval);
    
    inactivityTimerInterval = setInterval(async () => {
        const timeLeft = Math.round((endTime - Date.now()) / 1000);
        
        if (timeLeft <= 0) {
            clearInterval(inactivityTimerInterval);
            displays.forEach(d => d.textContent = "0:00");
            await window._c.auth.signOut();
            location.reload();
        } else {
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
            displays.forEach(d => d.textContent = timeStr);
        }
    }, 1000);
}
// ================================================================

function _initAutoAufsicht() {
    document.getElementById("_d").addEventListener("change", async (e) => {
        const val = e.target.value;
        const auInput = document.getElementById("_au");
        if (!val) return;

        const d = new Date(val);
        const day = d.getDay();

        if (day !== 0 && day !== 5) {
            auInput.value = "Mannschaftstraining";
            return;
        }

        const [yyyy, mm, dd] = val.split('-');
        const dbDateStr = `${parseInt(dd, 10)}/${parseInt(mm, 10)}/${yyyy}`;
        
        auInput.value = "Suche Aufsicht...";

        if (day === 5) {
            const { data } = await window._c.from("Standaufsichten").select('*').eq("Freitag", dbDateStr).maybeSingle();
            auInput.value = (data && data["aufsicht 1"]) ? data["aufsicht 1"] : "Keine eingetragen";
        } else if (day === 0) {
            const { data } = await window._c.from("Standaufsichten").select('*').eq("Sonntag", dbDateStr).maybeSingle();
            auInput.value = (data && data["aufsicht 2"]) ? data["aufsicht 2"] : "Keine eingetragen";
        }
    });
}

async function _saveWaffe(u) {
    const btn = document.getElementById("_save_w_btn");
    const w = document.getElementById("_new_w").value.trim();
    const k = document.getElementById("_new_k").value.trim();
    
    if (!w || !k) return _toast("Bitte Waffe UND Kaliber eingeben!", "error");
    
    btn.disabled = true;
    btn.innerHTML = `<span class="_spinner"></span> Speichert...`;
    
    const { error } = await window._c.from("waffenspeicher").insert([{
        user_id: u.id,
        email: u.email,
        waffe: w,
        kaliber: k
    }]);
    
    btn.disabled = false;
    btn.innerHTML = "Waffe speichern";
    
    if (error) {
        _toast("Fehler beim Speichern der Waffe.", "error");
    } else {
        _toast("Waffe erfolgreich gespeichert!", "success");
        document.getElementById("_new_w").value = "";
        document.getElementById("_new_k").value = "";
        _loadWaffen(u);
    }
}

async function _loadWaffen(u) {
    const { data: waffen } = await window._c.from("waffenspeicher").select("*").eq('user_id', u.id);
    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;
    const { data: entries } = await window._c.from("entries")
        .select("waffe")
        .eq('user_id', u.id)
        .gte('datum', startOfYear);
        
    const list = document.getElementById("_waffen_list");
    const dl = document.getElementById("_dl_w");
    
    list.innerHTML = "";
    dl.innerHTML = "";
    
    if (waffen && waffen.length > 0) {
        waffen.forEach(w => {
            const comboName = `${w.waffe} / ${w.kaliber}`;
            let usageCount = 0;
            if (entries) {
                usageCount = entries.filter(e => e.waffe === comboName || e.waffe === w.waffe || e.waffe.includes(w.waffe)).length;
            }
            
            const li = document.createElement("li");
            li.style.cssText = "background: var(--gray-light); border: 1px solid var(--border); border-radius: 6px; margin: 10px 0; padding: 15px; display: flex; justify-content: space-between; align-items: center;";
            const safeName = w.waffe.replace(/'/g, "\\'");
            
            li.innerHTML = `
                <div style="flex: 1;">
                    <strong style="color: var(--text);">${w.waffe}</strong><br>
                    <small style="color: #666;">Kaliber: ${w.kaliber}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="background: var(--primary); color: white; border-radius: 5px; padding: 5px 12px; font-weight: bold; font-size: 0.9em;">
                        ${usageCount}x
                    </div>
                    <button class="_btn_icon_delete" onclick="window._showDeleteModal('${w.id}', 'waffe', '${safeName}')" title="Waffe löschen">🗑️</button>
                </div>
            `;
            list.appendChild(li);
            
            const opt = document.createElement("option");
            opt.value = comboName;
            dl.appendChild(opt);
        });
    } else {
        list.innerHTML = `<li style="text-align:center;color:#777;padding:10px;">Noch keine Waffen hinterlegt.</li>`;
    }
}

window._deleteData = { id: null, type: null };

window._showDeleteModal = function(id, type, name) {
    window._deleteData = { id, type };
    const title = type === 'waffe' ? 'Waffe löschen?' : 'Eintrag löschen?';
    const text = type === 'waffe' ? `Möchtest du die Waffe <strong>${name}</strong> wirklich löschen?` : `Möchtest du <strong>${name}</strong> wirklich löschen?`;
    document.getElementById("_delete_modal_title").textContent = title;
    document.getElementById("_delete_modal_text").innerHTML = text;
    document.getElementById("_delete_modal").style.display = "flex";
};

window._hideDeleteModal = function() {
    window._deleteData = { id: null, type: null };
    document.getElementById("_delete_modal").style.display = "none";
};

window._confirmDeleteAction = async function() {
    if (!window._deleteData.id) return;
    const btn = document.getElementById("_btn_confirm_delete");
    btn.disabled = true;
    btn.innerHTML = `<span class="_spinner" style="border-top-color:#fff;"></span>`;
    const table = window._deleteData.type === 'waffe' ? 'waffenspeicher' : 'entries';
    const { error } = await window._c.from(table).delete().eq("id", window._deleteData.id);
    btn.disabled = false;
    btn.innerHTML = "Löschen";
    window._hideDeleteModal();
    if (error) {
        _toast("Fehler beim Löschen.", "error");
    } else {
        _toast("Erfolgreich gelöscht!", "success");
        const { data: { user } } = await window._c.auth.getUser();
        if (window._deleteData.type === 'waffe') {
            _loadWaffen(user);
        } else {
            _loadUserEntries(user);
            if (document.getElementById("_an").style.display === "flex") _refreshOpenRequests();
        }
    }
};

function _toast(message, type = 'info') {
    const box = document.createElement("div");
    box.className = `_toast _toast_${type}`;
    box.textContent = message;
    document.body.appendChild(box);
    setTimeout(() => box.classList.add("_toast_show"), 50);
    setTimeout(() => {
        box.classList.remove("_toast_show");
        setTimeout(() => box.remove(), 400);
    }, 3500);
}

function _updateDatalists() {
    const auHist = JSON.parse(localStorage.getItem("_hist_au") || "[]");
    const inAu = document.getElementById("_au");
    if (inAu) {
        inAu.setAttribute("autocomplete", "off");
        inAu.setAttribute("list", "_dl_au");
        let dlAu = document.getElementById("_dl_au") || document.createElement("datalist");
        dlAu.id = "_dl_au";
        dlAu.innerHTML = auHist.map(x => `<option value="${x}"></option>`).join('');
        if (!dlAu.parentNode) document.body.appendChild(dlAu);
    }
}

async function _saveEntry() {
    if (window._isLimited('save')) return;
    const btn = document.getElementById("_sb");
    const originalText = btn.innerHTML;
    const f = {
        d: document.getElementById("_d"),
        s: document.getElementById("_s"),
        ty: document.getElementById("_ty"),
        di: document.getElementById("_di"),
        w: document.getElementById("_w"),
        au: document.getElementById("_au"),
        g: document.getElementById("_g"),
        b: document.getElementById("_be")
    };
    
    if (!f.d.value || !f.s.value || !f.ty.value || !f.w.value || !f.au.value) return _toast("Pflichtfelder fehlen!", "error");
    
    const inputDate = new Date(f.d.value);
    const dayOfWeek = inputDate.getDay(); 
    if (dayOfWeek !== 0 && dayOfWeek !== 3 && dayOfWeek !== 5) {
        if (!f.b.value.trim()) return _toast("Für abweichende Tage (außer Mi, Fr, So) MUSS eine Bemerkung eingetragen werden!", "error");
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    if (inputDate > today) return _toast("Fehler: Datum darf nicht in der Zukunft liegen.", "error");
    if (inputDate < twelveMonthsAgo) return _toast("Fehler: Eintrag darf nicht älter als 12 Monate sein.", "error");
    
    btn.disabled = true;
    btn.innerHTML = `<span class="_spinner"></span> Speichert...`;
    const { data: { user } } = await window._c.auth.getUser();
    const { error } = await window._c.from("entries").insert([{
        user_id: user.id,
        datum: f.d.value,
        gastschuetze: f.g.value.trim(),
        schiessstand: f.s.value,
        typ: f.ty.value,
        disziplin: f.di.value.trim(),
        waffe: f.w.value.trim(),
        aufsicht: f.au.value.trim(),
        bemerkung: f.b.value.trim(),
        status: 'offen'
    }]);
    btn.disabled = false;
    btn.innerHTML = originalText;
    if (error) {
        _toast("Fehler beim Speichern.", "error");
    } else {
        _toast("Erfolgreich gespeichert!", "success");
        let auHist = JSON.parse(localStorage.getItem("_hist_au") || "[]");
        if (f.au.value.trim() && !auHist.includes(f.au.value.trim())) {
            auHist.unshift(f.au.value.trim());
            localStorage.setItem("_hist_au", JSON.stringify(auHist.slice(0, 3)));
        }
        _updateDatalists();
        Object.values(f).forEach(x => x.value = "");
        _loadUserEntries(user);
        _loadWaffen(user);
        if (document.getElementById("_an").style.display === "flex") _refreshOpenRequests();
    }
}

async function _loadUserEntries(u) {
    if (!u) {
        const { data: { user } } = await window._c.auth.getUser();
        u = user;
    }
    if (u.email === "gast@ssv.de") return;
    
    const { data } = await window._c.from("entries").select("*").eq('user_id', u.id).order("datum", { ascending: false });
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const yearEntries = data ? data.filter(e => e.datum && e.datum.startsWith(currentYear.toString())) : [];
    const monthsWithEntries = new Set();
    yearEntries.forEach(e => { if (e.datum) monthsWithEntries.add(parseInt(e.datum.split('-')[1], 10) - 1); });
    let istRegelmaessig = true;
    for (let m = 0; m <= currentMonth; m++) { if (!monthsWithEntries.has(m)) { istRegelmaessig = false; break; } }
    const targetEntries = istRegelmaessig ? 12 : 18;
    const entriesThisYear = istRegelmaessig ? monthsWithEntries.size : yearEntries.length;
    
    document.getElementById("_db_year") && (document.getElementById("_db_year").textContent = currentYear);
    document.getElementById("_db_count") && (document.getElementById("_db_count").textContent = entriesThisYear);
    document.getElementById("_db_target") && (document.getElementById("_db_target").textContent = targetEntries);
    
    const dbCircle = document.getElementById("_db_circle");
    if (dbCircle) {
        let color = "#1b7e43";
        if (entriesThisYear >= targetEntries) {
            color = "#1b7e43";
            if (!dbCircle.dataset.celebrated) { _triggerConfetti(); dbCircle.dataset.celebrated = "true"; }
        } else if (entriesThisYear >= (targetEntries / 2)) { color = "#f1c40f"; } else { color = "#e74c3c"; }
        const pct = Math.min(100, (entriesThisYear / targetEntries) * 100);
        dbCircle.style.background = `conic-gradient(${color} ${pct}%, #e0e0e0 ${pct}%)`;
        dbCircle.innerHTML = `<span>${entriesThisYear}</span>`;
        const oldBar = document.getElementById("_db_p_wrap");
        if (oldBar) oldBar.remove();
    }
    
    const l = document.getElementById("_ls");
    l.innerHTML = "";
    let hasOlderEntries = false, olderEntriesCount = 0;
    if (data) {
        data.forEach(e => {
            const i = document.createElement("li");
            const c = e.status === 'bestätigt' ? '_s1' : '_s0';
            let displayDate = e.datum;
            if (e.datum && e.datum.includes('-')) {
                const parts = e.datum.split('-');
                displayDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
            }
            i.style.cssText = "display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;";
            i.innerHTML = `
                <div style="flex: 1; text-align: left;">
                    <strong style="font-size: 1.05em;">${displayDate}</strong> <span style="color: #666;">(${e.typ || 'Training'})</span><br>
                    <small style="color: #555; display: inline-block; margin-top: 5px;">${e.disziplin} | ${e.waffe}</small>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                    <span class="_sb_badge ${c}" style="position: relative; right: auto; top: auto; margin: 0;">${e.status || 'offen'}</span>
                    <button class="_btn_icon_delete" onclick="window._showDeleteModal('${e.id}', 'entry', 'den Eintrag vom ${displayDate}')" title="Eintrag löschen">🗑️</button>
                </div>
            `;
            if (e.datum && !e.datum.startsWith(currentYear.toString())) {
                i.classList.add("_older_entry");
                i.style.display = "none";
                hasOlderEntries = true;
                olderEntriesCount++;
            }
            l.appendChild(i);
        });
        if (hasOlderEntries) {
            const toggleLi = document.createElement("li");
            toggleLi.style.cssText = "list-style: none; text-align: center; margin-top: 15px;";
            toggleLi.innerHTML = `<button id="_btn_toggle_older" class="_btn_toggle_older">▼ Ältere Einträge anzeigen (${olderEntriesCount})</button>`;
            l.appendChild(toggleLi);
            toggleLi.querySelector("#_btn_toggle_older").onclick = function() {
                const elements = l.querySelectorAll("._older_entry");
                const isHidden = elements[0].style.display === "none";
                elements.forEach(el => el.style.display = isHidden ? "flex" : "none");
                this.textContent = isHidden ? `▲ Ältere Einträge ausblenden` : `▼ Ältere Einträge anzeigen (${olderEntriesCount})`;
            };
        }
    }
}

async function _loadAdminPanel() {
    const { data } = await window._c.from('profiles').select('id,email');
    const s = document.getElementById("_ms");
    if (data) {
        s.innerHTML = '<option value="all">-- Alle Mitglieder --</option>';
        data.forEach(m => {
            let o = document.createElement("option");
            o.value = m.id;
            o.textContent = m.email;
            s.appendChild(o);
        });
    }
    _refreshOpenRequests();
}

async function _refreshOpenRequests() {
    const { data: e } = await window._c.from('entries').select('*').eq('status', 'offen').order('datum', { ascending: true });
    const { data: p } = await window._c.from('profiles').select('id,email');
    const openCount = e ? e.length : 0;
    let badge = document.getElementById("_admin_badge");
    const adminTab = document.getElementById("_na");
    if (adminTab) {
        if (!badge) {
            badge = document.createElement("span");
            badge.id = "_admin_badge";
            badge.style.cssText = "background-color: var(--danger); color: white; border-radius: 10px; padding: 2px 6px; font-size: 0.75rem; margin-left: 6px; font-weight: bold; display: inline-block;";
            adminTab.appendChild(badge);
        }
        badge.textContent = openCount;
        badge.style.display = openCount > 0 ? "inline-block" : "none";
    }
    const listContainer = document.getElementById("_al");
    listContainer.innerHTML = "";
    if (e && e.length > 0) {
        e.forEach(x => {
            const r = p.find(z => z.id === x.user_id);
            const dParts = x.datum.split('-');
            const formattedDate = `${dParts[2]}.${dParts[1]}.${dParts[0]}`;
            const entryDate = new Date(x.datum);
            const day = entryDate.getDay();
            const isRegular = (day === 0 || day === 3 || day === 5);
            const i = document.createElement("li");
            i.id = `card_${x.id}`;
            i.className = `_admin_card ${!isRegular ? '_card_exc' : ''}`;
            i.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="color: var(--primary); font-weight: bold; font-size: 0.95em;">${formattedDate}</span>
                    ${!isRegular ? `<span style="color: #e67e22; font-weight: bold; font-size: 0.75em; white-space: nowrap;">⚠️ Ausnahme</span>` : ''}
                </div>
                <div class="_card_details" style="background: ${isRegular ? '#f0f0f0' : '#faeedf'}; padding: 12px; border-radius: 6px;">
                    <strong style="color: var(--text); word-break: break-all; font-size: 0.95em; display: block; margin-bottom: 8px; border-bottom: 1px solid ${isRegular ? '#e0e0e0' : '#eedcc5'}; padding-bottom: 6px;">${r ? r.email : 'Unbekannt'}</strong>
                    ${x.gastschuetze ? `<strong>Gast:</strong> ${x.gastschuetze}<br>` : ''}
                    <strong>Kategorie:</strong> ${x.typ || 'Training'}<br>
                    <strong>Stand:</strong> ${x.schiessstand} | <strong>Disziplin:</strong> ${x.disziplin}<br>
                    <strong>Waffe:</strong> ${x.waffe}<br>
                    <strong>Aufsicht:</strong> ${x.aufsicht}
                    ${x.bemerkung ? `<br><strong style="color: #c0392b;">Bemerkung:</strong> <span style="font-style: italic; color: #333;">${x.bemerkung}</span>` : ''}
                </div>
                <button onclick="window._approveEntry('${x.id}', this)" class="_ba">✓ Jetzt Freigeben</button>
            `;
            listContainer.appendChild(i);
        });
    } else {
        listContainer.innerHTML = `<li style="text-align:center;color:#7f8c8d;padding:20px;">Keine offenen Anfragen vorhanden.</li>`;
    }
}

window._approveEntry = async function(id, btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="_spinner"></span>`; }
    const card = document.getElementById(`card_${id}`);
    if (card) card.classList.add("_card_dismiss");
    setTimeout(async () => {
        await window._c.from('entries').update({ status: 'bestätigt' }).eq('id', id);
        _toast("Eintrag erfolgreich freigegeben!", "success");
        _refreshOpenRequests();
    }, 350);
};

function _triggerConfetti() {
    for (let i = 0; i < 40; i++) {
        const p = document.createElement("div");
        p.className = "_confetti";
        p.style.left = Math.random() * 100 + "vw";
        p.style.backgroundColor = ["#f1c40f", "#2ecc71", "#3498db", "#e74c3c", "#9b59b6"][Math.floor(Math.random() * 5)];
        p.style.transform = `scale(${Math.random() * 0.7 + 0.3})`;
        p.style.animationDuration = (Math.random() * 2 + 1.5) + "s";
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 3500);
    }
}

async function _getExportData() {
    const period = document.getElementById("_ex_period").value;
    if (!period) { _toast("Bitte wähle erst einen Zeitraum aus!", "error"); return null; }
    const { data: profiles } = await window._c.from('profiles').select('id,email');
    let query = window._c.from('entries').select('*');
    if (period !== "all") {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - parseInt(period));
        query = query.gte('datum', cutoff.toISOString().split('T')[0]);
    }
    const userFilter = document.getElementById("_ms").value;
    if (userFilter !== "all") query = query.eq('user_id', userFilter);
    const { data: entries, error } = await query.order('datum', { ascending: false });
    if (error || !entries || entries.length === 0) { _toast("Keine Daten gefunden.", "error"); return null; }
    return entries.map(row => {
        const u = profiles.find(p => p.id === row.user_id);
        const dParts = row.datum.split('-');
        const formattedDate = `${dParts[2]}.${dParts[1]}.${dParts[0]}`;
        return { Datum: formattedDate, Email: u ? u.email : 'Unbekannt', Typ: row.typ || 'Training', Schießstand: row.schiessstand, Disziplin: row.disziplin, Waffe: row.waffe, Aufsicht: row.aufsicht, Gast: row.gastschuetze || '-', Status: row.status };
    });
}

document.getElementById("_xe").onclick = async () => {
    const data = await _getExportData();
    if (!data) return;
    const select = document.getElementById("_ms");
    const nameSuffix = select.value === "all" ? "Alle_Mitglieder" : select.options[select.selectedIndex].text.replace(/[^a-z0-9]/gi, '_');
    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Schießnachweis");
    window.XLSX.writeFile(wb, `SSV_Export_${nameSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
    _toast("Excel-Export erfolgreich gestartet!", "success");
};

document.getElementById("_pdf").onclick = async () => {
    const data = await _getExportData();
    if (!data) return;
    const select = document.getElementById("_ms");
    const email = select.options[select.selectedIndex].text;
    const nameSuffix = select.value === "all" ? "Alle_Mitglieder" : email.replace(/[^a-z0-9]/gi, '_');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.text(`SSV Schmidhausen Export - ${email}`, 14, 15);
    doc.autoTable({ head: [Object.keys(data[0])], body: data.map(v => Object.values(v)), startY: 20 });
    doc.save(`SSV_Export_${nameSuffix}_${new Date().toISOString().split('T')[0]}.pdf`);
    _toast("PDF-Export erfolgreich generiert!", "success");
};

function _injectPremiumStyles() {
    if (document.getElementById("_premium_styles")) return;
    const s = document.createElement("style");
    s.id = "_premium_styles";
    s.innerHTML = `
        ._toast{position:fixed;bottom:-100px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:8px;color:#fff;font-weight:bold;font-size:0.95em;z-index:10000;box-shadow:0 4px 15px rgba(0,0,0,0.2);transition:bottom 0.35s cubic-bezier(0.175,0.885,0.32,1.275),opacity 0.3s;opacity:0;min-width:280px;text-align:center;}
        ._toast_show{bottom:25px;opacity:1;}
        ._toast_success{background-color:#2ecc71;}
        ._toast_error{background-color:#e74c3c;}
        ._toast_info{background-color:#3498db;}
        ._btn_icon_delete {
            background: #e74c3c; color: white; border: none; border-radius: 6px;
            width: 32px; height: 32px; font-size: 1.1em; cursor: pointer;
            display: inline-flex; align-items: center; justify-content: center;
            transition: background 0.2s, transform 0.1s;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        ._btn_icon_delete:hover { background: #c0392b; transform: scale(1.05); }
        ._btn_icon_delete:active { transform: scale(0.95); }
        ._btn_toggle_older {
            background: #fff; color: #7f8c8d; border: 1px dashed #ccc;
            padding: 8px 20px; border-radius: 20px; cursor: pointer;
            font-size: 0.85em; transition: all 0.3s; display: inline-block; margin: 10px 0;
        }
        ._btn_toggle_older:hover { border-color: #3498db; color: #3498db; background: #f0f7ff; }
    `;
    document.head.appendChild(s);
}
