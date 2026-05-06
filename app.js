// app.js - Wird erst nach erfolgreichem Login geladen!

window._initApp = async function(u) {
    document.getElementById("_la").style.display = "none";
    document.getElementById("_a").style.display = "block";
    document.querySelectorAll("._cur_user").forEach(el => el.textContent = u.email);
    
    // Logout Button Logik
    document.querySelectorAll("._lo_btn").forEach(btn => btn.onclick = async () => {
        await window._c.auth.signOut(); 
        location.reload();
    });

    // Prüfen, ob Admin
    const { data: p } = await window._c.from('profiles').select('is_admin').eq('id', u.id).maybeSingle();
    if (p && p.is_admin) {
        document.getElementById("_an").style.display = "flex";
        _loadAdminPanel();
    }
    
    _startInactivityTimer();
    _loadUserEntries(u);
    
    document.getElementById("_sb").onclick = _saveEntry;

    // Navigation (Meine Einträge / Admin Zentrale)
    document.getElementById("_na").onclick = () => {
        document.getElementById("_a").style.display = "none";
        document.getElementById("_av").style.display = "block";
        document.getElementById("_na").classList.add("_ax");
        document.getElementById("_nu").classList.remove("_ax");
    };
    document.getElementById("_nu").onclick = () => {
        document.getElementById("_av").style.display = "none";
        document.getElementById("_a").style.display = "block";
        document.getElementById("_nu").classList.add("_ax");
        document.getElementById("_na").classList.remove("_ax");
    };
};

async function _saveEntry() {
    if (window._isLimited('save')) return;
    const f = { d: document.getElementById("_d"), s: document.getElementById("_s"), di: document.getElementById("_di"), w: document.getElementById("_w"), au: document.getElementById("_au"), g: document.getElementById("_g"), b: document.getElementById("_be") };
    if (!f.d.value || !f.s.value || !f.di.value || !f.w.value || !f.au.value) return alert("Pflichtfelder fehlen!");
    
    const { data: { user } } = await window._c.auth.getUser();
    const { error } = await window._c.from("entries").insert([{ user_id: user.id, datum: f.d.value, gastschuetze: f.g.value.trim(), schiessstand: f.s.value, disziplin: f.di.value.trim(), waffe: f.w.value.trim(), aufsicht: f.au.value.trim(), bemerkung: f.b.value.trim(), status: 'offen' }]);
    
    if (error) alert("Fehler beim Speichern.");
    else { alert("Erfolgreich gespeichert!"); Object.values(f).forEach(x => x.value = ""); _loadUserEntries(user); }
}

async function _loadUserEntries(u) {
    if (!u) {
        const { data: { user } } = await window._c.auth.getUser();
        u = user;
    }
    if (u.email === "gast@ssv.de") return;
    const { data } = await window._c.from("entries").select("*").eq('user_id', u.id).order("datum", { ascending: false });
    const l = document.getElementById("_ls"); l.innerHTML = "";
    if (data) data.forEach(e => {
        const i = document.createElement("li"), c = e.status === 'bestätigt' ? '_s1' : '_s0';
        i.innerHTML = `<span class="_sb_badge ${c}">${e.status || 'offen'}</span><strong>${e.datum}</strong><br><small>${e.disziplin} | ${e.waffe}</small>`;
        l.appendChild(i);
    });
}

async function _loadAdminPanel() {
    const { data } = await window._c.from('profiles').select('id,email');
    const s = document.getElementById("_ms");
    if (data) {
        s.innerHTML = '<option value="all">-- Alle Mitglieder --</option>';
        data.forEach(m => { let o = document.createElement("option"); o.value = m.id; o.textContent = m.email; s.appendChild(o); });
    }
    _refreshOpenRequests();
}

async function _refreshOpenRequests() {
    const { data: e } = await window._c.from('entries').select('*').eq('status', 'offen').order('datum', { ascending: true });
    const { data: p } = await window._c.from('profiles').select('id,email');
    const l = document.getElementById("_al");
    l.innerHTML = e?.length ? "" : "<li>Keine offenen Anfragen.</li>";
    if (e) e.forEach(x => {
        const r = p.find(z => z.id === x.user_id), i = document.createElement("li");
        
        // Datum umwandeln von JJJJ-MM-TT zu TT.MM.JJJJ
        const dParts = x.datum.split('-');
        const formattedDate = `${dParts[2]}.${dParts[1]}.${dParts[0]}`;

        i.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <strong style="color: var(--t);">${r ? r.email : 'Unbekannt'}</strong>
                <span>${formattedDate}</span>
            </div>
            <div style="font-size: 0.85em; color: #444; line-height: 1.5; background: #f0f0f0; padding: 8px; border-radius: 4px;">
                ${x.gastschuetze ? `<strong>Gast:</strong> ${x.gastschuetze}<br>` : ''}
                <strong>Stand:</strong> ${x.schiessstand} | <strong>Disziplin:</strong> ${x.disziplin}<br>
                <strong>Waffe:</strong> ${x.waffe}<br>
                <strong>Aufsicht:</strong> ${x.aufsicht}
            </div>
            <button onclick="window._approveEntry('${x.id}')" class="_ba">✓ Jetzt Freigeben</button>`;
        l.appendChild(i);
    });
}

window._approveEntry = async function(id) {
    await window._c.from('entries').update({ status: 'bestätigt' }).eq('id', id);
    _refreshOpenRequests();
};

async function _getExportData() {
    const period = document.getElementById("_ex_period").value;
    if (!period) { alert("Bitte wähle erst einen Zeitraum aus!"); return null; }
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
    if (error || !entries || entries.length === 0) { alert("Keine Daten gefunden."); return null; }
    return entries.map(row => {
        const u = profiles.find(p => p.id === row.user_id);
        return {
            Datum: row.datum,
            Email: u ? u.email : 'Unbekannt',
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
    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Schießnachweis");
    window.XLSX.writeFile(wb, `SSV_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
};

document.getElementById("_pdf").onclick = async () => {
    const data = await _getExportData();
    if (!data) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.text("SSV Schmidhausen Export", 14, 15);
    doc.autoTable({ head: [Object.keys(data[0])], body: data.map(v => Object.values(v)), startY: 20 });
    doc.save(`SSV_Export_${new Date().toISOString().split('T')[0]}.pdf`);
};

function _startInactivityTimer() {
    let t;
    const r = () => { clearTimeout(t); t = setTimeout(() => { window._c.auth.signOut(); location.reload(); }, 300000); };
    ['mousedown', 'keypress', 'touchstart'].forEach(e => window.addEventListener(e, r));
    r();
}