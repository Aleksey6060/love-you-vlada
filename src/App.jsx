import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import initFluid from './lib/fluidSim.js'

function App() {
  const [started, setStarted] = useState(false)
  const [visibleCount, setVisibleCount] = useState(0)
  const canvasRef = useRef(null)
  const [viewport, setViewport] = useState(() => ({
    w: window.visualViewport?.width ? Math.round(window.visualViewport.width) : window.innerWidth,
    h: window.visualViewport?.height ? Math.round(window.visualViewport.height) : window.innerHeight,
  }))

  const points = useMemo(() => {
    const count = 48
    const raw = Array.from({ length: count }, (_, i) => {
      const t = (Math.PI * 2 * i) / count
      const x = 16 * Math.pow(Math.sin(t), 3)
      const y =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)
      const seed = (Math.sin((i + 1) * 999.123) + 1) / 2
      return { x, y, seed }
    })

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    for (const p of raw) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }

    const w = Math.max(1, viewport.w)
    const h = Math.max(1, viewport.h)

    const heartW = maxX - minX || 1
    const heartH = maxY - minY || 1
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    const isPortrait = h > w
    const marginX = w * (isPortrait ? 0.1 : 0.08)
    const marginY = h * (isPortrait ? 0.18 : 0.1)
    const availW = Math.max(1, w - marginX * 2)
    const availH = Math.max(1, h - marginY * 2)
    const sizeBoost = isPortrait ? 0.82 : 0.98
    const zoomLike = isPortrait ? 1.03 : 0.91

    const scale = Math.min(availW / heartW, availH / heartH) * sizeBoost * zoomLike

    return raw.map(({ x, y, seed }) => {
      const dx = (x - cx) * scale
      const dy = -(y - cy) * scale
      return { left: w / 2 + dx, top: h / 2 + dy, seed }
    })
  }, [viewport.h, viewport.w])

  useEffect(() => {
    let rafId = 0
    const getSize = () => {
      const vv = window.visualViewport
      const w = vv?.width ? Math.round(vv.width) : window.innerWidth
      const h = vv?.height ? Math.round(vv.height) : window.innerHeight
      return { w, h }
    }
    const onResize = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        setViewport(getSize())
      })
    }
    window.addEventListener('resize', onResize, { passive: true })
    window.visualViewport?.addEventListener('resize', onResize, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [])

  useEffect(() => {
    const startDelayMs = 900
    const stepDelayMs = 120

    const startTimerId = window.setTimeout(() => {
      setStarted(true)
      setVisibleCount(1)
    }, startDelayMs)

    let intervalId = null
    const intervalStartId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        setVisibleCount((c) => {
          const next = Math.min(c + 1, points.length)
          if (next >= points.length && intervalId) {
            window.clearInterval(intervalId)
            intervalId = null
          }
          return next
        })
      }, stepDelayMs)
    }, startDelayMs)

    return () => {
      window.clearTimeout(startTimerId)
      window.clearTimeout(intervalStartId)
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [points.length])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let api = null
    let rafId = 0

    const canStart = () => {
      const rect = canvas.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && document.visibilityState === 'visible'
    }

    const start = () => {
      if (!canStart()) {
        rafId = window.requestAnimationFrame(start)
        return
      }

      try {
        api?.dispose?.()
        api = initFluid(canvas, {
          TRANSPARENT: false,
          BACK_COLOR: { r: 0, g: 0, b: 0 },
          BLOOM: true,
          BLOOM_INTENSITY: 0.28,
          BLOOM_THRESHOLD: 0.72,
          BLOOM_SOFT_KNEE: 0.55,
          BLOOM_RESOLUTION: 128,
          SUNRAYS: false,
          SPLAT_FORCE: 2600,
          SPLAT_RADIUS: 0.28,
          DENSITY_DISSIPATION: 0.997,
          VELOCITY_DISSIPATION: 0.28,
          PRESSURE: 0.35,
          PRESSURE_ITERATIONS: 10,
          CURL: 4,
          COLORFUL: false,
        })
      } catch {
        api = null
      }
    }

    rafId = window.requestAnimationFrame(start)

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      api?.dispose?.()
    }
  }, [])

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="fixed inset-0 h-[100svh] w-[100svw]"
        style={{ pointerEvents: 'none', opacity: 1, zIndex: 0, display: 'block' }}
      />

      <div className="relative z-10 h-[100svh] w-[100svw]">
          <AnimatePresence>
            {started
              ? points.slice(0, visibleCount).map((p, i) => {
                  const floatDelay = 0.55 + p.seed * 0.35
                  const floatDuration = 3.9 + p.seed * 2.3
                  const shimmerDuration = 1.9 + p.seed * 1.5
                  const yAmp = 9 + p.seed * 11
                  const rotAmp = 0.35 + p.seed * 0.85
                  const xAmp = (p.seed - 0.5) * 10
                  const rebirthEnabled = visibleCount >= points.length
                  const rebirthDuration = (6.8 + p.seed * 2.8) * 0.8
                  const rebirthDelay = (i / points.length) * rebirthDuration

                  return (
                    <span
                      key={i}
                      className="absolute select-none whitespace-nowrap"
                      style={{
                        left: `${p.left}px`,
                        top: `${p.top}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <motion.span
                        className="inline-block"
                        initial={{
                          opacity: 0,
                          scale: 0.98,
                          y: 12,
                          filter: 'blur(18px) saturate(0.65)',
                        }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                          y: 0,
                          filter: 'blur(0px) saturate(1)',
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                          opacity: { duration: 1.35, ease: [0.16, 1, 0.3, 1] },
                          scale: { duration: 1.35, ease: [0.16, 1, 0.3, 1] },
                          y: { duration: 1.35, ease: [0.16, 1, 0.3, 1] },
                          filter: { duration: 1.35, ease: [0.16, 1, 0.3, 1] },
                        }}
                      >
                        <motion.span
                          className="neon-text inline-block text-[clamp(11px,3.2vw,22px)] sm:text-[clamp(14px,2.6vw,34px)]"
                          initial={{ backgroundPosition: '0% 50%' }}
                          animate={{
                            opacity: rebirthEnabled
                              ? [1, 1, 0.5, 1, 1]
                              : [0.92, 1, 0.92],
                            filter: rebirthEnabled
                              ? [
                                  'blur(0px)',
                                  'blur(0px)',
                                  'blur(9px)',
                                  'blur(0px)',
                                  'blur(0px)',
                                ]
                              : 'blur(0px)',
                            y: [0, -yAmp, 0],
                            x: [0, xAmp, 0],
                            rotate: [-rotAmp, rotAmp, -rotAmp],
                            scale: rebirthEnabled
                              ? [1, 1, 0.997, 1, 1]
                              : [1, 1.02, 1],
                            backgroundPosition: ['0% 50%', '100% 50%'],
                          }}
                          transition={{
                            opacity: rebirthEnabled
                              ? {
                                  duration: rebirthDuration,
                                  times: [0, 0.36, 0.5, 0.64, 1],
                                  ease: 'easeInOut',
                                  repeat: Infinity,
                                  delay: rebirthDelay,
                                }
                              : {
                                  duration: 3.8,
                                  ease: 'easeInOut',
                                  repeat: Infinity,
                                },
                            filter: rebirthEnabled
                              ? {
                                  duration: rebirthDuration,
                                  times: [0, 0.36, 0.5, 0.64, 1],
                                  ease: 'easeInOut',
                                  repeat: Infinity,
                                  delay: rebirthDelay,
                                }
                              : undefined,
                            y: {
                              delay: floatDelay,
                              duration: floatDuration,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            },
                            x: {
                              delay: floatDelay,
                              duration: floatDuration,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            },
                            rotate: {
                              delay: floatDelay,
                              duration: floatDuration,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            },
                            scale: {
                              delay: floatDelay,
                              duration: floatDuration,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            },
                            backgroundPosition: {
                              delay: floatDelay,
                              duration: shimmerDuration,
                              repeat: Infinity,
                              ease: 'linear',
                            },
                          }}
                        >
                          Love you
                        </motion.span>
                      </motion.span>
                    </span>
                  )
                })
              : null}
          </AnimatePresence>
      </div>
    </div>
  )
}

export default App
