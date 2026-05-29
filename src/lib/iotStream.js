// Real-time IoT station stream
// Simulates a WebSocket feed of station sensor data (fill level, temperature,
// battery, door status, recent deposits). In production this connects to a
// real MQTT/WebSocket broker; here we use setInterval to drive updates.

import { bus } from './eventBus'

// Station base configuration — lat/lng for distance calculations
export const STATION_REGISTRY = {
  'ST-001': { name: 'Surry Hills Hub',      suburb: 'Surry Hills',   lat: -33.8840, lng: 151.2090, capacity_l: 240 },
  'ST-002': { name: 'Redfern Node',         suburb: 'Redfern',       lat: -33.8930, lng: 151.2060, capacity_l: 240 },
  'ST-003': { name: 'Newtown Green',        suburb: 'Newtown',       lat: -33.8970, lng: 151.1790, capacity_l: 120 },
  'ST-004': { name: 'Marrickville Hub',     suburb: 'Marrickville',  lat: -33.9110, lng: 151.1570, capacity_l: 240 },
  'ST-005': { name: 'Glebe Point',          suburb: 'Glebe',         lat: -33.8700, lng: 151.1870, capacity_l: 120 },
  'ST-006': { name: 'Alexandria Depot',     suburb: 'Alexandria',    lat: -33.9080, lng: 151.1960, capacity_l: 360 },
  'ST-007': { name: 'Chippendale Drop',     suburb: 'Chippendale',   lat: -33.8880, lng: 151.1960, capacity_l: 120 },
  'ST-008': { name: 'Darlinghurst Point',   suburb: 'Darlinghurst',  lat: -33.8750, lng: 151.2190, capacity_l: 120 },
}

const MATERIALS = ['Aluminium', 'PET Plastic', 'HDPE', 'Glass', 'Steel', 'Cardboard']

function rand(lo, hi) { return lo + Math.random() * (hi - lo) }

class IoTStream {
  #state      = {}
  #subs       = new Map()   // stationId → Set<fn>
  #globalSubs = new Set()
  #timer      = null
  #connected  = false
  #tickCount  = 0

  connect(intervalMs = 5000) {
    if (this.#connected) return this

    for (const [id, cfg] of Object.entries(STATION_REGISTRY)) {
      this.#state[id] = {
        stationId:     id,
        name:          cfg.name,
        suburb:        cfg.suburb,
        lat:           cfg.lat,
        lng:           cfg.lng,
        capacity_l:    cfg.capacity_l,
        fill_pct:      Math.round(rand(15, 80)),
        temperature_c: Math.round(rand(18, 28) * 10) / 10,
        battery_pct:   Math.round(rand(60, 100)),
        door_open:     false,
        wifi_rssi:     Math.round(rand(-75, -45)),
        status:        'online',
        last_deposit:  null,
        alerts:        [],
        deposits_today: Math.round(rand(2, 24)),
        weight_today_kg: Math.round(rand(5, 80) * 10) / 10,
        updated_at:    new Date().toISOString(),
      }
    }

    // ST-003 starts offline for demo
    this.#state['ST-003'].status = 'offline'
    this.#state['ST-003'].fill_pct = 0
    this.#state['ST-004'].fill_pct = 78  // near capacity

    this.#connected = true
    this.#timer = setInterval(() => this.#tick(), intervalMs)
    return this
  }

  #tick() {
    this.#tickCount++
    const now = new Date().toISOString()

    for (const [id, st] of Object.entries(this.#state)) {
      if (st.status === 'offline') {
        // Small chance of recovery
        if (Math.random() < 0.02) {
          st.status = 'online'
          bus.publish('station.online', { stationId: id, name: st.name })
        }
        st.updated_at = now
        this.#emit(id, st)
        continue
      }

      // Fill level drifts upward (deposits) with occasional pickup resets
      const fillDelta = rand(0, 1.2) - 0.2  // net upward bias
      st.fill_pct = Math.max(0, Math.min(100, Math.round((st.fill_pct + fillDelta) * 10) / 10))

      // Temperature and battery drift
      st.temperature_c = Math.round((st.temperature_c + rand(-0.3, 0.3)) * 10) / 10
      st.temperature_c = Math.max(14, Math.min(44, st.temperature_c))
      st.battery_pct   = Math.max(0, st.battery_pct - rand(0, 0.08))
      st.battery_pct   = Math.round(st.battery_pct * 10) / 10
      st.wifi_rssi     = Math.round(st.wifi_rssi + rand(-2, 2))
      st.wifi_rssi     = Math.max(-95, Math.min(-40, st.wifi_rssi))

      // Sporadic deposit event (~8% chance per tick)
      if (Math.random() < 0.08) {
        const weightKg = Math.round(rand(0.2, 3.5) * 100) / 100
        st.last_deposit = {
          timestamp:   now,
          material:    MATERIALS[Math.floor(Math.random() * MATERIALS.length)],
          weight_kg:   weightKg,
          user_id:     `USR-${String(Math.floor(rand(100, 999))).padStart(5, '0')}`,
        }
        st.deposits_today  += 1
        st.weight_today_kg  = Math.round((st.weight_today_kg + weightKg) * 100) / 100
        st.fill_pct         = Math.min(100, st.fill_pct + rand(1, 4))
      }

      // Pickup event: reset fill level (~2% chance)
      if (Math.random() < 0.02) {
        st.fill_pct = Math.round(rand(2, 8))
        bus.publish('pickup.completed', { stationId: id, name: st.name })
      }

      // Compute alerts
      st.alerts = []
      if (st.fill_pct  >= 90) st.alerts.push({ code: 'CAPACITY_CRITICAL', level: 'critical', msg: `${st.fill_pct}% full` })
      else if (st.fill_pct >= 75) st.alerts.push({ code: 'CAPACITY_HIGH',  level: 'warning',  msg: `${st.fill_pct}% full` })
      if (st.battery_pct <= 15) st.alerts.push({ code: 'BATTERY_LOW',      level: 'warning',  msg: `${st.battery_pct}% battery` })
      if (st.temperature_c > 38) st.alerts.push({ code: 'TEMP_HIGH',       level: 'warning',  msg: `${st.temperature_c}°C` })

      // Rare offline transition
      if (Math.random() < 0.003) {
        st.status = 'offline'
        bus.publish('station.offline', { stationId: id, name: st.name })
      }

      st.updated_at = now
      this.#emit(id, st)
    }
  }

  #emit(stationId, state) {
    const snapshot = { ...state }
    const handlers = this.#subs.get(stationId)
    if (handlers) for (const h of handlers) try { h(snapshot) } catch {}
    for (const h of this.#globalSubs) try { h(snapshot) } catch {}
  }

  // Subscribe to one station or all (stationId = null)
  // Returns an unsubscribe function.
  subscribe(stationId, handler) {
    if (stationId === null) {
      this.#globalSubs.add(handler)
      for (const st of Object.values(this.#state)) handler({ ...st })
      return () => this.#globalSubs.delete(handler)
    }
    if (!this.#subs.has(stationId)) this.#subs.set(stationId, new Set())
    this.#subs.get(stationId).add(handler)
    if (this.#state[stationId]) handler({ ...this.#state[stationId] })
    return () => this.#subs.get(stationId)?.delete(handler)
  }

  getState(stationId) {
    return stationId ? (this.#state[stationId] ? { ...this.#state[stationId] } : null) : { ...this.#state }
  }

  getAllStations() {
    return Object.values(this.#state).map(s => ({ ...s }))
  }

  // Simulate a manual deposit for testing
  simulateDeposit(stationId, { weightKg = 1.2, material = 'Aluminium', userId = 'USR-TEST' } = {}) {
    const st = this.#state[stationId]
    if (!st || st.status === 'offline') return null
    st.last_deposit = { timestamp: new Date().toISOString(), material, weight_kg: weightKg, user_id: userId }
    st.fill_pct = Math.min(100, st.fill_pct + rand(1, 4))
    st.deposits_today += 1
    st.updated_at = new Date().toISOString()
    this.#emit(stationId, st)
    return { ...st }
  }

  disconnect() {
    if (this.#timer) { clearInterval(this.#timer); this.#timer = null }
    this.#subs.clear()
    this.#globalSubs.clear()
    this.#connected = false
  }

  get isConnected()  { return this.#connected }
  get stationCount() { return Object.keys(this.#state).length }
  get tickCount()    { return this.#tickCount }
}

export const iotStream = new IoTStream()
