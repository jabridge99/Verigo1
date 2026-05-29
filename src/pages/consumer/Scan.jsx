import React, { useState, useEffect, useRef } from 'react'
import {
  QrCode, CheckCircle, MapPin, Keyboard, ArrowRight, X,
  Wifi, WifiOff, Battery, Leaf, Package, AlertCircle,
} from 'lucide-react'
import { iotStream, STATION_REGISTRY } from '../../lib/iotStream'
import { marketFeed } from '../../lib/marketFeed'
import { ledger } from '../../lib/ledger'
import { audit, AUDIT_ACTIONS } from '../../lib/audit'

// ── Camera / BarcodeDetector helpers live outside the component so they
//    don't get re-created on every render, yet still close over the refs
//    that are passed in by value each call.
function buildScanLoop(videoRef, rafRef, onDetected) {
  const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
  async function scan() {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      rafRef.current = requestAnimationFrame(scan)
      return
    }
    try {
      const codes = await detector.detect(videoRef.current)
      if (codes.length > 0) {
        onDetected(codes[0].rawValue)
        return
      }
    } catch { /* no code in this frame */ }
    rafRef.current = requestAnimationFrame(scan)
  }
  rafRef.current = requestAnimationFrame(scan)
}

// ── Station code map: QR code prefix → stationId ─────────────────────────────
const CODE_MAP = {
  'CZ-001': 'ST-001', 'CZ-002': 'ST-002', 'CZ-003': 'ST-003',
  'CZ-004': 'ST-004', 'CZ-005': 'ST-005', 'CZ-006': 'ST-006',
  'CZ-007': 'ST-007', 'CZ-008': 'ST-008',
}

const MATERIAL_KEYS = {
  Aluminium: 'aluminium', 'PET Plastic': 'pet_plastic', HDPE: 'hdpe',
  Glass: 'glass', Steel: 'steel', Cardboard: 'paperboard',
}

const DEMO_USER = { id: 'USR-00001', name: 'Sarah M.' }

function resolveStationId(raw) {
  const upper = raw.trim().toUpperCase()
  const prefix = upper.slice(0, 6)
  return CODE_MAP[prefix] ?? CODE_MAP[upper.slice(0, 6)] ?? null
}

// ── Deposit confirmation modal ────────────────────────────────────────────────
function DepositModal({ stationId, stationLive, prices, onClose, onComplete }) {
  const cfg     = STATION_REGISTRY[stationId] ?? {}
  const live    = stationLive ?? {}
  const [mat,    setMat]    = useState('aluminium')
  const [weight, setWeight] = useState('')
  const [done,   setDone]   = useState(false)
  const [result, setResult] = useState(null)

  const spotPrice = prices?.[mat]
  const spotPerKg = spotPrice ? spotPrice.spot / 1000 : 0
  const estPayout = weight && spotPerKg ? Math.round(spotPerKg * 0.85 * parseFloat(weight) * 100) / 100 : 0
  const estPoints = weight ? Math.round(estPayout / 0.05) : 0

  async function confirmDeposit() {
    const weightKg    = parseFloat(weight)
    if (!weightKg || weightKg <= 0) return
    const grossAud    = Math.round(spotPerKg * weightKg * 100) / 100
    const platformFee = Math.round(grossAud * 0.15 * 100) / 100
    const netAud      = Math.round((grossAud - platformFee) * 100) / 100

    try {
      ledger.recordDeposit({ userId: DEMO_USER.id, grossAud, platformFeeAud: platformFee, actor: 'consumer' })
    } catch { /* ledger may not have accounts set up in demo */ }

    void audit(AUDIT_ACTIONS.LEDGER_POSTED, {
      actor: DEMO_USER.id,
      entityId: stationId,
      after: { weightKg, material: mat, grossAud, netAud },
    })

    setResult({ weightKg, material: mat, grossAud, netAud, ecoPoints: Math.round(netAud / 0.05) })
    setDone(true)
    onComplete({ stationId, material: mat, weightKg, netAud })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-white">Confirm Deposit</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
        </div>

        {done ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-eco-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7 text-eco-700" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Deposit Recorded!</h3>
              <p className="text-sm text-slate-500 mt-1">{cfg.name}</p>
            </div>
            <div className="bg-eco-50 border border-eco-100 rounded-xl p-4 text-sm space-y-2 text-left">
              {[
                ['Material',   result.material.replace('_', ' ')],
                ['Weight',     `${result.weightKg} kg`],
                ['Gross Value', `$${result.grossAud.toFixed(2)} AUD`],
                ['Your Payout', `$${result.netAud.toFixed(2)} AUD`],
                ['Eco-Points Earned', `+${result.ecoPoints.toLocaleString()} pts`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-semibold text-slate-900">{v}</span>
                </div>
              ))}
            </div>
            <button onClick={onClose}
              className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl transition-colors">
              Done
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Station info */}
            <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-eco-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-eco-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 truncate">{cfg.name}</div>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>{stationId}</span>
                  {live.status === 'offline'
                    ? <span className="text-red-500 font-semibold">· Offline</span>
                    : <><span>·</span><span className="text-eco-600">{live.fill_pct ?? '--'}% full</span></>
                  }
                </div>
              </div>
            </div>

            {/* Material */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Material</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(MATERIAL_KEYS).map(([label, key]) => {
                  const p = prices?.[key]
                  return (
                    <button
                      key={key}
                      onClick={() => setMat(key)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        mat === key ? 'border-eco-500 bg-eco-50 ring-1 ring-eco-400' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-800 truncate">{label}</div>
                      {p && <div className="text-[10px] text-slate-400">${(p.spot / 1000).toFixed(3)}/kg</div>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Weight */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="e.g. 2.5"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500"
              />
            </div>

            {/* Estimate */}
            {weight && spotPerKg > 0 && (
              <div className="bg-eco-50 border border-eco-100 rounded-xl p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Spot rate</span>
                  <span className="font-semibold">${spotPerKg.toFixed(4)}/kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimated payout</span>
                  <span className="font-bold text-eco-700">${estPayout.toFixed(2)} AUD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Eco-Points earned</span>
                  <span className="font-bold text-amber-600">+{estPoints.toLocaleString()} pts</span>
                </div>
              </div>
            )}

            <button
              onClick={confirmDeposit}
              disabled={!weight || parseFloat(weight) <= 0}
              className="w-full bg-eco-700 hover:bg-eco-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Confirm Deposit <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Scan() {
  const [mode,      setMode]      = useState('camera')
  const [code,      setCode]      = useState('')
  const [stationId, setStationId] = useState(null)
  const [error,     setError]     = useState('')
  const [stationLive, setStationLive] = useState({})
  const [prices,    setPrices]    = useState({})
  const [showDeposit, setShowDeposit] = useState(false)
  const [recentScans, setRecentScans] = useState([
    { code: 'CZ-001-A', stationId: 'ST-001', name: 'Surry Hills Hub', date: '27 May', payout: '$5.40' },
    { code: 'CZ-002-B', stationId: 'ST-002', name: 'Redfern Node',    date: '13 May', payout: '$8.80' },
  ])

  // ── Camera state ─────────────────────────────────────────────────────────────
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const rafRef    = useRef(null)
  const [camState, setCamState] = useState('idle') // 'idle'|'starting'|'active'|'error'|'unsupported'
  const [camError, setCamError] = useState('')

  async function startCamera() {
    if (!('mediaDevices' in navigator)) { setCamState('unsupported'); setCamError('Camera API not available on this device.'); return }
    if (!('BarcodeDetector' in window)) { setCamState('unsupported'); setCamError('QR scanning not supported on this browser. Use manual entry.'); return }
    setCamState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCamState('active')
      buildScanLoop(videoRef, rafRef, rawValue => {
        stopCamera()
        verifyCode(rawValue)
      })
    } catch (err) {
      setCamState('error')
      setCamError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access and try again.'
          : `Camera error: ${err.message}`
      )
    }
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCamState('idle')
  }

  // Stop camera when leaving camera mode
  useEffect(() => {
    if (mode !== 'camera') stopCamera()
  }, [mode])

  useEffect(() => {
    iotStream.connect()
    const unsub = iotStream.subscribe(null, st => {
      setStationLive(prev => ({ ...prev, [st.stationId]: st }))
    })
    marketFeed.start()
    const unsubMarket = marketFeed.subscribe(null, rec => {
      setPrices(prev => ({ ...prev, [rec.material]: { spot: rec.spot, label: rec.label } }))
    })
    return () => {
      stopCamera()
      unsub()
      unsubMarket()
    }
  }, [])

  function verifyCode(raw) {
    setError('')
    const sid = resolveStationId(raw)
    if (!sid) { setError(`Code not recognised. Valid formats: CZ-001-A through CZ-008-X`); return }
    const live = stationLive[sid] ?? iotStream.getState(sid)
    if (live?.status === 'offline') { setError(`Station ${STATION_REGISTRY[sid]?.name} is currently offline.`); return }
    setStationId(sid)
    setShowDeposit(true)
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    verifyCode(code)
  }

  function handleDepositComplete({ stationId: sid, material, weightKg, netAud }) {
    const cfg  = STATION_REGISTRY[sid]
    const when = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
    setRecentScans(prev => [
      { code, stationId: sid, name: cfg?.name ?? sid, date: when, payout: `$${netAud.toFixed(2)}` },
      ...prev.slice(0, 4),
    ])
  }

  const verified = stationId ? STATION_REGISTRY[stationId] : null

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Scan &amp; Deposit</h1>
        <p className="text-sm text-slate-500 mt-1">
          Scan a CirclLoop station QR code to begin your deposit and earn real-time commodity rates.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {[
          { id: 'camera', icon: QrCode,   label: 'Camera Scan' },
          { id: 'manual', icon: Keyboard, label: 'Enter Code'  },
        ].map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setError('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              mode === m.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <m.icon className="w-4 h-4" /> {m.label}
          </button>
        ))}
      </div>

      {mode === 'camera' ? (
        <div className="space-y-4">
          {/* Camera viewfinder */}
          <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-square max-w-sm mx-auto">
            {/* Corner markers — always visible */}
            {['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'].map((pos, i) => (
              <div key={i} className={`absolute ${pos} w-10 h-10 pointer-events-none`}>
                <div className={`absolute top-0 left-0 w-full h-1 bg-eco-400 ${i >= 2 ? 'top-auto bottom-0' : ''}`} />
                <div className={`absolute top-0 left-0 h-full w-1 bg-eco-400 ${i % 2 === 1 ? 'left-auto right-0' : ''}`} />
              </div>
            ))}

            {/* Video element — always in DOM so ref is stable */}
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover ${camState === 'active' ? 'opacity-100' : 'opacity-0'}`}
              playsInline
              muted
              autoPlay
            />

            {/* Scanning line animation when active */}
            {camState === 'active' && (
              <div
                className="absolute left-8 right-8 h-0.5 bg-eco-400/80 animate-bounce pointer-events-none"
                style={{ top: '50%' }}
              />
            )}

            {/* Overlay when not active */}
            {camState !== 'active' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                {camState === 'starting' && (
                  <>
                    <div className="w-10 h-10 border-2 border-eco-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-300 text-sm">Starting camera…</p>
                  </>
                )}
                {camState === 'idle' && (
                  <>
                    <QrCode className="w-12 h-12 text-slate-400" />
                    <p className="text-slate-300 text-sm font-medium">Tap to start camera</p>
                  </>
                )}
                {(camState === 'error' || camState === 'unsupported') && (
                  <>
                    <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <p className="text-red-300 text-xs text-center px-6">{camError}</p>
                  </>
                )}
              </div>
            )}

            {/* Tap-to-start overlay (when idle) */}
            {camState === 'idle' && (
              <button className="absolute inset-0 z-20" onClick={startCamera} aria-label="Start camera" />
            )}

            {/* Stop camera button (when active) */}
            {camState === 'active' && (
              <button
                onClick={stopCamera}
                className="absolute top-3 right-3 z-20 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </div>

          {/* Start button when idle */}
          {camState === 'idle' && (
            <button
              onClick={startCamera}
              className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              <QrCode className="w-5 h-5" /> Open Camera
            </button>
          )}

          {/* Error fallback suggestion */}
          {(camState === 'error' || camState === 'unsupported') && (
            <p className="text-center text-xs text-slate-400">
              <button onClick={() => setMode('manual')} className="text-eco-700 font-semibold hover:underline">
                Enter code manually →
              </button>
            </p>
          )}

          {/* Quick-scan demo buttons — only when camera not active */}
          {camState !== 'active' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Demo — tap to scan</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(STATION_REGISTRY).slice(0, 4).map(([sid, cfg]) => {
                  const live = stationLive[sid]
                  const fill = live?.fill_pct ?? null
                  const offline = live?.status === 'offline'
                  const qrCode = Object.entries(CODE_MAP).find(([, v]) => v === sid)?.[0]
                  return (
                    <button
                      key={sid}
                      onClick={() => { setCode(qrCode + '-A'); verifyCode(qrCode + '-A') }}
                      disabled={offline}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        offline ? 'border-slate-100 opacity-50 cursor-not-allowed' : 'border-slate-200 hover:border-eco-300 hover:bg-eco-50/30'
                      }`}
                    >
                      <div className="text-[10px] font-mono text-slate-400 mb-0.5">{qrCode}</div>
                      <div className="text-xs font-semibold text-slate-800 leading-tight">{cfg.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        {offline
                          ? <><WifiOff className="w-2.5 h-2.5 text-red-400" /> Offline</>
                          : fill !== null
                            ? <>{fill}% full</>
                            : 'Loading…'
                        }
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Station Code</label>
            <input
              type="text"
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
              placeholder="e.g. CZ-001-A"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500"
            />
            <p className="text-xs text-slate-400 mt-1.5">Find the code printed on the station label or your confirmation card.</p>
            {error && (
              <div className="mt-2 flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={code.trim().length < 4}
            className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Verify Station
          </button>
        </form>
      )}

      {/* Live station status (mini) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 text-sm mb-3 flex items-center gap-2">
          <Wifi className="w-4 h-4 text-eco-600" /> Live Station Status
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(STATION_REGISTRY).map(([sid, cfg]) => {
            const live = stationLive[sid]
            const fill = live?.fill_pct ?? null
            const offline = live?.status === 'offline'
            return (
              <div key={sid} className={`p-2 rounded-xl border text-center ${offline ? 'border-red-100 bg-red-50/30' : fill !== null && fill >= 75 ? 'border-amber-100 bg-amber-50/20' : 'border-slate-100'}`}>
                <div className="text-[10px] font-mono text-slate-400">{sid}</div>
                <div className={`text-xs font-bold mt-0.5 ${offline ? 'text-red-500' : fill !== null && fill >= 75 ? 'text-amber-600' : 'text-eco-600'}`}>
                  {offline ? 'Off' : fill !== null ? `${fill}%` : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent scans */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900 text-sm">Recent Scans</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {recentScans.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
              <div className="w-8 h-8 bg-eco-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-eco-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900">{r.name}</div>
                <div className="text-xs text-slate-400 font-mono">{r.code} · {r.date}</div>
              </div>
              <div className="text-sm font-bold text-eco-700 flex-shrink-0">{r.payout}</div>
            </div>
          ))}
          {recentScans.length === 0 && (
            <div className="px-5 py-6 text-center text-sm text-slate-400">No scans yet</div>
          )}
        </div>
      </div>

      {showDeposit && stationId && (
        <DepositModal
          stationId={stationId}
          stationLive={stationLive[stationId]}
          prices={prices}
          onClose={() => { setShowDeposit(false); setStationId(null); setCode('') }}
          onComplete={handleDepositComplete}
        />
      )}
    </div>
  )
}
