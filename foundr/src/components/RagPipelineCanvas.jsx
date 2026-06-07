import { useCallback, useEffect, useRef } from 'react'

const ORANGE = '#ff6b00'

function drawBG(ctx, W, H) {
  ctx.fillStyle = '#060608'
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.strokeStyle = 'rgba(255,107,0,0.028)'
  ctx.lineWidth = 0.5
  const g = 38
  for (let x = 0; x < W; x += g) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y < H; y += g) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.restore()
}

function projectKWLayout(W, H, n) {
  const spacing = n > 1 ? (H - 80) / (n - 1) : 0
  return (i) => ({
    x: Math.max(44, W * 0.06),
    y: 48 + i * spacing,
    floatT: Math.random() * Math.PI * 2,
  })
}

function kwPos(k, tick) {
  return { x: k.x, y: k.y + Math.sin(k.floatT + tick * 0.02) * 2.5 }
}

function drawCylinder(ctx, W, H, cylActive, cylT) {
  const cx = W * 0.46
  const cy = H / 2
  const CYLRX = Math.min(52, W * 0.07)
  const CYLRY = 18
  const CYLH = Math.min(160, H * 0.36)
  const top = cy - CYLH / 2
  const bot = cy + CYLH / 2
  const glow = cylActive ? 0.5 + Math.sin(cylT * 0.05) * 0.12 : 0.15
  ctx.save()
  ctx.shadowColor = ORANGE
  ctx.shadowBlur = cylActive ? 50 : 12
  ctx.strokeStyle = `rgba(255,107,0,${glow})`
  ctx.lineWidth = cylActive ? 1.4 : 0.7
  ctx.beginPath()
  ctx.ellipse(cx, top, CYLRX, CYLRY, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(cx, bot, CYLRX, CYLRY, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - CYLRX, top)
  ctx.lineTo(cx - CYLRX, bot)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx + CYLRX, top)
  ctx.lineTo(cx + CYLRX, bot)
  ctx.stroke()
  ctx.strokeStyle = `rgba(255,107,0,${glow * 0.35})`
  ctx.lineWidth = 0.4
  for (let i = 1; i < 7; i++) {
    ctx.beginPath()
    ctx.ellipse(cx, top + i * (CYLH / 7), CYLRX, CYLRY * 0.72, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  if (cylActive) {
    const sy = top + (cylT * 2.1) % (CYLH + 8)
    const clamped = Math.min(bot, Math.max(top, sy))
    ctx.shadowBlur = 25
    ctx.strokeStyle = 'rgba(255,180,80,0.7)'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.ellipse(cx, clamped, CYLRX, CYLRY * 0.78, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawKW(ctx, k, tick) {
  const p = kwPos(k, tick)
  const r = k.lit ? 11 : 8
  const col = k.critical
    ? k.lit
      ? 'rgba(255,55,55,0.18)'
      : 'rgba(60,0,0,0.5)'
    : k.lit
      ? 'rgba(255,107,0,0.15)'
      : 'rgba(15,35,25,0.5)'
  const sc = k.critical
    ? k.lit
      ? 'rgba(255,70,70,0.9)'
      : 'rgba(80,20,20,0.7)'
    : k.lit
      ? 'rgba(255,107,0,0.9)'
      : 'rgba(20,70,45,0.7)'
  ctx.save()
  if (k.lit) {
    ctx.shadowColor = k.critical ? '#ff3333' : ORANGE
    ctx.shadowBlur = 20 + Math.sin(k.litT * 0.07) * 6
  }
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fillStyle = col
  ctx.fill()
  ctx.strokeStyle = sc
  ctx.lineWidth = k.lit ? 1.2 : 0.5
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(p.x - r * 0.3, p.y - r * 0.35, r * 0.27, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.fill()
  ctx.font = "9.5px 'JetBrains Mono', 'Courier New', monospace"
  ctx.textAlign = 'left'
  ctx.fillStyle = k.lit
    ? k.critical
      ? 'rgba(255,110,110,0.95)'
      : 'rgba(255,145,60,0.95)'
    : 'rgba(55,75,65,0.8)'
  ctx.fillText(k.label, p.x + r + 7, p.y + 3.5)
  ctx.restore()
}

function drawBeam(ctx, b, kws, tick) {
  const k = kws[b.ki]
  if (!k) return
  const p = kwPos(k, tick)
  const W = b.W
  const H = b.H
  const cx = W * 0.46
  const cy = H / 2
  const CYLRX = Math.min(52, W * 0.07)
  const targetX = cx - CYLRX
  const targetY = cy + (p.y - cy) * 0.18
  const prog = Math.min(1, (tick - b.startT) / 70)
  if (prog <= 0) return
  const ex = p.x + (targetX - p.x) * prog
  const ey = p.y + (targetY - p.y) * prog
  ctx.save()
  ctx.strokeStyle = b.critical
    ? `rgba(255,60,60,${0.55 * prog})`
    : `rgba(255,107,0,${0.5 * prog})`
  ctx.lineWidth = 0.9
  ctx.setLineDash([4, 6])
  ctx.beginPath()
  ctx.moveTo(p.x + 12, p.y)
  ctx.lineTo(ex, ey)
  ctx.stroke()
  ctx.setLineDash([])
  if (prog > 0.1) {
    ctx.beginPath()
    ctx.arc(ex, ey, 2.2, 0, Math.PI * 2)
    ctx.fillStyle = b.critical ? `rgba(255,80,80,${prog})` : `rgba(255,140,60,${prog})`
    ctx.fill()
  }
  ctx.restore()
}

function drawRay(ctx, r, tick) {
  const W = r.W
  const H = r.H
  const cx = W * 0.46
  const cy = H / 2
  const CYLRX = Math.min(52, W * 0.07)
  const rightX = W - 240
  const prog = Math.min(1, (tick - r.startT) / 50)
  if (prog <= 0) return
  const startX = cx + CYLRX
  const endX = rightX - 10
  const ex = startX + (endX - startX) * prog
  const ey = r.y
  const startY = cy + (typeof r.ri === 'number' ? (r.ri - 2) * 6 : 0)
  ctx.save()
  ctx.shadowColor = r.critical ? '#ff3333' : '#ff8c00'
  ctx.shadowBlur = r.critical ? 14 : 9
  ctx.strokeStyle = r.critical ? 'rgba(255,70,70,0.7)' : 'rgba(255,140,50,0.6)'
  ctx.lineWidth = r.critical ? 1.3 : 0.9
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(ex, ey)
  ctx.stroke()
  if (prog > 0.9) {
    ctx.beginPath()
    ctx.arc(ex + 3, ey, 2, 0, Math.PI * 2)
    ctx.fillStyle = r.critical ? '#ff5555' : '#ff8c00'
    ctx.fill()
  }
  ctx.restore()
}

function drawParticles(ctx, particles) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy
    p.life--
    if (p.life <= 0) {
      particles.splice(i, 1)
      continue
    }
    ctx.save()
    ctx.globalAlpha = (p.life / p.maxLife) * 0.7
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fillStyle = ORANGE
    ctx.fill()
    ctx.restore()
  }
}

function burst(particles, x, y) {
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2
    const s = Math.random() * 2 + 0.5
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: Math.random() * 2 + 0.5,
      life: 28,
      maxLife: 28,
    })
  }
}

/**
 * Full-viewport RAG pipeline visualization (ported behavior from reference HTML).
 */
export default function RagPipelineCanvas({
  width,
  height,
  keywords,
  results,
  cylinderOn,
  runEpoch,
  onRevealResults,
}) {
  const canvasRef = useRef(null)
  const tickRef = useRef(0)
  const cylTRef = useRef(0)
  const kwsRef = useRef([])
  const beamsRef = useRef([])
  const raysRef = useRef([])
  const particlesRef = useRef([])
  const rafRef = useRef(0)
  const firedRef = useRef({ epoch: -1, raySig: '', kw: false })
  const onRevealRef = useRef(onRevealResults)

  useEffect(() => {
    onRevealRef.current = onRevealResults
  }, [onRevealResults])

  const buildKws = useCallback((kw, W, H) => {
    const n = kw.length
    const layout = projectKWLayout(W, H, Math.max(n, 1))
    return kw.map((k, i) => {
      const pos = layout(i)
      return {
        ...k,
        x: pos.x,
        y: pos.y,
        floatT: pos.floatT,
        lit: false,
        litT: 0,
      }
    })
  }, [])

  /* keyword + beam sequence */
  useEffect(() => {
    if (!width || !height) return
    if (!keywords?.length) {
      kwsRef.current = []
      beamsRef.current = []
      raysRef.current = []
      firedRef.current = { epoch: runEpoch, raySig: '', kw: false }
      return
    }
    const epoch = runEpoch
    const W = width
    const H = height
    kwsRef.current = buildKws(keywords, W, H)
    beamsRef.current = []
    raysRef.current = []
    particlesRef.current = []
    firedRef.current = { epoch, raySig: '', kw: false }

    const timers = []
    keywords.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          if (firedRef.current.epoch !== epoch) return
          const k = kwsRef.current[i]
          if (!k) return
          k.lit = true
          const p = kwPos(k, tickRef.current)
          burst(particlesRef.current, p.x, p.y)
          beamsRef.current.push({
            ki: i,
            startT: tickRef.current,
            critical: !!keywords[i]?.critical,
            W,
            H,
          })
        }, 300 + i * 420),
      )
    })

    return () => timers.forEach(clearTimeout)
  }, [keywords, width, height, runEpoch, buildKws])

  /* rays when results land — one ray per output row; Y aligned to right-hand band */
  useEffect(() => {
    if (!width || !height || !results?.length) return
    const epoch = runEpoch
    const sig = `${epoch}|${results.length}|${results.map((x) => x.title).join('\u001f')}`
    if (firedRef.current.raySig === sig) return
    firedRef.current.raySig = sig

    raysRef.current = []
    const H = height
    const n = results.length
    const bandTop = H * 0.14
    const bandBot = H * 0.86
    const yForIndex = (i) =>
      n <= 1 ? (bandTop + bandBot) / 2 : bandTop + (i / (n - 1)) * (bandBot - bandTop)

    const timers = []
    results.forEach((r, i) => {
      const ry = yForIndex(i)
      timers.push(
        setTimeout(() => {
          if (firedRef.current.epoch !== epoch || firedRef.current.raySig !== sig) return
          raysRef.current.push({
            y: ry,
            ri: i,
            startT: tickRef.current,
            critical: !!r.critical,
            W: width,
            H: height,
          })
        }, i * 220),
      )
    })
    timers.push(
      setTimeout(() => {
        if (firedRef.current.epoch !== epoch || firedRef.current.raySig !== sig) return
        onRevealRef.current?.()
      }, results.length * 220 + 700),
    )
    return () => {
      timers.forEach(clearTimeout)
      if (firedRef.current.raySig === sig) firedRef.current.raySig = ''
    }
  }, [results, width, height, runEpoch])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width < 8 || height < 8) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const loop = () => {
      tickRef.current++
      if (cylinderOn) cylTRef.current++

      kwsRef.current.forEach((k) => {
        if (k.lit) k.litT++
      })

      const W = width
      const H = height
      drawBG(ctx, W, H)
      drawParticles(ctx, particlesRef.current)
      beamsRef.current.forEach((b) => {
        b.W = W
        b.H = H
        drawBeam(ctx, b, kwsRef.current, tickRef.current)
      })
      raysRef.current.forEach((r) => {
        r.W = W
        r.H = H
        drawRay(ctx, r, tickRef.current)
      })
      drawCylinder(ctx, W, H, cylinderOn, cylTRef.current)
      kwsRef.current.forEach((k) => drawKW(ctx, k, tickRef.current))

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [width, height, cylinderOn])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 block h-full w-full"
      aria-hidden
    />
  )
}
