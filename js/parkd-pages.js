/**
 * Parkd — page controllers (set body data-page="...")
 */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page && ParkdPages[page]) ParkdPages[page]().catch(e => console.error(page, e));
});

const ParkdPages = {
  async dashboard() {
    if (!ParkdAPI.requireAuth()) return;
    ParkdApp.setTopDate();
    const me = await ParkdAPI.request('/api/users/me');
    ParkdApp.applyUserShell({ name: me.NAME, planType: me.PLAN_TYPE });

    const planName = document.querySelector('.plan-name');
    const planPrice = document.querySelector('.plan-price');
    if (planName) planName.textContent = ParkdApp.tierLabel(me.PLAN_TYPE);
    if (planPrice) planPrice.textContent = ParkdApp.rupee(me.PRICE) + (me.PLAN_TYPE === 'general' ? ' / hr' : ' / month');

    const vehicles = await ParkdAPI.request('/api/vehicles');
    const strip = document.querySelector('.vehicle-strip');
    if (strip && vehicles.length) {
      const v = vehicles[0];
      strip.querySelector('.veh-num').textContent = v.VEHICLE_NUMBER;
      strip.querySelector('.veh-type').textContent = v.VEHICLE_TYPE + ' · Primary vehicle';
    }

    const card = document.querySelector('.session-card');
    try {
      const t = await ParkdAPI.request('/api/tickets/active');
      if (card) {
        card.style.display = '';
        card.querySelector('.sess-slot').textContent = t.SLOT_NUMBER;
        const meta = card.querySelectorAll('.sess-meta-item');
        if (meta[0]) meta[0].textContent = `${t.ZONE_NAME} · ${t.FACILITY_NAME}`;
        if (meta[1]) meta[1].textContent = `Entry ${ParkdApp.fmtTime(t.ENTRY_TIME)}`;
        if (meta[2]) meta[2].textContent = ParkdApp.fmtDate(t.ENTRY_DATE || t.ENTRY_DAY);
        const entryMs = new Date(t.ENTRY_TIME).getTime();
        const tick = () => {
          const s = Math.max(0, Math.floor((Date.now() - entryMs) / 1000));
          const p = n => String(n).padStart(2, '0');
          const el = document.getElementById('liveTimer');
          if (el) el.textContent = `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
        };
        tick();
        setInterval(tick, 1000);
        localStorage.setItem('parkd_active_record', String(t.RECORD_ID));
        localStorage.setItem('parkd_active_bill', String(t.BILL_ID));
      }
    } catch (e) {
      if (card && e.status === 404) {
        card.innerHTML = '<div class="sess-inner" style="padding:32px"><p>No active session.</p><a href="slots.html" class="btn btn-f" style="margin-top:16px">Book a slot</a></div>';
      }
    }

    try {
      const hist = await ParkdAPI.request('/api/records?status=completed');
      const list = document.querySelector('.history-card');
      if (list) {
        const items = list.querySelectorAll('.hist-item');
        items.forEach((el, i) => {
          const r = hist[i];
          if (!r) { el.style.display = 'none'; return; }
          el.style.display = '';
          el.querySelector('.hi-name').textContent = r.FACILITY_NAME || 'Parking';
          el.querySelector('.hi-detail').textContent =
            `${r.ZONE_NAME} · ${r.SLOT_NUMBER} · ${ParkdApp.fmtDate(r.EXIT_DATE || r.ENTRY_DATE)}`;
          el.querySelector('.hi-amount').textContent = ParkdApp.rupee(r.AMOUNT || 0);
          const badge = el.querySelector('.badge');
          if (badge) {
            badge.textContent = r.PAYMENT_STATUS === 'paid' ? 'Paid' : 'Pending';
            badge.className = 'badge ' + (r.PAYMENT_STATUS === 'paid' ? 'badge-paid' : 'badge-pending');
          }
        });
      }
      const statVal = document.querySelectorAll('.stat-val');
      const totalSessions = hist.length;
      const totalAmount = hist.reduce((s, r) => s + Number(r.AMOUNT || 0), 0);
      const totalHours = hist.reduce((s, r) => {
        if (!r.ENTRY_TIME || !r.EXIT_DATE) return s;
        const h = (new Date(r.EXIT_DATE) - new Date(r.ENTRY_TIME)) / 3600000;
        return s + (isFinite(h) && h > 0 ? h : 0);
      }, 0);
      if (statVal[0]) statVal[0].textContent = String(totalSessions);
      if (statVal[1]) statVal[1].textContent = ParkdApp.rupee(totalAmount);
      if (statVal[2]) statVal[2].textContent = totalHours.toFixed(1);
    } catch (_) {}

    window.openPlanModal = async () => {
      const modal = document.getElementById('planModalOverlay');
      const body = document.getElementById('planModalBody');
      if (!modal || !body) return;
      modal.classList.add('show');
      body.innerHTML = 'Loading plans...';
      try {
        const plans = await ParkdAPI.request('/api/users/plans');
        body.innerHTML = plans.map(p => `
          <div class="plan-opt" onclick="selectPlan(${p.PLAN_ID}, ${p.PRICE}, '${ParkdApp.tierLabel(p.PLAN_TYPE)}')">
            <div class="plan-opt-head">
              <div class="plan-opt-title">${ParkdApp.tierLabel(p.PLAN_TYPE)}</div>
              <div class="plan-opt-price">${ParkdApp.rupee(p.PRICE)} / ${p.DURATION_TYPE}</div>
            </div>
            <div style="font-size:0.75rem;color:var(--gray-d1)">Click to switch to this plan</div>
          </div>
        `).join('');
      } catch(e) {
        body.innerHTML = '<div style="color:red">Failed to load plans</div>';
      }
    };

    window.closePlanModal = () => {
      const modal = document.getElementById('planModalOverlay');
      if (modal) modal.classList.remove('show');
    };

    window.selectPlan = async (planId, price, planName) => {
      closePlanModal();
      const pModal = document.createElement('div');
      pModal.className = 'modal-overlay show';
      pModal.innerHTML = `
        <div class="modal" style="max-width:400px">
          <div class="modal-title">Complete Payment</div>
          <div class="icon-btn" onclick="this.parentElement.parentElement.remove()" style="border:none;position:absolute;top:24px;right:24px;cursor:pointer"><svg viewBox="0 0 13 13" fill="none"><path d="M2 2l9 9M11 2L2 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></div>
          <div class="modal-body" style="padding-top:10px">
            <div style="font-size:0.9rem;margin-bottom:20px;text-align:center">
              Upgrading to <b>${planName}</b> plan.<br><br>
              <div style="font-size:2rem;font-family:var(--font-mono);font-weight:700">₹${price}</div>
            </div>
            <div class="form-group">
              <label class="form-label">Card Number</label>
              <input type="text" class="form-input" placeholder="0000 0000 0000 0000" value="4111 1111 1111 1111">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group"><label class="form-label">Expiry</label><input type="text" class="form-input" placeholder="MM/YY" value="12/28"></div>
              <div class="form-group"><label class="form-label">CVV</label><input type="password" class="form-input" placeholder="123" value="123"></div>
            </div>
            <button class="btn btn-f" style="width:100%;justify-content:center;margin-top:12px" id="payPlanBtn">Pay Now</button>
          </div>
        </div>
      `;
      document.body.appendChild(pModal);

      document.getElementById('payPlanBtn').onclick = async () => {
        const btn = document.getElementById('payPlanBtn');
        btn.textContent = 'Processing...';
        btn.disabled = true;
        try {
          const data = await ParkdAPI.request('/api/users/plan', {
            method: 'PUT',
            body: JSON.stringify({ plan_id: planId })
          });
          localStorage.setItem('parkd_token', data.token);
          const me = await ParkdAPI.request('/api/users/me');
          localStorage.setItem('parkd_user', JSON.stringify({
            userId: me.USER_ID, name: me.NAME, email: me.EMAIL, planType: me.PLAN_TYPE
          }));
          alert('Payment successful! Plan upgraded.');
          window.location.reload();
        } catch(e) {
          alert(e.message);
          btn.textContent = 'Pay Now';
          btn.disabled = false;
        }
      };
    };
  },

  async find() {
    if (!ParkdAPI.requireAuth()) return;
    ParkdApp.setTopDate();
    ParkdApp.applyUserShell(ParkdAPI.user());
    const facilities = await ParkdAPI.request('/api/facilities');

    const state = { facilities, filter: 'all', selectedIndex: 0, searchQuery: '' };
    const cardsContainer = document.getElementById('cardsContainer');
    const cardsSub = document.getElementById('facCount');
    const topSub = document.querySelector('.topbar-sub');
    const zoneDetail = document.getElementById('zoneDetail');
    const zdTitle = document.getElementById('zdTitle');
    const zdSub = document.getElementById('zdSub');
    const zdBody = document.getElementById('zdBody');
    const pinsContainer = document.getElementById('pinsContainer');

    const tierClass = t => (t === 'gold' ? 'gold' : t === 'platinum' ? 'plat' : '');

    function matchesFilter(f) {
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        const matchName = f.name && f.name.toLowerCase().includes(q);
        const matchLoc = f.location && f.location.toLowerCase().includes(q);
        const matchCity = f.city && f.city.toLowerCase().includes(q);
        if (!matchName && !matchLoc && !matchCity) return false;
      }
      if (state.filter === 'all') return true;
      return (f.zones || []).some(z => z.tier_type === state.filter);
    }

    function filteredFacilities() {
      return facilities.filter(matchesFilter);
    }

    function renderCards(list) {
      if (!cardsContainer) return;
      cardsContainer.innerHTML = '';
      list.forEach((f, i) => {
        const el = document.createElement('div');
        el.className = 'facility-card' + (i === state.selectedIndex ? ' sel' : '');
        const free = (f.zones || []).reduce((s, z) => s + (z.free_slots || 0), 0);
        const minRate = Math.min(...(f.zones || []).map(z => Number(z.base_rate || 0))) || 0;
        const zonesHtml = (f.zones || []).map(z => {
          const cls = tierClass(z.tier_type);
          return `<span class="zone-pill${cls ? ' ' + cls : ''}">${ParkdApp.tierLabel(z.tier_type)}</span>`;
        }).join('');
        el.innerHTML = `
          <div class="fc-name">${f.name}</div>
          <div class="fc-addr">${f.location}, ${f.city}</div>
          <div class="fc-zones">${zonesHtml}</div>
          <div class="fc-footer">
            <div class="fc-rate">from <b>${ParkdApp.rupee(minRate)}</b>/hr</div>
            <div class="fc-avail"><b>${free}</b> slots free</div>
          </div>`;
        el.onclick = () => selectFac(i);
        cardsContainer.appendChild(el);
      });
    }

    function renderPins(list) {
      if (!pinsContainer) return;
      pinsContainer.innerHTML = '';
      list.forEach((f, i) => {
        // Generate deterministic coordinates based on facility ID or string hash
        let hash = 0;
        for (let j = 0; j < f.name.length; j++) {
          hash = f.name.charCodeAt(j) + ((hash << 5) - hash);
        }
        const left = 15 + (Math.abs(hash) % 70); // 15% to 85%
        const top = 20 + (Math.abs(hash >> 8) % 60); // 20% to 80%
        
        const pin = document.createElement('div');
        pin.className = 'map-pin';
        pin.style.left = `${left}%`;
        pin.style.top = `${top}%`;
        pin.onclick = () => selectFac(i);
        const isSel = i === state.selectedIndex;
        pin.innerHTML = `
          <div class="pin-label${isSel ? ' sel' : ' dim'}">${f.name.replace(/ Parking$/i, '')}</div>
          <div class="pin-tail${isSel ? '' : ' dim'}"></div>
        `;
        pinsContainer.appendChild(pin);
      });
    }

    function renderZoneDetail(f) {
      if (!f || !zdBody) return;
      if (zdTitle) zdTitle.textContent = f.name;
      if (zdSub) zdSub.textContent = `${f.location}, ${f.city}`;
      zdBody.innerHTML = (f.zones || []).map(z => {
        const tagCls = tierClass(z.tier_type);
        const tag = `<span style="font-family:var(--font-mono);font-size:.58rem;border:1px solid var(--gray-l1);padding:1px 6px;color:var(--gray-d1)" class="${tagCls}">${ParkdApp.tierLabel(z.tier_type)}</span>`;
        return `
          <a href="slots.html?facility=${f.facility_id}&zone=${z.zone_id}" class="zone-row">
            <div>
              <div class="zr-name">${z.zone_name} ${tag}</div>
              <div class="zr-meta">${ParkdApp.rupee(z.base_rate)}/hr · ${z.total_slots} total slots</div>
            </div>
            <div class="zr-right">
              <div class="zr-free">${z.free_slots}<span>free</span></div>
              <div class="zr-arrow"><svg viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
            </div>
          </a>`;
      }).join('');
      if (zoneDetail) zoneDetail.classList.add('show');
    }

    function selectFac(i) {
      const list = filteredFacilities();
      const f = list[i];
      if (!f) return;
      state.selectedIndex = i;
      renderCards(list);
      renderPins(list);
      renderZoneDetail(f);
    }

    function rebuild() {
      const list = filteredFacilities();
      if (cardsSub) cardsSub.textContent = `${list.length} found · sorted by distance`;
      if (topSub) topSub.textContent = `${list.length} facilities available near you`;
      renderCards(list);
      renderPins(list);
      if (list.length) selectFac(Math.min(state.selectedIndex, list.length - 1));
      else if (zoneDetail) zoneDetail.classList.remove('show');
    }

    window.selectFac = (i) => selectFac(i);
    window.closeDetail = () => zoneDetail && zoneDetail.classList.remove('show');
    window.setFilter = (f, btn) => {
      state.filter = f;
      document.querySelectorAll('.fpill').forEach(p => p.classList.remove('active'));
      if (btn) btn.classList.add('active');
      state.selectedIndex = 0;
      rebuild();
    };

    window.doSearch = () => {
      const input = document.getElementById('searchInput');
      if (input) {
        state.searchQuery = input.value.trim();
        state.selectedIndex = 0;
        rebuild();
      }
    };

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.doSearch();
      });
    }
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => window.doSearch());
    }

    rebuild();
  },

  async slots() {
    if (!ParkdAPI.requireAuth()) return;
    ParkdApp.setTopDate();
    ParkdApp.applyUserShell(ParkdAPI.user());
    const facilities = await ParkdAPI.request('/api/facilities');
    const vehicles = await ParkdAPI.request('/api/vehicles');
    if (!vehicles.length) { alert('Add a vehicle first (register with vehicle).'); return; }
    const vehicleId = vehicles[0].VEHICLE_ID;

    const qs = new URLSearchParams(location.search);
    const fid = qs.get('facility') || facilities[0]?.facility_id;
    const zoneParam = qs.get('zone');
    const fac = facilities.find(f => String(f.facility_id) === String(fid)) || facilities[0];
    if (!fac) return;

    const state = {
      facilities,
      facility: fac,
      zoneMap: {},
      currentZoneKey: null,
      selected: null,
      slots: [],
      vehicleId,
      zoneParam
    };

    const tierTag = (t) => {
      const cls = t === 'gold' ? 'gold' : t === 'platinum' ? 'plat' : '';
      return `<span class="tier-tag${cls ? ' ' + cls : ''}">${ParkdApp.tierLabel(t)}</span>`;
    };

    function zoneKey(z) {
      return (z.zone_name || '').replace(/^Zone\s*/i, '').trim() || String(z.zone_id);
    }

    function setBtnLabel(btn, label) {
      if (!btn) return;
      const svg = btn.querySelector('svg');
      btn.textContent = '';
      if (svg) btn.appendChild(svg);
      btn.appendChild(document.createTextNode(` ${label}`));
    }

    function buildZoneMap() {
      const map = {};
      (state.facility.zones || []).forEach(z => { map[zoneKey(z)] = { ...z }; });
      state.zoneMap = map;
      const keys = Object.keys(map);
      if (state.zoneParam) {
        const z = (state.facility.zones || []).find(zz => String(zz.zone_id) === String(state.zoneParam));
        state.currentZoneKey = z ? zoneKey(z) : keys[0];
      } else {
        state.currentZoneKey = state.currentZoneKey || keys[0];
      }
    }

    function updateFacilitySelect() {
      const sel = document.querySelector('.fac-select');
      if (!sel) return;
      sel.innerHTML = state.facilities.map(f =>
        `<option value="${f.facility_id}">${f.name}</option>`
      ).join('');
      sel.value = state.facility.facility_id;
      sel.onchange = () => {
        const next = state.facilities.find(f => String(f.facility_id) === String(sel.value));
        if (!next) return;
        state.facility = next;
        state.selected = null;
        state.zoneParam = null;
        buildZoneMap();
        updateZoneTabs();
        const z = state.zoneMap[state.currentZoneKey];
        if (z) loadSlots(z.zone_id);
      };
    }

    function updateZoneTabs() {
      const tabs = document.querySelectorAll('.ztab');
      const keys = Object.keys(state.zoneMap);
      tabs.forEach((tab, i) => {
        const key = keys[i];
        if (!key) {
          tab.style.display = 'none';
          return;
        }
        tab.style.display = '';
        tab.dataset.zoneKey = key;
        const z = state.zoneMap[key];
        const count = tab.querySelector('.ztab-count') || document.createElement('span');
        count.className = 'ztab-count';
        count.textContent = String(z.free_slots ?? 0);
        tab.innerHTML = `Zone ${key} `;
        tab.appendChild(count);
        tab.classList.toggle('active', key === state.currentZoneKey);
        tab.onclick = () => window.switchZone(key, tab);
      });
    }

    async function loadSlots(zoneId) {
      state.slots = await ParkdAPI.request(`/api/zones/${zoneId}/slots`);
      render();
    }

    function statusMap(st) {
      if (st === 'free') return 'free';
      if (st === 'occupied') return 'occ';
      return 'res';
    }

    function render() {
      const z = state.zoneMap[state.currentZoneKey];
      if (!z) return;
      const mockSlots = state.slots.map(s => ({
        id: s.slot_number,
        slot_id: s.slot_id,
        zone_id: s.zone_id,
        st: statusMap(s.status),
        type: 'Std'
      }));
      const freeCount = mockSlots.filter(s => s.st === 'free').length;
      z.free_slots = freeCount;

      const col = document.getElementById('lotCols');
      if (!col) return;
      col.innerHTML = '';
      const mk = (s) => {
        const el = document.createElement('div');
        const isSel = state.selected && state.selected.slot_id === s.slot_id;
        el.className = 'slot ' + (isSel ? 'slot-sel' : s.st === 'free' ? 'slot-free' : s.st === 'occ' ? 'slot-occ' : 'slot-res');
        el.innerHTML = `<div class="slot-left"><div class="slot-num">${s.id}</div><div class="slot-type">${s.type}</div></div><div class="slot-right"><div class="slot-dot"></div></div>`;
        if (s.st === 'free') el.onclick = () => selectSlot(s, z);
        return el;
      };
      const left = mockSlots.filter((_, i) => i % 2 === 0);
      const right = mockSlots.filter((_, i) => i % 2 !== 0);
      const lc = document.createElement('div'); lc.className = 'slots-col';
      left.forEach(s => lc.appendChild(mk(s)));
      const lane = document.createElement('div'); lane.className = 'lane';
      lane.innerHTML = '<div class="lane-line"></div>';
      const rc = document.createElement('div'); rc.className = 'slots-col';
      right.forEach(s => rc.appendChild(mk(s)));
      col.appendChild(lc); col.appendChild(lane); col.appendChild(rc);

      document.getElementById('zbName').textContent = z.zone_name;
      document.getElementById('zbRate').textContent = ParkdApp.rupee(z.base_rate) + ' / hr';
      document.getElementById('zbTotal').textContent = mockSlots.length;
      document.getElementById('zbFree').textContent = z.free_slots;
      document.getElementById('zbTier').innerHTML = tierTag(z.tier_type);
      updateZoneTabs();
      const panel = document.getElementById('bookPanel');
      if (panel && !state.selected) panel.classList.remove('show');

      if (!state.selected && freeCount === 0 && panel) {
        panel.classList.add('show');
        document.getElementById('bpSlot').textContent = `Queue for ${z.zone_name}`;
        document.getElementById('bpMeta').textContent = 'No free slots. Join the queue to hold your place.';
        document.getElementById('bpRate').textContent = ParkdApp.rupee(z.base_rate) + '/hr';
        const btn = document.getElementById('bookBtn');
        setBtnLabel(btn, 'Join Queue');
        if (btn) {
          btn.onclick = async (ev) => {
            ev.preventDefault();
            try {
              await ParkdAPI.request('/api/queue/join', {
                method: 'POST',
                body: JSON.stringify({ vehicle_id: state.vehicleId, zone_id: z.zone_id })
              });
              window.location.href = 'queue.html';
            } catch (err) {
              alert(err.message);
            }
          };
        }
      }
    }

    function selectSlot(s, z) {
      state.selected = s;
      render();
      document.getElementById('bpSlot').textContent = `${s.id} — ${z.zone_name}`;
      document.getElementById('bpMeta').textContent = `${ParkdApp.tierLabel(z.tier_type)} tier`;
      document.getElementById('bpRate').textContent = ParkdApp.rupee(z.base_rate) + '/hr';
      document.getElementById('bookPanel').classList.add('show');
      const btn = document.getElementById('bookBtn');
      setBtnLabel(btn, 'Book This Slot');
      if (btn) {
        btn.onclick = async (ev) => {
          ev.preventDefault();
          try {
            await ParkdAPI.request(`/api/slots/${s.slot_id}/book`, {
              method: 'PUT',
              body: JSON.stringify({ vehicle_id: state.vehicleId, zone_id: z.zone_id })
            });
            window.location.href = 'ticket.html';
          } catch (err) {
            alert(err.message);
          }
        };
      }
    }

    window.switchZone = (key, btn) => {
      state.currentZoneKey = key;
      state.selected = null;
      document.querySelectorAll('.ztab').forEach(t => t.classList.remove('active'));
      if (btn) btn.classList.add('active');
      document.getElementById('bookPanel').classList.remove('show');
      const z = state.zoneMap[key];
      if (z) loadSlots(z.zone_id);
    };

    window.clearSel = () => {
      state.selected = null;
      const panel = document.getElementById('bookPanel');
      if (panel) panel.classList.remove('show');
    };

    window.renderZone = () => {
      const z = state.zoneMap[state.currentZoneKey];
      if (z) loadSlots(z.zone_id);
    };

    buildZoneMap();
    updateFacilitySelect();
    updateZoneTabs();
    const first = state.zoneMap[state.currentZoneKey];
    if (first) await loadSlots(first.zone_id);
    ParkdApp.poll(() => {
      const z = state.zoneMap[state.currentZoneKey];
      if (z) loadSlots(z.zone_id);
    }, 5000);
  },

  async ticket() {
    if (!ParkdAPI.requireAuth()) return;
    ParkdApp.applyUserShell(ParkdAPI.user());
    const planType = (ParkdAPI.user()?.planType || 'general').toLowerCase();
    const load = async () => {
      const t = await ParkdAPI.request('/api/tickets/active');
      const slotEl = document.querySelector('.tc-slot');
      if (slotEl) slotEl.textContent = t.SLOT_NUMBER;

      const facEl = document.querySelector('.tk-facility');
      if (facEl) facEl.textContent = t.FACILITY_NAME;
      const idEl = document.querySelector('.tk-id');
      if (idEl) idEl.textContent = `Ticket #${t.TICKET_ID}`;
      const badge = document.querySelector('.tk-badge');
      if (badge) badge.textContent = ParkdApp.tierLabel(planType);

      const rows = document.querySelectorAll('.tc-row');
      if (rows[0]) rows[0].querySelector('.tc-val').textContent = `${ParkdApp.rupee(t.BASE_RATE)} / hr`;
      if (rows[2]) {
        const lbl = rows[2].querySelector('.tc-lbl');
        const val = rows[2].querySelector('.tc-val');
        if (lbl) lbl.textContent = `${ParkdApp.tierLabel(planType)} discount`;
        if (val) val.textContent = planType === 'gold' ? '10%' : '0%';
      }

      const labelMap = {
        'Vehicle Number': t.VEHICLE_NUMBER,
        'Vehicle Type': t.VEHICLE_TYPE,
        'Zone': t.ZONE_NAME,
        'Slot': t.SLOT_NUMBER,
        'Entry Time': ParkdApp.fmtTime(t.ENTRY_TIME),
        'Entry Day': ParkdApp.fmtDate(t.ENTRY_DATE || t.ENTRY_DAY),
        'Plan': ParkdApp.tierLabel(planType),
        'Status': 'Active'
      };
      document.querySelectorAll('.tk-item').forEach(item => {
        const lbl = item.querySelector('.tk-lbl');
        const val = item.querySelector('.tk-val');
        if (!lbl || !val) return;
        const key = lbl.textContent.trim();
        if (labelMap[key] != null) val.textContent = labelMap[key];
      });

      const qr = document.querySelector('.qr-id');
      if (qr) qr.textContent = `${t.TICKET_ID}-${t.VEHICLE_NUMBER}-${t.SLOT_NUMBER}`;

      const entryMs = new Date(t.ENTRY_TIME).getTime();
      const ring = document.getElementById('ringProg');
      const ringTime = document.getElementById('ringTime');
      const durEl = document.getElementById('tcDur');
      const estEl = document.getElementById('tcEst');
      const circumference = 2 * Math.PI * 70;
      const discountPct = planType === 'gold' ? 10 : 0;
      const tick = () => {
        const s = Math.max(0, Math.floor((Date.now() - entryMs) / 1000));
        const p = n => String(n).padStart(2, '0');
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (ringTime) ringTime.textContent = `${p(h)}:${p(m)}:${p(sec)}`;
        if (durEl) durEl.textContent = `${p(h)}h ${p(m)}m`;
        const hours = s / 3600;
        const base = hours * Number(t.BASE_RATE || 0);
        const est = base * (1 - discountPct / 100);
        if (estEl) estEl.textContent = ParkdApp.rupee(est || 0);
        if (ring) {
          const prog = Math.min(s / (8 * 3600), 1);
          ring.style.strokeDasharray = String(circumference);
          ring.style.strokeDashoffset = String(circumference * (1 - prog));
        }
      };
      tick();
      if (!window._tkTick) { window._tkTick = setInterval(tick, 1000); }
    };
    try { await load(); ParkdApp.poll(load, 15000); } catch (e) {
      document.querySelector('.content')?.insertAdjacentHTML('afterbegin',
        '<p style="padding:24px">No active ticket. <a href="slots.html">Book a slot</a></p>');
    }
  },

  async billing() {
    if (!ParkdAPI.requireAuth()) return;
    ParkdApp.applyUserShell(ParkdAPI.user());
    const planType = (ParkdAPI.user()?.planType || 'general').toLowerCase();
    const grid = document.querySelector('.bill-grid');
    const empty = document.getElementById('billEmpty');

    const showEmpty = (msg) => {
      if (grid) grid.style.display = 'none';
      if (empty) {
        empty.textContent = msg;
        empty.style.display = 'block';
      }
    };

    const showGrid = () => {
      if (grid) grid.style.display = '';
      if (empty) empty.style.display = 'none';
    };

    const setBillRow = (labelStarts, value) => {
      document.querySelectorAll('.bill-row').forEach(row => {
        const lbl = row.querySelector('.br-label');
        const val = row.querySelector('.br-val');
        if (!lbl || !val) return;
        if (lbl.textContent.trim().toLowerCase().startsWith(labelStarts.toLowerCase())) {
          val.textContent = value;
        }
      });
    };

    const load = async () => {
      const b = await ParkdAPI.request('/api/bills/current');
      showGrid();
      const entryTime = new Date(b.ENTRY_TIME);
      const exitTime = b.EXIT_DATE ? new Date(b.EXIT_DATE) : new Date();
      const durationMs = Math.max(0, exitTime - entryTime);
      const durationHrs = durationMs / 3600000;
      const h = Math.floor(durationHrs);
      const m = Math.round((durationHrs - h) * 60);
      const durationLabel = `${h}h ${String(m).padStart(2, '0')}m`;

      const baseRate = Number(b.BASE_RATE || 0);
      const base = parseFloat((durationHrs * baseRate).toFixed(2));
      const goldDiscPct = planType === 'gold' ? 10 : 0;
      const offerDiscPct = Number(b.DISCOUNT_PCT || 0);
      const goldDisc = parseFloat((base * goldDiscPct / 100).toFixed(2));
      const offerDisc = parseFloat((base * offerDiscPct / 100).toFixed(2));
      const totalDisc = parseFloat((goldDisc + offerDisc).toFixed(2));
      const total = parseFloat(Math.max(0, base - totalDisc).toFixed(2));

      const facEl = document.querySelector('.bc-facility');
      if (facEl) facEl.textContent = b.FACILITY_NAME;
      const slotEl = document.querySelector('.bc-slot');
      if (slotEl) slotEl.textContent = `${b.ZONE_NAME} · Slot ${b.SLOT_NUMBER} · ${ParkdApp.fmtDate(b.ENTRY_DATE)}`;
      const statusEl = document.querySelector('.bc-status');
      if (statusEl) statusEl.textContent = (b.PAYMENT_STATUS || 'pending').toUpperCase();

      setBillRow('Base rate', `${ParkdApp.rupee(baseRate)} / hr`);
      setBillRow('Duration', durationLabel);
      setBillRow('Subtotal', ParkdApp.rupee(base));
      setBillRow('Gold discount', `- ${ParkdApp.rupee(goldDisc)}`);
      setBillRow('Offer discount', `- ${ParkdApp.rupee(offerDisc)}`);

      const offerCard = document.querySelector('.bill-offer');
      if (offerCard) {
        const nameEl = offerCard.querySelector('.offer-name');
        const descEl = offerCard.querySelector('.offer-desc');
        const pctEl = offerCard.querySelector('.offer-pct');
        if (offerDiscPct > 0) {
          if (nameEl) nameEl.textContent = b.CONDITION ? b.CONDITION.split(' — ')[0] : 'Offer';
          if (descEl) descEl.textContent = b.CONDITION ? b.CONDITION.split(' — ').slice(1).join(' — ') || 'Applied offer' : 'Applied offer';
          if (pctEl) { pctEl.textContent = `-${offerDiscPct}%`; pctEl.style.display = ''; }
        } else {
          if (nameEl) nameEl.textContent = 'No Offer Applied';
          if (descEl) descEl.textContent = 'Available offers can be selected';
          if (pctEl) pctEl.style.display = 'none';
        }
      }

      const totalEl = document.querySelector('.bt-val');
      if (totalEl) totalEl.textContent = ParkdApp.rupee(total);

      const infoRows = document.querySelectorAll('.info-card .info-row');
      infoRows.forEach(row => {
        const lbl = row.querySelector('.ir-label');
        const val = row.querySelector('.ir-val');
        if (!lbl || !val) return;
        const key = lbl.textContent.trim().toLowerCase();
        if (key.startsWith('vehicle')) val.textContent = b.VEHICLE_NUMBER;
        if (key.startsWith('entry')) val.textContent = ParkdApp.fmtTime(b.ENTRY_TIME);
        if (key.startsWith('exit')) val.textContent = b.EXIT_DATE ? ParkdApp.fmtTime(b.EXIT_DATE) : '—';
        if (key.startsWith('ticket')) val.textContent = b.TICKET_ID || '—';
        if (key.startsWith('plan')) val.textContent = ParkdApp.tierLabel(planType);
      });

      const breakdown = document.querySelectorAll('.info-card')[1];
      if (breakdown) {
        const rows = breakdown.querySelectorAll('.info-row');
        if (rows[0]) {
          rows[0].querySelector('.ir-label').textContent = `${durationLabel} × ${ParkdApp.rupee(baseRate)}`;
          rows[0].querySelector('.ir-val').textContent = ParkdApp.rupee(base);
        }
        if (rows[1]) {
          rows[1].querySelector('.ir-label').textContent = `${ParkdApp.tierLabel(planType)} discount`;
          rows[1].querySelector('.ir-val').textContent = `- ${ParkdApp.rupee(goldDisc)}`;
        }
        if (rows[2]) {
          rows[2].querySelector('.ir-label').textContent = offerDiscPct > 0 ? 'Offer discount' : 'Offer discount';
          rows[2].querySelector('.ir-val').textContent = offerDiscPct > 0 ? `- ${ParkdApp.rupee(offerDisc)}` : ParkdApp.rupee(0);
        }
        if (rows[3]) {
          rows[3].querySelector('.ir-val').textContent = ParkdApp.rupee(total);
        }
      }

      const payBtn = document.getElementById('payBtn') || document.querySelector('.btn-pay');
      const setPayLabel = () => {
        if (!payBtn) return;
        const svg = payBtn.querySelector('svg');
        payBtn.textContent = '';
        if (svg) payBtn.appendChild(svg);
        payBtn.appendChild(document.createTextNode(` Pay ${ParkdApp.rupee(total)} Now`));
      };
      setPayLabel();

      window.handlePay = async () => {
        try {
          await ParkdAPI.request(`/api/records/${b.RECORD_ID}/exit`, { method: 'POST' });
          const paid = await ParkdAPI.request(`/api/bills/${b.BILL_ID}/pay`, { method: 'POST' });
          if (statusEl) statusEl.textContent = 'PAID';
          if (totalEl) totalEl.textContent = ParkdApp.rupee(paid.amount || total);
          if (payBtn) {
            payBtn.disabled = true;
            payBtn.classList.add('paid');
          }
          alert('Payment successful!');
          window.location.href = 'dashboard.html';
        } catch (err) { alert(err.message); }
      };

      window.openOfferModal = async () => {
        try {
          const offers = await ParkdAPI.request('/api/bills/offers/available');
          const body = document.getElementById('offerListBody');
          if (body) {
            body.innerHTML = offers.length ? offers.map(o => {
              const name = o.CONDITION.split(' — ')[0];
              const desc = o.CONDITION.split(' — ').slice(1).join(' — ') || '';
              return `
                <div class="offer-list-item" onclick="applyOffer(${o.OFFER_ID})">
                  <div>
                    <div class="oli-name">${name}</div>
                    <div class="oli-desc">${desc}</div>
                  </div>
                  <div class="oli-pct">-${o.DISCOUNT_PCT}%</div>
                </div>
              `;
            }).join('') + `
              <div class="offer-list-item" onclick="applyOffer(null)">
                <div class="oli-name">Remove Offer</div>
              </div>
            ` : '<p style="text-align:center;font-size:0.8rem">No offers available</p>';
          }
          const modal = document.getElementById('offerModal');
          if (modal) modal.classList.add('show');
        } catch(e) { alert('Failed to load offers'); }
      };

      window.closeOfferModal = () => {
        const modal = document.getElementById('offerModal');
        if (modal) modal.classList.remove('show');
      };

      window.applyOffer = async (oid) => {
        try {
          await ParkdAPI.request(`/api/bills/${b.BILL_ID}/offer`, {
            method: 'PUT',
            body: JSON.stringify({ offer_id: oid })
          });
          window.closeOfferModal();
          load();
        } catch(e) { alert('Failed to apply offer'); }
      };
    };
    try { await load(); } catch (e) {
      if (e.status === 404) showEmpty('No pending bill.');
      else showEmpty('Failed to load billing details.');
    }
  },

  async queue() {
    if (!ParkdAPI.requireAuth()) return;
    ParkdApp.applyUserShell(ParkdAPI.user());
    const vehicles = await ParkdAPI.request('/api/vehicles');
    const vehicleId = vehicles[0]?.VEHICLE_ID;
    const numEl = document.getElementById('qNum');
    const badgeEl = document.getElementById('qBadge');
    const waitEl = document.getElementById('qWait');
    const aheadEl = document.getElementById('qAhead');
    const barEl = document.getElementById('qBarFill');
    const zoneEl = document.querySelector('.q-zone');
    const banner = document.getElementById('allocBanner');
    const allocSlot = document.getElementById('allocSlot');
    const enterBtn = document.getElementById('enterBtn');

    const load = async () => {
      try {
        const q = await ParkdAPI.request('/api/queue/position');
        const pos = Number(q.POSITION || 0);
        if (numEl) numEl.textContent = String(pos).padStart(2, '0');
        if (badgeEl) badgeEl.textContent = (q.STATUS || 'waiting').toUpperCase();
        if (waitEl) waitEl.textContent = q.STATUS === 'allocated' ? 'Ready now' : `~${q.ESTIMATED_WAIT_MINUTES || 0} min`;
        if (aheadEl) aheadEl.textContent = `${Math.max(pos - 1, 0)} ahead`;
        if (barEl) {
          const pct = Math.max(10, Math.min(100, 100 - (pos - 1) * 15));
          barEl.style.width = `${pct}%`;
        }
        if (zoneEl) {
          const zoneTxt = q.ZONE_NAME || 'Zone';
          const facTxt = q.FACILITY_NAME ? ` · ${q.FACILITY_NAME}` : '';
          zoneEl.textContent = zoneTxt + facTxt;
        }

        const infoRows = document.querySelectorAll('.q-info-row');
        infoRows.forEach(row => {
          const lbl = row.querySelector('.qi-label');
          const val = row.querySelector('.qi-val');
          if (!lbl || !val) return;
          const key = lbl.textContent.trim().toLowerCase();
          if (key === 'vehicle') val.textContent = q.VEHICLE_NUMBER || '—';
          if (key === 'zone') val.textContent = `${q.ZONE_NAME || 'Zone'} · ${q.FACILITY_NAME || 'Facility'}`;
          if (key === 'arrived') val.textContent = ParkdApp.fmtTime(q.ARRIVAL_TIME) || '—';
        });

        if (q.STATUS === 'allocated') {
          if (banner) banner.style.display = 'flex';
          if (allocSlot) allocSlot.textContent = q.SLOT_NUMBER || '—';
          if (enterBtn) {
            enterBtn.style.display = 'inline-flex';
            enterBtn.onclick = async (ev) => {
              ev.preventDefault();
              if (!vehicleId) return alert('No vehicle registered');
              try {
                await ParkdAPI.request(`/api/slots/${q.ALLOCATED_SLOT_ID}/book`, {
                  method: 'PUT',
                  body: JSON.stringify({ vehicle_id: vehicleId, zone_id: q.ZONE_ID })
                });
                window.location.href = 'ticket.html';
              } catch (err) {
                alert(err.message);
              }
            };
          }
        } else {
          if (banner) banner.style.display = 'none';
          if (enterBtn) enterBtn.style.display = 'none';
        }
      } catch (e) {
        if (e.status === 404) {
          if (numEl) numEl.textContent = '—';
          if (badgeEl) badgeEl.textContent = 'NOT IN QUEUE';
          if (waitEl) waitEl.textContent = '—';
          if (aheadEl) aheadEl.textContent = '—';
          if (barEl) barEl.style.width = '0%';
          if (banner) banner.style.display = 'none';
          if (enterBtn) enterBtn.style.display = 'none';
        }
      }
    };
    ParkdApp.poll(load, 5000);
    window.leaveQueue = async () => {
      await ParkdAPI.request('/api/queue/leave', { method: 'DELETE' });
      window.location.href = 'dashboard.html';
    };
    window.simulate = () => load();
  },

  async history() {
    if (!ParkdAPI.requireAuth()) return;
    ParkdApp.applyUserShell(ParkdAPI.user());
    const panels = {
      active: document.getElementById('panel0'),
      completed: document.getElementById('panel1'),
      cancelled: document.getElementById('panel2')
    };

    const recIcon = `<svg viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5" height="13" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="1" width="5" height="13" stroke="currentColor" stroke-width="1.2"/></svg>`;
    const chevron = `<svg viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    const render = async (status) => {
      try {
        const rows = await ParkdAPI.request(`/api/records?status=${status}`);
        const panel = panels[status];
        if (!panel) return;
        panel.innerHTML = rows.length ? rows.map(r => {
          const badgeCls = status === 'active' ? 'badge-active' : (r.PAYMENT_STATUS === 'paid' ? 'badge-paid' : 'badge-pending');
          const badgeText = status === 'active' ? 'Active' : (r.PAYMENT_STATUS || r.STATUS || 'Pending');
          const entry = ParkdApp.fmtTime(r.ENTRY_TIME || r.ENTRY_DATE);
          const exit = r.EXIT_DATE ? ParkdApp.fmtTime(r.EXIT_DATE) : 'In progress';
          return `
            <div class="record">
              <div class="rec-main" onclick="toggle(this.parentElement)">
                <div class="rec-icon">${recIcon}</div>
                <div class="rec-info">
                  <div class="rec-facility">${r.FACILITY_NAME || 'Parking'}</div>
                  <div class="rec-detail">${r.ZONE_NAME} · ${r.SLOT_NUMBER} · ${ParkdApp.fmtDate(r.EXIT_DATE || r.ENTRY_DATE)}</div>
                </div>
                <div class="rec-right">
                  <div class="rec-amount">${ParkdApp.rupee(r.AMOUNT || 0)}</div>
                  <span class="badge ${badgeCls}">${badgeText}</span>
                </div>
                <div class="rec-chevron">${chevron}</div>
              </div>
              <div class="rec-details">
                <div class="detail-grid">
                  <div class="dg-item"><div class="dg-label">Ticket ID</div><div class="dg-val">${r.TICKET_ID || '—'}</div></div>
                  <div class="dg-item"><div class="dg-label">Vehicle</div><div class="dg-val">${r.VEHICLE_NUMBER || '—'}</div></div>
                  <div class="dg-item"><div class="dg-label">Zone / Slot</div><div class="dg-val">${r.ZONE_NAME || '—'} / ${r.SLOT_NUMBER || '—'}</div></div>
                  <div class="dg-item"><div class="dg-label">Entry</div><div class="dg-val">${entry}</div></div>
                  <div class="dg-item"><div class="dg-label">Exit</div><div class="dg-val">${exit}</div></div>
                  <div class="dg-item"><div class="dg-label">Amount</div><div class="dg-val">${ParkdApp.rupee(r.AMOUNT || 0)}</div></div>
                </div>
                <div class="detail-actions">
                  <a href="ticket.html" class="btn btn-f">View Ticket</a>
                  <a href="billing.html" class="btn">Exit &amp; Pay</a>
                </div>
              </div>
            </div>`;
        }).join('') : '<p style="padding:24px">No records.</p>';
      } catch (_) {}
    };

    const statusMap = ['active', 'completed', 'cancelled'];
    window.switchTab = (i, btn) => {
      document.querySelectorAll('.htab').forEach((t, j) => t.classList.toggle('active', j === i));
      document.querySelectorAll('.list-panel').forEach((p, j) => p.classList.toggle('active', j === i));
      render(statusMap[i] || 'completed');
    };

    render('active');
  },

  async 'admin-dashboard'() {
    if (!ParkdAPI.requireAuth('auth.html?admin=1')) return;
    ParkdApp.setTopDate();
    ParkdApp.applyAdminShell(ParkdAPI.admin());
    const admin = ParkdAPI.admin() || {};
    const isSuper = admin.role === 'super_admin';
    const facState = { list: [] };
    const laState = { list: [] };

    const facMgmt = document.getElementById('facilityMgmtSection');
    if (facMgmt) facMgmt.style.display = isSuper ? 'block' : 'none';

    const renderFacilities = (facs) => {
      const body = document.getElementById('facListBody');
      if (!body) return;
      if (!facs.length) {
        body.innerHTML = '<div class="muted">No facilities added yet.</div>';
        return;
      }
      body.innerHTML = facs.map(f => {
        const zones = (f.zones || []).map(z => `
          <div class="zone-row">
            <div>
              <div class="zone-name">${z.zone_name}</div>
              <div class="zone-meta">${ParkdApp.tierLabel(z.tier_type)} · ${z.total_slots} slots</div>
            </div>
            <div class="zone-actions">
              <button class="btn btn-ghost" onclick="editZone(${f.facility_id}, ${z.zone_id})">Edit</button>
              <button class="btn btn-danger" onclick="deleteZone(${f.facility_id}, ${z.zone_id})">Delete</button>
            </div>
          </div>
        `).join('');
        return `
          <div class="fac-card">
            <div class="fac-head">
              <div>
                <div class="fac-name">${f.name}</div>
                <div class="fac-loc">${f.location}, ${f.city}</div>
              </div>
              <div class="fac-actions">
                <button class="btn btn-ghost" onclick="editFacility(${f.facility_id})">Edit</button>
                <button class="btn btn-danger" onclick="deleteFacility(${f.facility_id})">Delete</button>
                <button class="btn btn-f" onclick="openZoneModal(${f.facility_id})">+ Zone</button>
              </div>
            </div>
            <div class="zone-list">
              ${zones || ''}
              ${!zones ? '<div class="zone-empty">No zones added yet.</div>' : ''}
            </div>
          </div>
        `;
      }).join('');
    };

    const renderLocalAdmins = (rows) => {
      const body = document.getElementById('localAdminBody');
      if (!body) return;
      if (!rows.length) {
        body.innerHTML = '<div class="muted">No local admins yet.</div>';
        return;
      }
      body.innerHTML = rows.map(r => `
        <div class="la-row">
          <div>
            <div class="la-name">${r.NAME}</div>
            <div class="la-meta">${r.EMAIL} · ${r.FACILITY_NAME || 'Unassigned'}</div>
          </div>
          <div class="la-actions">
            <button class="btn btn-ghost" onclick="editLocalAdmin(${r.ADMIN_ID})">Edit</button>
            <button class="btn btn-danger" onclick="deleteLocalAdmin(${r.ADMIN_ID})">Delete</button>
          </div>
        </div>
      `).join('');
    };

    const loadFacs = async () => {
      try {
        const facs = await ParkdAPI.request('/api/admin/facilities');
        facState.list = facs || [];
        const laSel = document.getElementById('laFacId');
        if (laSel) {
          laSel.innerHTML = facState.list.map(f => `<option value="${f.facility_id}">${f.name}</option>`).join('');
        }
        renderFacilities(facState.list);
      } catch (e) {
        const body = document.getElementById('facListBody');
        if (body) body.innerHTML = `<div class="muted">${e.message || 'Failed to load facilities'}</div>`;
      }
    };

    const loadLocalAdmins = async () => {
      try {
        const rows = await ParkdAPI.request('/api/admin/local-admins');
        laState.list = rows || [];
        renderLocalAdmins(laState.list);
      } catch (e) {
        const body = document.getElementById('localAdminBody');
        if (body) body.innerHTML = `<div class="muted">${e.message || 'Failed to load local admins'}</div>`;
      }
    };

    if (isSuper) {
      await loadFacs();
      await loadLocalAdmins();

      window.openFacModal = (fid) => {
        const f = facState.list.find(x => String(x.facility_id) === String(fid));
        document.getElementById('fmId').value = f ? f.facility_id : '';
        document.getElementById('fmName').value = f ? f.name : '';
        document.getElementById('fmLoc').value = f ? f.location : '';
        document.getElementById('fmCity').value = f ? f.city : '';
        document.getElementById('facModalTitle').textContent = f ? 'Edit Facility' : 'Add Facility';
        document.getElementById('facSaveBtn').textContent = f ? 'Save Changes' : 'Save Facility';
        document.getElementById('facModalOverlay').classList.add('show');
      };
      window.editFacility = (fid) => openFacModal(fid);
      window.closeFacModal = () => document.getElementById('facModalOverlay').classList.remove('show');
      window.saveFacility = async () => {
        const fid = document.getElementById('fmId').value;
        const name = document.getElementById('fmName').value.trim();
        const location = document.getElementById('fmLoc').value.trim();
        const city = document.getElementById('fmCity').value.trim();
        if (!name || !location || !city) return alert('All fields are required');
        const payload = { name, location, city };
        try {
          if (fid) {
            await ParkdAPI.request(`/api/admin/facilities/${fid}`, { method: 'PUT', body: JSON.stringify(payload) });
          } else {
            await ParkdAPI.request('/api/admin/facilities', { method: 'POST', body: JSON.stringify(payload) });
          }
          closeFacModal();
          await loadFacs();
          await loadLocalAdmins();
        } catch (e) { alert(e.message); }
      };

      window.deleteFacility = async (fid) => {
        if (!confirm('Delete this facility? This cannot be undone.')) return;
        try {
          await ParkdAPI.request(`/api/admin/facilities/${fid}`, { method: 'DELETE' });
          await loadFacs();
          await loadLocalAdmins();
        } catch (e) { alert(e.message); }
      };

      window.openZoneModal = (fid, zid) => {
        const f = facState.list.find(x => String(x.facility_id) === String(fid));
        const z = f?.zones?.find(x => String(x.zone_id) === String(zid));
        document.getElementById('zmFacId').value = fid;
        document.getElementById('zmId').value = z ? z.zone_id : '';
        document.getElementById('zmName').value = z ? z.zone_name : '';
        document.getElementById('zmTier').value = z ? z.tier_type : 'general';
        document.getElementById('zmTotal').value = z ? z.total_slots : '';
        document.getElementById('zoneModalTitle').textContent = z ? 'Edit Zone' : 'Add Zone';
        document.getElementById('zoneSaveBtn').textContent = z ? 'Save Changes' : 'Add Zone';
        document.getElementById('zoneModalOverlay').classList.add('show');
      };
      window.editZone = (fid, zid) => openZoneModal(fid, zid);
      window.closeZoneModal = () => document.getElementById('zoneModalOverlay').classList.remove('show');
      window.saveZone = async () => {
        const fid = document.getElementById('zmFacId').value;
        const zid = document.getElementById('zmId').value;
        const name = document.getElementById('zmName').value.trim();
        const tier = document.getElementById('zmTier').value;
        const total = parseInt(document.getElementById('zmTotal').value, 10);
        if (!name || !total || total < 1) return alert('Zone name and total slots are required');
        const payload = { zone_name: name, tier_type: tier, total_slots: total };
        try {
          if (zid) {
            await ParkdAPI.request(`/api/admin/facilities/${fid}/zones/${zid}`, { method: 'PUT', body: JSON.stringify(payload) });
          } else {
            await ParkdAPI.request(`/api/admin/facilities/${fid}/zones`, { method: 'POST', body: JSON.stringify(payload) });
          }
          closeZoneModal();
          await loadFacs();
        } catch (e) { alert(e.message); }
      };

      window.deleteZone = async (fid, zid) => {
        if (!confirm('Delete this zone? This cannot be undone.')) return;
        try {
          await ParkdAPI.request(`/api/admin/facilities/${fid}/zones/${zid}`, { method: 'DELETE' });
          await loadFacs();
        } catch (e) { alert(e.message); }
      };

      window.openLaModal = (aid) => {
        const la = laState.list.find(x => String(x.ADMIN_ID) === String(aid));
        document.getElementById('laId').value = la ? la.ADMIN_ID : '';
        document.getElementById('laName').value = la ? la.NAME : '';
        document.getElementById('laEmail').value = la ? la.EMAIL : '';
        document.getElementById('laPassword').value = '';
        if (la && la.FACILITY_ID) document.getElementById('laFacId').value = la.FACILITY_ID;
        document.getElementById('laModalTitle').textContent = la ? 'Edit Local Admin' : 'Add Local Admin';
        document.getElementById('laSaveBtn').textContent = la ? 'Save Changes' : 'Create Admin';
        document.getElementById('laModalOverlay').classList.add('show');
      };
      window.editLocalAdmin = (aid) => openLaModal(aid);
      window.closeLaModal = () => document.getElementById('laModalOverlay').classList.remove('show');
      window.saveLa = async () => {
        const aid = document.getElementById('laId').value;
        const name = document.getElementById('laName').value.trim();
        const email = document.getElementById('laEmail').value.trim();
        const password = document.getElementById('laPassword').value.trim();
        const facility_id = document.getElementById('laFacId').value;
        if (!name || !email || !facility_id) return alert('Name, email and facility are required');
        try {
          if (aid) {
            const payload = { name, email, facility_id };
            if (password) payload.password = password;
            await ParkdAPI.request(`/api/admin/local-admins/${aid}`, { method: 'PUT', body: JSON.stringify(payload) });
          } else {
            if (!password) return alert('Password is required for new admins');
            await ParkdAPI.request('/api/admin/local-admins', {
              method: 'POST',
              body: JSON.stringify({ name, email, password, facility_id })
            });
          }
          closeLaModal();
          await loadLocalAdmins();
        } catch (e) { alert(e.message); }
      };

      window.deleteLocalAdmin = async (aid) => {
        if (!confirm('Delete this local admin?')) return;
        try {
          await ParkdAPI.request(`/api/admin/local-admins/${aid}`, { method: 'DELETE' });
          await loadLocalAdmins();
        } catch (e) { alert(e.message); }
      };
    }

    const renderRevenue = (series) => {
      const bars = document.getElementById('revBars');
      if (!bars) return;
      bars.innerHTML = '';
      const data = Array.isArray(series) ? series : [];
      if (!data.length) {
        bars.innerHTML = '<div class="muted" style="padding:12px">No revenue data</div>';
        const totalEl = document.getElementById('revTotal');
        if (totalEl) totalEl.textContent = ParkdApp.rupee(0);
        return;
      }
      const totals = data.map(d => Number(d.total || 0));
      const max = Math.max(...totals, 1);
      data.forEach((d, i) => {
        const col = document.createElement('div');
        col.className = 'bar-col';
        const h = Math.round((Number(d.total || 0) / max) * 70);
        const day = new Date(d.day);
        const lbl = isNaN(day.getTime()) ? 'Day' : day.toLocaleDateString('en-IN', { weekday: 'short' });
        col.innerHTML = `<div class="bar${i === data.length - 1 ? ' highlight' : ''}" style="height:${h}px"></div><div class="bar-lbl">${lbl}</div>`;
        bars.appendChild(col);
      });
      const total = totals.reduce((s, n) => s + n, 0);
      const totalEl = document.getElementById('revTotal');
      if (totalEl) totalEl.textContent = ParkdApp.rupee(total);
    };

    const renderActivity = (items) => {
      const body = document.getElementById('activityBody');
      if (!body) return;
      const rows = Array.isArray(items) ? items : [];
      if (!rows.length) {
        body.innerHTML = '<div class="muted" style="padding:12px">No recent activity</div>';
        return;
      }
      body.innerHTML = rows.map((a, i) => {
        const active = i === 0 ? ' active' : '';
        const time = ParkdApp.fmtTime(a.ts);
        let text = '';
        if (a.kind === 'entry') {
          text = `<b>${a.vehicle_number}</b> entered ${a.zone_name} · ${a.facility_name}`;
        } else if (a.kind === 'payment') {
          text = `Bill paid — ${ParkdApp.rupee(a.amount || 0)} · <b>${a.vehicle_number}</b>`;
        } else {
          text = `<b>${a.vehicle_number}</b> activity update`;
        }
        return `
          <div class="act-item">
            <div class="act-dot${active}"></div>
            <div class="act-body">
              <div class="act-text">${text}</div>
              <div class="act-time">${time}</div>
            </div>
          </div>`;
      }).join('');
    };

    const loadKpi = async () => {
      const k = await ParkdAPI.request('/api/admin/dashboard');
      const v = document.querySelectorAll('.kpi-val');
      if (v[0]) v[0].textContent = ParkdApp.rupee(k.revenue_today || 0);
      if (v[1]) v[1].textContent = String(k.active_vehicles || 0);
      if (v[2]) v[2].textContent = String(k.free_slots || 0);
      if (v[3]) v[3].textContent = String(k.queue_length || 0);
      const activeSub = document.getElementById('kpiActiveSub');
      if (activeSub) activeSub.innerHTML = `across <b>${k.facility_count || 0}</b> facilities`;
      const freeSub = document.getElementById('kpiFreeSub');
      if (freeSub) freeSub.innerHTML = `of <b>${k.total_slots || 0}</b> total slots`;
      const queueSub = document.getElementById('kpiQueueSub');
      if (queueSub) queueSub.innerHTML = `<b>${k.waiting_count || 0}</b> waiting &middot; <b>${k.allocated_count || 0}</b> allocated`;
      renderRevenue(k.revenue_series);
      renderActivity(k.activity);
    };

    const loadOccupancy = async () => {
      const occ = await ParkdAPI.request('/api/admin/dashboard/occupancy');
      const wrap = document.querySelector('.occ-body');
      if (wrap) {
        wrap.innerHTML = occ.map(z => `
          <div class="occ-row">
            <div class="occ-meta"><span class="occ-name">${z.zone_name} — ${ParkdApp.tierLabel(z.tier_type)}</span><span class="occ-pct">${z.pct}%</span></div>
            <div class="occ-bar"><div class="occ-fill" style="width:${z.pct}%"></div></div>
            <div class="occ-slots">${z.occupied} occupied · ${z.free} free · ${z.total} total</div>
          </div>`).join('');
      }
    };

    const loadQueue = async () => {
      const qRows = await ParkdAPI.request('/api/admin/queue');
      const tbody = document.querySelector('.q-table tbody');
      if (tbody) {
        tbody.innerHTML = qRows.slice(0, 5).map(q => {
          const cls = q.STATUS === 'allocated' ? 'q-badge alloc' : 'q-badge';
          return `
            <tr>
              <td>${String(q.POSITION).padStart(2, '0')}</td>
              <td><b>${q.VEHICLE_NUMBER}</b></td>
              <td>${q.ZONE_NAME}</td>
              <td><span class="${cls}">${q.STATUS}</span></td>
            </tr>`;
        }).join('');
      }
      const sub = document.getElementById('liveQueueSub');
      if (sub) {
        const total = qRows.length;
        sub.textContent = total ? `${total} vehicle${total !== 1 ? 's' : ''} in queue` : 'No vehicles in queue';
      }
    };

    try { await loadKpi(); } catch (_) {}
    try { await loadOccupancy(); } catch (_) {}
    try { await loadQueue(); } catch (_) {}

    ParkdApp.poll(async () => {
      try { await loadKpi(); } catch (_) {}
      try { await loadQueue(); } catch (_) {}
    }, 5000);
    ParkdApp.poll(async () => {
      try { await loadOccupancy(); } catch (_) {}
    }, 15000);
  },

  async 'admin-slots'() {
    if (!ParkdAPI.requireAuth('auth.html?admin=1')) return;
    ParkdApp.applyAdminShell(ParkdAPI.admin());
    const rows = await ParkdAPI.request('/api/admin/slots?_t=' + Date.now());

    const state = window._parkdAdminSlotsState || { facilityId: null, zoneKey: null };
    const facilities = [];
    const facMap = new Map();
    rows.forEach(r => {
      const id = r.FACILITY_ID || r.FACILITY_NAME;
      if (!facMap.has(id)) {
        facMap.set(id, { id, name: r.FACILITY_NAME || 'Facility' });
      }
    });
    facMap.forEach(v => facilities.push(v));
    if (!state.facilityId && facilities.length) state.facilityId = facilities[0].id;

    const facSelect = document.querySelector('.fac-select');
    if (facSelect && facilities.length) {
      facSelect.innerHTML = facilities.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
      facSelect.value = state.facilityId;
      facSelect.onchange = () => {
        state.facilityId = facSelect.value;
        state.zoneKey = null;
        window._parkdAdminSel = null;
        ParkdPages['admin-slots']();
      };
    }

    const filtered = rows.filter(r => String(r.FACILITY_ID || r.FACILITY_NAME) === String(state.facilityId));
    const zoneMap = {};
    filtered.forEach(r => {
      const key = (r.ZONE_NAME || '').replace(/^Zone\s*/i, '').trim() || String(r.ZONE_ID);
      if (!zoneMap[key]) zoneMap[key] = { zone_id: r.ZONE_ID, zone_name: r.ZONE_NAME, slots: [] };
      zoneMap[key].slots.push(r);
    });
    const zoneKeys = Object.keys(zoneMap);
    if (!state.zoneKey) state.zoneKey = zoneKeys[0];

    const tabsContainer = document.querySelector('.zone-tabs');
    if (tabsContainer) {
      tabsContainer.innerHTML = zoneKeys.map(key => {
        const isActive = key === state.zoneKey;
        return `<button class="ztab ${isActive ? 'active' : ''}" onclick="window._parkdSlotSwitchZone('${key}')">Zone ${key}</button>`;
      }).join('');
    }

    window._parkdSlotSwitchZone = (key) => {
      state.zoneKey = key;
      window._parkdAdminSel = null;
      ParkdPages['admin-slots']();
    };

    const z = zoneMap[state.zoneKey] || { slots: [] };
    const stMap = s => s === 'free' ? 'free' : s === 'occupied' ? 'occ' : 'res';
    const slots = z.slots.map(s => ({ id: s.SLOT_NUMBER, slot_id: s.SLOT_ID, zone_id: s.ZONE_ID, st: stMap(s.STATUS) }));
    const total = slots.length;
    const free = slots.filter(s => s.st === 'free').length;
    const occ = slots.filter(s => s.st === 'occ').length;
    const res = slots.filter(s => s.st === 'res').length;
    const sbTotal = document.getElementById('sbTotal');
    const sbFree = document.getElementById('sbFree');
    const sbOcc = document.getElementById('sbOcc');
    const sbRes = document.getElementById('sbRes');
    if (sbTotal) sbTotal.textContent = String(total);
    if (sbFree) sbFree.textContent = String(free);
    if (sbOcc) sbOcc.textContent = String(occ);
    if (sbRes) sbRes.textContent = String(res);

    const adminSel = window._parkdAdminSel;
    const col = document.getElementById('lotCols');
    if (col) {
      const left = slots.filter((_, i) => i % 2 === 0);
      const right = slots.filter((_, i) => i % 2 !== 0);
      col.innerHTML = '';
      const mk = s => {
        const el = document.createElement('div');
        el.className = `slot slot-${adminSel && adminSel.slot_id === s.slot_id ? 'sel' : s.st}`;
        el.innerHTML = `<div><div class="snum">${s.id}</div></div><div class="sdot"></div>`;
        el.onclick = () => {
          window._parkdAdminSel = s;
          document.getElementById('epSlot').textContent = s.id;
          document.getElementById('epCurrent').textContent = `Current: ${s.st}`;
          document.getElementById('editPanel')?.classList.add('show');
          ParkdPages['admin-slots']();
        };
        return el;
      };
      const lc = document.createElement('div'); lc.className = 'slots-col';
      left.forEach(s => lc.appendChild(mk(s)));
      const lane = document.createElement('div'); lane.className = 'lane';
      lane.innerHTML = '<div class="lane-line" style="height:200px"></div>';
      const rc = document.createElement('div'); rc.className = 'slots-col';
      right.forEach(s => rc.appendChild(mk(s)));
      col.appendChild(lc); col.appendChild(lane); col.appendChild(rc);
    }

    window._parkdAdminSlotsState = state;
    window.setStatus = async (st) => {
      const sel = window._parkdAdminSel;
      if (!sel) return;
      await ParkdAPI.request(`/api/admin/slots/${sel.slot_id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: st, zone_id: sel.zone_id })
      });
      document.getElementById('epCurrent').textContent = `Changed to: ${st}`;
      window._parkdAdminSel = null;
      document.getElementById('editPanel')?.classList.remove('show');
      ParkdPages['admin-slots']();
    };
    window.closeEdit = () => {
      window._parkdAdminSel = null;
      document.getElementById('editPanel')?.classList.remove('show');
    };
  },

  async 'admin-queue'() {
    if (!ParkdAPI.requireAuth('auth.html?admin=1')) return;
    ParkdApp.applyAdminShell(ParkdAPI.admin());
    const load = async () => {
      const rows = await ParkdAPI.request('/api/admin/queue');
      const tbody = document.getElementById('qBody');
      if (!tbody) return;
      tbody.innerHTML = rows.map(q => {
        const allocCls = q.STATUS === 'allocated' ? ' alloc' : '';
        return `
          <tr>
            <td><span class="pos-badge">#${String(q.POSITION).padStart(2, '0')}</span></td>
            <td class="veh-cell"><b>${q.VEHICLE_NUMBER}</b><span>${q.VEHICLE_TYPE || ''}</span></td>
            <td class="fac-cell">${q.FACILITY_NAME || '—'}</td>
            <td><div style="font-weight:600">${q.ZONE_NAME}</div></td>
            <td><span class="arrival-t">${ParkdApp.fmtTime(q.ARRIVAL_TIME)}</span></td>
            <td><span class="wait-t">${q.WAIT_MINUTES || 0}m</span></td>
            <td><span class="slot-cell${q.SLOT_NUMBER ? '' : ' none'}">${q.SLOT_NUMBER || '—'}</span></td>
            <td><span class="st-badge${allocCls}">${q.STATUS}</span></td>
            <td>
              <div class="action-cell">
                ${q.STATUS === 'waiting' ? `
                  <button data-qid="${q.QUEUE_ID}" data-zid="${q.ZONE_ID}" class="btn btn-f btn-auto">Auto</button>
                  <button data-qid="${q.QUEUE_ID}" data-zid="${q.ZONE_ID}" class="btn btn-manual" style="padding:8px">Select</button>
                ` : ''}
                <button data-qid="${q.QUEUE_ID}" class="btn btn-danger btn-rm">Remove</button>
              </div>
            </td>
          </tr>`;
      }).join('');

      const total = rows.length;
      const wait = rows.filter(r => r.STATUS === 'waiting').length;
      const alloc = rows.filter(r => r.STATUS === 'allocated').length;
      const kTotal = document.getElementById('kTotal');
      const kWait = document.getElementById('kWait');
      const kAlloc = document.getElementById('kAlloc');
      const qcSub = document.getElementById('qcSub');
      if (kTotal) kTotal.textContent = String(total);
      if (kWait) kWait.textContent = String(wait);
      if (kAlloc) kAlloc.textContent = String(alloc);
      if (qcSub) qcSub.textContent = `${total} vehicle${total !== 1 ? 's' : ''} — updated just now`;

      tbody.querySelectorAll('.btn-auto').forEach(b => {
        b.onclick = async () => {
          try {
            await ParkdAPI.request(`/api/admin/queue/${b.dataset.qid}/auto-allocate`, { method: 'POST' });
            ParkdApp.toast('Slot auto-allocated');
            load();
          } catch(e) { alert(e.message); }
        };
      });

      tbody.querySelectorAll('.btn-manual').forEach(b => {
        b.onclick = async () => {
          const fid = ParkdAPI.admin().facility_id;
          let slots;
          try {
             const allSlots = await ParkdAPI.request('/api/admin/slots?_t=' + Date.now());
             slots = allSlots.filter(s => s.ZONE_ID == b.dataset.zid);
          } catch(e) { return alert(e.message); }

          const pBody = document.getElementById('slotPickerBody');
          if (pBody) {
            pBody.innerHTML = `
              <div class="slot-grid">
                ${slots.map(s => {
                  const isFree = s.STATUS === 'free';
                  return `<button class="slot-btn" ${isFree ? '' : 'disabled'} onclick="allocateManual(${b.dataset.qid}, ${b.dataset.zid}, ${s.SLOT_ID})">${s.SLOT_NUMBER}</button>`;
                }).join('')}
              </div>
            `;
          }
          document.getElementById('slotModalOverlay').classList.add('show');
        };
      });

      tbody.querySelectorAll('.btn-rm').forEach(b => {
        b.onclick = async () => {
          await ParkdAPI.request(`/api/admin/queue/${b.dataset.qid}`, { method: 'DELETE' });
          ParkdApp.toast('Removed from queue');
          load();
        };
      });
    };
    window.renderTable = load;
    window.closeSlotModal = () => document.getElementById('slotModalOverlay').classList.remove('show');
    window.allocateManual = async (qid, zid, sid) => {
      try {
        await ParkdAPI.request(`/api/admin/queue/${qid}/allocate`, {
          method: 'POST',
          body: JSON.stringify({ slot_id: sid, zone_id: zid })
        });
        window.closeSlotModal();
        ParkdApp.toast('Slot allocated');
        load();
      } catch(e) { alert(e.message); }
    };
    await load();
    ParkdApp.poll(load, 5000);
  },

  async 'admin-offers'() {
    if (!ParkdAPI.requireAuth('auth.html?admin=1')) return;
    ParkdApp.applyAdminShell(ParkdAPI.admin());
    const rows = await ParkdAPI.request('/api/admin/offers');
    const list = document.getElementById('offerList');
    const countEl = document.getElementById('offerCount');
    const parseCond = (c) => {
      const txt = String(c || '').trim();
      if (!txt) return { name: 'Offer', desc: '' };
      const parts = txt.split(' — ');
      return { name: parts[0], desc: parts.slice(1).join(' — ') };
    };
    if (list) {
      list.innerHTML = rows.map(o => {
        const p = parseCond(o.CONDITION);
        return `
          <div class="offer-card active-offer">
            <div class="oc-top">
              <div style="flex:1;min-width:0">
                <div class="oc-name">${p.name || 'Offer'}</div>
                <div class="oc-condition">${p.desc || '—'}</div>
              </div>
              <div>
                <div class="oc-disc">-${o.DISCOUNT_PCT}%</div>
                <div class="oc-disc-sub">off bill</div>
              </div>
            </div>
            <div class="oc-foot">
              <span class="o-badge active">Active</span>
              <span class="o-meta">${o.CREATED_BY}</span>
              <button data-oid="${o.OFFER_ID}" data-name="${p.name}" data-desc="${p.desc}" data-disc="${o.DISCOUNT_PCT}" class="btn edit-btn" style="padding:4px 8px;font-size:0.65rem">Edit</button>
              <button data-oid="${o.OFFER_ID}" class="del-btn"><svg viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M9.5 3.5l-.5 7a1 1 0 0 1-1 .9H4.5a1 1 0 0 1-1-.9L3 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></button>
            </div>
          </div>`;
      }).join('');
      list.querySelectorAll('.del-btn').forEach(b => {
        b.onclick = async () => {
          await ParkdAPI.request(`/api/admin/offers/${b.dataset.oid}`, { method: 'DELETE' });
          ParkdPages['admin-offers']();
        };
      });
      list.querySelectorAll('.edit-btn').forEach(b => {
        b.onclick = () => {
          document.getElementById('editId').value = b.dataset.oid;
          document.getElementById('efName').value = b.dataset.name;
          document.getElementById('efCond').value = b.dataset.desc;
          document.getElementById('efDisc').value = b.dataset.disc;
          document.getElementById('editModalOverlay').classList.add('show');
        };
      });
    }
    if (countEl) countEl.textContent = `${rows.length} offer${rows.length !== 1 ? 's' : ''}`;

    window.closeEditModal = () => document.getElementById('editModalOverlay').classList.remove('show');
    window.saveEditOffer = async () => {
      const oid = document.getElementById('editId').value;
      const name = document.getElementById('efName').value.trim();
      const cond = document.getElementById('efCond').value.trim();
      const disc = Number(document.getElementById('efDisc').value || 0);
      const condition = name && cond ? `${name} — ${cond}` : (cond || name || '');
      if (!condition) return alert('Enter offer name or condition');
      if (!disc || disc < 1 || disc > 100) return alert('Discount must be between 1 and 100');
      await ParkdAPI.request(`/api/admin/offers/${oid}`, {
        method: 'PUT',
        body: JSON.stringify({ condition, discount_pct: disc })
      });
      closeEditModal();
      ParkdPages['admin-offers']();
    };

    window.createOffer = async () => {
      const name = document.getElementById('fName')?.value?.trim();
      const cond = document.getElementById('fCond')?.value?.trim();
      const disc = Number(document.getElementById('fDisc')?.value || 0);
      const condition = name && cond ? `${name} — ${cond}` : (cond || name || '');
      if (!condition) return alert('Enter offer name or condition');
      if (!disc || disc < 1 || disc > 100) return alert('Discount must be between 1 and 100');
      await ParkdAPI.request('/api/admin/offers', {
        method: 'POST',
        body: JSON.stringify({ condition, discount_pct: disc })
      });
      if(document.getElementById('fName')) document.getElementById('fName').value = '';
      if(document.getElementById('fCond')) document.getElementById('fCond').value = '';
      if(document.getElementById('fDisc')) document.getElementById('fDisc').value = '';
      const by = document.getElementById('fBy');
      if (by) by.selectedIndex = 0;
      const dp = document.getElementById('dpVal');
      if (dp) dp.textContent = '—';
      if (typeof window.updatePreview === 'function') window.updatePreview();
      ParkdPages['admin-offers']();
    };
  },

  async profile() {
    if (!ParkdAPI.requireAuth()) return;
    ParkdApp.applyUserShell(ParkdAPI.user());
    
    // Load User
    try {
      const user = await ParkdAPI.request('/api/users/me');
      document.getElementById('pName').value = user.NAME || '';
      document.getElementById('pEmail').value = user.EMAIL || '';
      document.getElementById('pPhone').value = user.PHONE_NUMBER || '';
    } catch(e) { console.error(e); }

    const loadVehicles = async () => {
      const listEl = document.getElementById('vehicleList');
      if (!listEl) return;
      try {
        const vs = await ParkdAPI.request('/api/vehicles');
        if (!vs.length) {
          listEl.innerHTML = '<div style="font-size:0.8rem;color:var(--gray-d1);text-align:center;padding:12px">No vehicles added</div>';
        } else {
          listEl.innerHTML = vs.map(v => `
            <div class="vehicle-item">
              <div>
                <div class="v-number">${v.VEHICLE_NUMBER}</div>
                <div class="v-type">${v.VEHICLE_TYPE}</div>
              </div>
              <div class="v-actions">
                <button class="btn" style="padding:4px 8px;font-size:0.65rem" onclick="editVehicle('${v.VEHICLE_ID}', '${v.VEHICLE_NUMBER}', '${v.VEHICLE_TYPE}')">Edit</button>
                <button class="icon-btn del-btn" style="width:26px;height:26px" onclick="deleteVehicle('${v.VEHICLE_ID}')"><svg viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M9.5 3.5l-.5 7a1 1 0 0 1-1 .9H4.5a1 1 0 0 1-1-.9L3 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></button>
              </div>
            </div>
          `).join('');
        }
      } catch(e) { console.error(e); }
    };
    loadVehicles();

    window.saveProfile = async () => {
      const name = document.getElementById('pName').value.trim();
      const phone = document.getElementById('pPhone').value.trim();
      const email = document.getElementById('pEmail').value.trim();
      const pwd = document.getElementById('pPass').value.trim();
      if (!name || !phone || !email) return alert('Name, email and phone are required');
      const body = { name, email, phone_number: phone };
      if (pwd) body.password = pwd;
      
      try {
        await ParkdAPI.request('/api/users/profile', {
          method: 'PUT',
          body: JSON.stringify(body)
        });
        document.getElementById('pPass').value = '';
        const userStr = localStorage.getItem('parkd_user');
        if (userStr) {
          const u = JSON.parse(userStr);
          u.name = name;
          localStorage.setItem('parkd_user', JSON.stringify(u));
          ParkdApp.applyUserShell(u);
        }
        alert('Profile saved successfully');
      } catch(e) { alert(e.message); }
    };

    window.saveVehicle = async () => {
      const vid = document.getElementById('vEditId').value;
      const num = document.getElementById('vNumber').value.trim();
      const type = document.getElementById('vType').value;
      if (!num) return alert('Vehicle number is required');
      
      try {
        if (vid) {
          await ParkdAPI.request(`/api/vehicles/${vid}`, {
            method: 'PUT',
            body: JSON.stringify({ vehicle_number: num, vehicle_type: type })
          });
        } else {
          await ParkdAPI.request('/api/vehicles', {
            method: 'POST',
            body: JSON.stringify({ vehicle_number: num, vehicle_type: type })
          });
        }
        cancelEditVehicle();
        loadVehicles();
      } catch(e) { alert(e.message); }
    };

    window.editVehicle = (id, num, type) => {
      document.getElementById('vEditId').value = id;
      document.getElementById('vNumber').value = num;
      document.getElementById('vType').value = type;
      document.getElementById('vehFormTitle').textContent = 'Edit Vehicle';
      document.getElementById('vCancelBtn').style.display = 'inline-flex';
    };

    window.cancelEditVehicle = () => {
      document.getElementById('vEditId').value = '';
      document.getElementById('vNumber').value = '';
      document.getElementById('vType').value = 'sedan';
      document.getElementById('vehFormTitle').textContent = 'Add Vehicle';
      document.getElementById('vCancelBtn').style.display = 'none';
    };

    window.deleteVehicle = async (id) => {
      if (!confirm('Are you sure you want to delete this vehicle?')) return;
      try {
        await ParkdAPI.request(`/api/vehicles/${id}`, { method: 'DELETE' });
        loadVehicles();
      } catch(e) { alert(e.message); }
    };
  },

  async 'admin-rates'() {
    if (!ParkdAPI.requireAuth()) return;
    ParkdApp.applyAdminShell(ParkdAPI.user());
    
    const list = document.getElementById('ratesList');
    if (!list) return;

    try {
      const rates = await ParkdAPI.request('/api/admin/rates');
      list.innerHTML = rates.map(r => `
        <div class="rate-item">
          <div class="rate-title">${r.TIER_TYPE} Zone</div>
          <div style="position:relative">
            <span style="position:absolute;left:8px;top:9px;color:var(--gray-d1);font-family:var(--font-mono);font-size:0.8rem">$</span>
            <input type="number" step="0.01" class="rate-input" id="rate_${r.TIER_TYPE}" value="${r.BASE_RATE}" style="padding-left:20px">
          </div>
          <button class="btn" onclick="saveRate('${r.TIER_TYPE}')">Save</button>
        </div>
      `).join('');
    } catch(e) {
      list.innerHTML = `<div style="padding:12px;color:red">${e.message}</div>`;
    }

    window.saveRate = async (tier) => {
      const input = document.getElementById(`rate_${tier}`);
      const val = Number(input.value);
      if (isNaN(val) || val < 0) return alert('Invalid rate');
      try {
        await ParkdAPI.request(`/api/admin/rates/${tier}`, {
          method: 'PUT',
          body: JSON.stringify({ base_rate: val })
        });
        alert('Rate updated successfully');
      } catch(e) { alert(e.message); }
    };
  },

  async 'admin-billing'() {
    if (!ParkdAPI.requireAuth()) return;
    ParkdApp.applyAdminShell(ParkdAPI.user());

    const tbody = document.getElementById('billingList');
    if (!tbody) return;

    try {
      const bills = await ParkdAPI.request('/api/admin/billing');
      if (!bills.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--gray-d1)">No billing records found</td></tr>';
        return;
      }

      tbody.innerHTML = bills.map(b => {
        const entry = new Date(b.ENTRY_DATE).toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
        const exit = b.EXIT_DATE ? new Date(b.EXIT_DATE).toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '—';
        const amt = `$${Number(b.AMOUNT).toFixed(2)}`;
        const statusClass = b.PAYMENT_STATUS.toLowerCase();
        
        return `
          <tr>
            <td style="font-family:var(--font-mono);font-weight:700">#${b.BILL_ID}</td>
            <td>${b.FACILITY_NAME}</td>
            <td style="font-family:var(--font-mono)">${b.VEHICLE_NUMBER}</td>
            <td>${entry}</td>
            <td>${exit}</td>
            <td style="font-family:var(--font-mono);font-weight:700">${amt}</td>
            <td><span class="status ${statusClass}">${b.PAYMENT_STATUS}</span></td>
          </tr>
        `;
      }).join('');
    } catch(e) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:red">${e.message}</td></tr>`;
    }
  },

  async 'admin-facilities'() {
    if (!ParkdAPI.requireAuth()) return;
    ParkdApp.applyAdminShell(ParkdAPI.user());
    
    let facilities = [];
    const load = async () => {
      const list = document.getElementById('facList');
      if (!list) return;
      try {
        facilities = await ParkdAPI.request('/api/admin/facilities');
        if (!facilities.length) {
          list.innerHTML = '<div style="color:var(--gray-d1);font-size:0.8rem">No facilities found.</div>';
        } else {
          list.innerHTML = facilities.map(f => `
            <div class="fac-item">
              <div class="fac-top">
                <div>
                  <div class="fac-name">${f.name}</div>
                  <div class="fac-loc">${f.location}, ${f.city}</div>
                </div>
                <button class="btn" onclick="openZoneModal(${f.facility_id})" style="padding:4px 8px;font-size:0.7rem">+ Add Zone</button>
              </div>
              ${f.zones && f.zones.length ? `
                <div class="zone-grid">
                  ${f.zones.map(z => `
                    <div class="zone-item">
                      <div class="zone-name">${z.zone_name}</div>
                      <div class="zone-meta">${z.total_slots} Slots &middot; ${z.tier_type}</div>
                    </div>
                  `).join('')}
                </div>
              ` : '<div style="font-size:0.75rem;color:var(--gray-d1);margin-top:8px">No zones configured.</div>'}
            </div>
          `).join('');
        }
        
        // update LA dropdown
        const laFac = document.getElementById('laFacId');
        if (laFac) {
          laFac.innerHTML = facilities.map(f => `<option value="${f.facility_id}">${f.name}</option>`).join('');
        }
      } catch(e) {
        list.innerHTML = `<div style="color:red">${e.message}</div>`;
      }
    };
    load();

    window.openFacModal = () => {
      document.getElementById('modalTitle').textContent = 'Add Facility';
      document.getElementById('modalBody').innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px">
          <div class="form-group" style="margin-bottom:0"><label class="form-label">Name</label><input type="text" class="form-input" id="fmName"></div>
          <div class="form-group" style="margin-bottom:0"><label class="form-label">Location</label><input type="text" class="form-input" id="fmLoc"></div>
          <div class="form-group" style="margin-bottom:0"><label class="form-label">City</label><input type="text" class="form-input" id="fmCity"></div>
        </div>
      `;
      document.getElementById('modalSaveBtn').onclick = async () => {
        const name = document.getElementById('fmName').value.trim();
        const loc = document.getElementById('fmLoc').value.trim();
        const city = document.getElementById('fmCity').value.trim();
        if (!name || !loc || !city) return alert('All fields required');
        try {
          await ParkdAPI.request('/api/admin/facilities', {
            method: 'POST',
            body: JSON.stringify({ name, location: loc, city })
          });
          closeModal();
          load();
        } catch(e) { alert(e.message); }
      };
      document.getElementById('modalOverlay').style.display = 'flex';
    };

    window.openZoneModal = (fid) => {
      document.getElementById('modalTitle').textContent = 'Add Zone';
      document.getElementById('modalBody').innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px">
          <div class="form-group" style="margin-bottom:0"><label class="form-label">Zone Name (e.g. Zone A)</label><input type="text" class="form-input" id="zmName"></div>
          <div class="form-row" style="margin-bottom:0">
            <div class="form-group" style="margin-bottom:0"><label class="form-label">Tier</label>
              <select class="form-input" id="zmTier"><option value="general">General</option><option value="gold">Gold</option><option value="platinum">Platinum</option></select>
            </div>
            <div class="form-group" style="margin-bottom:0"><label class="form-label">Total Slots</label><input type="number" class="form-input" id="zmSlots" value="20"></div>
          </div>
        </div>
      `;
      document.getElementById('modalSaveBtn').onclick = async () => {
        const name = document.getElementById('zmName').value.trim();
        const tier = document.getElementById('zmTier').value;
        const slots = Number(document.getElementById('zmSlots').value);
        if (!name || !slots) return alert('All fields required');
        try {
          await ParkdAPI.request(`/api/admin/facilities/${fid}/zones`, {
            method: 'POST',
            body: JSON.stringify({ zone_name: name, tier_type: tier, total_slots: slots })
          });
          closeModal();
          load();
        } catch(e) { alert(e.message); }
      };
      document.getElementById('modalOverlay').style.display = 'flex';
    };

    window.closeModal = () => {
      document.getElementById('modalOverlay').style.display = 'none';
    };

    window.addLocalAdmin = async () => {
      const name = document.getElementById('laName').value.trim();
      const email = document.getElementById('laEmail').value.trim();
      const pass = document.getElementById('laPass').value.trim();
      const fid = document.getElementById('laFacId').value;
      if (!name || !email || !pass || !fid) return alert('All fields required');
      try {
        await ParkdAPI.request('/api/admin/local-admins', {
          method: 'POST',
          body: JSON.stringify({ name, email, password: pass, facility_id: fid })
        });
        alert('Local Admin added successfully');
        document.getElementById('laName').value = '';
        document.getElementById('laEmail').value = '';
        document.getElementById('laPass').value = '';
      } catch(e) { alert(e.message); }
    };
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page && typeof ParkdPages[page] === 'function') ParkdPages[page]();
});
