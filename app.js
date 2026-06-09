window._initApp = async function(u) {
    // Schicke Styles für Toasts, Fortschrittsbalken und Admin-Karten injizieren
    _injectPremiumStyles();
    
    // Login-Maske ausblenden, Hauptbereich anzeigen
    document.getElementById("_la").style.display = "none";
    document.getElementById("_a").style.display = "block";
    
    // Aktuellen Benutzer überall eintragen
    document.querySelectorAll("._cur_user").forEach(el => el.textContent = u.email);
    
    // Logout-Buttons aktivieren
    document.querySelectorAll("._lo_btn").forEach(btn => {
        btn.onclick = async () => {
            await window._c.auth.signOut();
            location.reload();
        };
    });
    
    // Admin-Rechte prüfen und Dashboard anpassen
    const { data: p } = await window._c.from('profiles').select('is_admin').eq('id', u.id).maybeSingle();
    if (p && p.is_admin) {
        document.getElementById("_an").style.display = "flex";
        _loadAdminPanel();
    }
    
    // Sicherheitsfeatures & Komfort-Funktionen starten
    _startInactivityTimer();
    _updateDatalists();
    _loadUserEntries(u);
    
    // Event-Handler für Buttons setzen
    document.getElementById("_sb").onclick = _saveEntry;
    
    document.getElementById("_na").onclick = () => {
        document.getElementById("_a").style.display = "none";
        document.getElementById("_av").style.display = "block";
        document.getElementById("_na").classList.add("_ax");
        document.getElementById("_nu").classList.remove("_ax");
        _refreshOpenRequests();
    };
    
    document.getElementById("_nu").onclick = () => {
        document.getElementById("_av").style.display = "none";
        document.getElementById("_a").style.display = "block";
        document.getElementById("_nu").classList.add("_ax");
        document.getElementById("_na").classList.remove("_ax");
    };
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
    const wHist = JSON.parse(localStorage.getItem("_hist_w") || "[]");
    const auHist = JSON.parse(localStorage.getItem("_hist_au") || "[]");
    const inW = document.getElementById("_w");
    const inAu = document.getElementById("_au");
    
    if (inW) {
        inW.setAttribute("autocomplete", "off");
        inW.setAttribute("list", "_dl_w");
        let dlW = document.getElementById("_dl_w") || document.createElement("datalist");
        dlW.id = "_dl_w";
        dlW.innerHTML = wHist.map(x => `<option value="${x}"></option>`).join('');
        if (!dlW.parentNode) document.body.appendChild(dlW);
    }
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
    
    if (!f.d.value || !f.s.value || !f.ty.value || !f.di.value || !f.w.value || !f.au.value) {
        return _toast("Pflichtfelder fehlen!", "error");
    }
    
    const inputDate = new Date(f.d.value);
    const dayOfWeek = inputDate.getDay(); // 0 = Sonntag, 3 = Mittwoch, 5 = Freitag
    
    if (dayOfWeek !== 0 && dayOfWeek !== 3 && dayOfWeek !== 5) {
        if (!f.b.value.trim()) {
            return _toast("Für abweichende Tage (außer Mi, Fr, So) MUSS eine Bemerkung eingetragen werden!", "error");
        }
    }
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    if (inputDate > today) return _toast("Fehler: Das Datum darf nicht in der Zukunft liegen.", "error");
    if (inputDate < twelveMonthsAgo) return _toast("Fehler: Der Eintrag darf nicht älter als 12 Monate sein.", "error");
    
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
        
        let wHist = JSON.parse(localStorage.getItem("_hist_w") || "[]");
        let auHist = JSON.parse(localStorage.getItem("_hist_au") || "[]");
        
        if (f.w.value.trim() && !wHist.includes(f.w.value.trim())) {
            wHist.unshift(f.w.value.trim());
            localStorage.setItem("_hist_w", JSON.stringify(wHist.slice(0, 3)));
        }
        if (f.au.value.trim() && !auHist.includes(f.au.value.trim())) {
            auHist.unshift(f.au.value.trim());
            localStorage.setItem("_hist_au", JSON.stringify(auHist.slice(0, 3)));
        }
        
        _updateDatalists();
        Object.values(f).forEach(x => x.value = "");
        _loadUserEntries(user);
        
        if (document.getElementById("_an").style.display === "flex") {
            _refreshOpenRequests();
        }
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
    
    // Alle Einträge des aktuellen Kalenderjahres filtern
    const yearEntries = data ? data.filter(e => e.datum && e.datum.startsWith(currentYear.toString())) : [];
    
    // Monate sammeln, in denen geschossen wurde (0 = Jan, 11 = Dez)
    const monthsWithEntries = new Set();
    yearEntries.forEach(e => {
        if (e.datum) {
            monthsWithEntries.add(parseInt(e.datum.split('-')[1], 10) - 1);
        }
    });
    
    // Überprüfen, ob bis zum aktuellen Monat wirklich in jedem Monat geschossen wurde
    let istRegelmaessig = true;
    for (let m = 0; m <= currentMonth; m++) {
        if (!monthsWithEntries.has(m)) {
            istRegelmaessig = false;
            break;
        }
    }
    
    // ZIEL & FORTSCHRITT LOGIK-FIX:
    // Regelmäßig: Ziel ist 12, gezählt werden nur die einzigartigen Monate (Max. 1 pro Monat)
    // Unregelmäßig: Ziel ist 18, gezählt werden alle Einträge aufsummiert
    const targetEntries = istRegelmaessig ? 12 : 18;
    const entriesThisYear = istRegelmaessig ? monthsWithEntries.size : yearEntries.length;
    
    // UI Texte aktualisieren
    document.getElementById("_db_year") && (document.getElementById("_db_year").textContent = currentYear);
    document.getElementById("_db_count") && (document.getElementById("_db_count").textContent = entriesThisYear);
    document.getElementById("_db_target") && (document.getElementById("_db_target").textContent = targetEntries);
    
    const dbCircle = document.getElementById("_db_circle");
    if (dbCircle) {
        dbCircle.textContent = entriesThisYear;
        let color = "#1b7e43";
        
        if (entriesThisYear >= targetEntries) {
            color = "#1b7e43";
            if (!dbCircle.dataset.celebrated) {
                _triggerConfetti();
                dbCircle.dataset.celebrated = "true";
            }
        } else if (entriesThisYear >= (targetEntries / 2)) {
            color = "#f1c40f";
        } else {
            color = "#e74c3c";
        }
        
        dbCircle.style.backgroundColor = color;
        dbCircle.style.color = "#fff";
        dbCircle.style.width = "45px";
        dbCircle.style.height = "45px";
        dbCircle.style.borderRadius = "50%";
        
        let pWrap = document.getElementById("_db_p_wrap");
        if (!pWrap) {
            pWrap = document.createElement("div");
            pWrap.id = "_db_p_wrap";
            pWrap.className = "_progress_container";
            pWrap.innerHTML = `<div id="_db_p_bar" class="_progress_bar"></div>`;
            dbCircle.parentNode.insertBefore(pWrap, dbCircle.nextSibling);
        }
        
        const pct = Math.min(100, (entriesThisYear / targetEntries) * 100);
        const pBar = document.getElementById("_db_p_bar");
        setTimeout(() => {
            pBar.style.width = pct + "%";
            pBar.style.backgroundColor = color;
        }, 100);
    }
    
    // Eintragsliste rendern
    const l = document.getElementById("_ls");
    l.innerHTML = "";
    let hasOlderEntries = false, olderEntriesCount = 0;
    
    if (data) {
        data.forEach(e => {
            const i = document.createElement("li"), c = e.status === 'bestätigt' ? '_s1' : '_s0';
            i.innerHTML = `<span class="_sb_badge ${c}">${e.status || 'offen'}</span><strong>${e.datum}</strong> (${e.typ || 'Training'})<br><small>${e.disziplin} | ${e.waffe}</small>`;
            
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
            toggleLi.innerHTML = `<button id="_btn_toggle_older" class="_btn_secondary">▼ Ältere Einträge anzeigen (${olderEntriesCount})</button>`;
            l.appendChild(toggleLi);
            
            toggleLi.querySelector("#_btn_toggle_older").onclick = function() {
                const elements = l.querySelectorAll("._older_entry");
                const isHidden = elements[0].style.display === "none";
                elements.forEach(el => el.style.display = isHidden ? "block" : "none");
                this.textContent = isHidden ? `▲ Ältere Einträge ausblenden` : `▼ Ältere Einträge anzeigen (${olderEntriesCount})`;
                this.classList.toggle("_btn_active", isHidden);
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
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="_spinner"></span>`;
    }
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
    if (!period) {
        _toast("Bitte wähle erst einen Zeitraum aus!", "error");
        return null;
    }
    
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
    if (error || !entries || entries.length === 0) {
        _toast("Keine Daten gefunden.", "error");
        return null;
    }
    
    return entries.map(row => {
        const u = profiles.find(p => p.id === row.user_id);
        return {
            Datum: row.datum,
            Email: u ? u.email : 'Unbekannt',
            Typ: row.typ || 'Training',
            Schießstand: row.schiessstand,
            Disziplin: row.disziplin,
            Waffe: row.waffe,
            Aufsicht: row.aufsicht,
            Gast: row.gastschuetze || '-',
            Status: row.status
        };
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
    doc.autoTable({
        head: [Object.keys(data[0])],
        body: data.map(v => Object.values(v)),
        startY: 20
    });
    
    doc.save(`SSV_Export_${nameSuffix}_${new Date().toISOString().split('T')[0]}.pdf`);
    _toast("PDF-Export erfolgreich generiert!", "success");
};

function _startInactivityTimer() {
    let t;
    const r = () => {
        clearTimeout(t);
        t = setTimeout(() => {
            window._c.auth.signOut();
            location.reload();
        }, 300000); // 5 Minuten Inaktivitätstimer
    };
    ['mousedown', 'keypress', 'touchstart'].forEach(e => window.addEventListener(e, r));
    r();
}

function _injectPremiumStyles() {
    if (document.getElementById("_premium_styles")) return;
    const s = document.createElement("style");
    s.id = "_premium_styles";
    s.innerHTML = `
        ._toast{position:fixed;bottom:-100px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:8px;color:#fff;font-weight:bold;font-size:0.95em;z-index:10000;box-shadow:0 4px 15px rgba(0,0,0,0.2);transition:bottom 0.35s cubic-bezier(0.175,0.885,0.32,1.275),opacity 0.3s;opacity:0;min-width:280px;text-align:center;}
        ._toast_show{bottom:25px;opacity:1;}
        ._toast_success{background-color:#2ecc71;}
        ._toast_error{background-color:#e74c3c;}
        ._progress_container{width:65%;background:#e0e0e0;border-radius:10px;height:8px;margin:12px 0 12px auto;overflow:hidden;}
        ._progress_bar{height:100%;width:0%;transition:width 0.8s ease-out,background-color 0.5s;}
        #_db_circle{margin-left:auto !important;display:flex;align-items:center;justify-content:center;transition:all 0.3s ease;width:40px;height:40px;border-radius:50%;font-weight:bold;}
        ._spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-radius:50%;border-top-color:#fff;animation:_spin 0.6s linear infinite;margin-right:6px;vertical-align:middle;}
        @keyframes _spin{to{transform:rotate(360deg);}}
        ._admin_card{display:block;background:white;list-style:none;padding:12px;margin-bottom:12px;border-radius:6px;box-shadow:0 2px 5px rgba(0,0,0,0.05);transition:transform 0.35s ease-in,opacity 0.3s,margin-bottom 0.35s,padding 0.35s,height 0.35s;max-height:300px;opacity:1;}
        ._card_exc{border-left:4px solid #e67e22;background-color:#fffaf4;}
        ._card_details{font-size:0.85em;color:#444;line-height:1.5;padding:8px;border-radius:4px;margin-bottom:8px;}
        ._card_dismiss{transform:translateX(120%);opacity:0;max-height:0;padding:0;margin-bottom:0;overflow:hidden;}
        ._btn_secondary{background-color:#7f8c8d;color:white;border:none;padding:8px 14px;border-radius:4px;cursor:pointer;font-size:0.85em;font-weight:bold;width:100%;transition:background 0.2s;}
        ._btn_active{background-color:var(--primary) !important;}
        ._sb_badge{padding:3px 6px;border-radius:4px;color:white;font-size:0.75em;font-weight:bold;margin-right:8px;text-transform:uppercase;}
        ._s1{background:#2ecc71;}
        ._s0{background:#f39c12;}
        ._confetti{position:fixed;top:-10px;width:8px;height:8px;z-index:9999;pointer-events:none;opacity:0.8;animation:_fall linear forwards;}
        @keyframes _fall{to{transform:translateY(105vh) rotate(360deg);opacity:0;}}
    `;
    document.head.appendChild(s);
}