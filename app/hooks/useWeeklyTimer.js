'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { AGENDA } from '../lib/constants'

/**
 * useWeeklyTimer — encapsula toda la logica del timer de la weekly:
 * running, elapsed, blockTimes, currentBlockIdx, advanceBlock, jumpToBlock,
 * startTimer, pauseTimer, finishTimer
 */
export function useWeeklyTimer() {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [finished, setFinished] = useState(false)
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0)
  const [blockTimes, setBlockTimes] = useState({})

  const blockStartRef = useRef(null)
  const intRef = useRef(null)
  const startRef = useRef(null)
  const elRef = useRef(0)
  const currentBlockIdxRef = useRef(currentBlockIdx)

  useEffect(() => { currentBlockIdxRef.current = currentBlockIdx }, [currentBlockIdx])

  const block = AGENDA[currentBlockIdx] || AGENDA[AGENDA.length - 1]

  const advanceBlock = useCallback((direction) => {
    setCurrentBlockIdx((prev) => {
      const next = direction === "next" ? Math.min(prev + 1, AGENDA.length - 1) : Math.max(prev - 1, 0)
      if (next === prev) return prev
      if (blockStartRef.current) {
        const spent = Math.round((Date.now() - blockStartRef.current) / 1000)
        setBlockTimes((bt) => ({ ...bt, [AGENDA[prev].id]: (bt[AGENDA[prev].id] || 0) + spent }))
      }
      blockStartRef.current = Date.now()
      return next
    })
  }, [])

  const jumpToBlock = useCallback((idx) => {
    if (idx < 0 || idx >= AGENDA.length) return
    if (blockStartRef.current) {
      const prevIdx = currentBlockIdxRef.current
      const spent = Math.round((Date.now() - blockStartRef.current) / 1000)
      setBlockTimes((bt) => ({ ...bt, [AGENDA[prevIdx].id]: (bt[AGENDA[prevIdx].id] || 0) + spent }))
    }
    blockStartRef.current = Date.now()
    setCurrentBlockIdx(idx)
  }, [])

  const startTimer = useCallback(() => {
    startRef.current = Date.now()
    elRef.current = elapsed
    if (!blockStartRef.current) blockStartRef.current = Date.now()
    setRunning(true)
  }, [elapsed])

  const resumeTimer = useCallback(() => {
    startRef.current = Date.now()
    elRef.current = elapsed
    if (!blockStartRef.current) blockStartRef.current = Date.now()
    setRunning(true)
  }, [elapsed])

  const pauseTimer = useCallback(() => {
    setRunning(false)
    clearInterval(intRef.current)
    if (blockStartRef.current) {
      const spent = Math.round((Date.now() - blockStartRef.current) / 1000)
      setBlockTimes((bt) => ({ ...bt, [block.id]: (bt[block.id] || 0) + spent }))
      blockStartRef.current = null
    }
  }, [block])

  const finishTimer = useCallback(() => {
    setRunning(false)
    clearInterval(intRef.current)
    if (blockStartRef.current) {
      const spent = Math.round((Date.now() - blockStartRef.current) / 1000)
      setBlockTimes((bt) => ({ ...bt, [block.id]: (bt[block.id] || 0) + spent }))
      blockStartRef.current = null
    }
    setFinished(true)
  }, [block])

  // Tick interval
  useEffect(() => {
    if (running) {
      if (!blockStartRef.current) blockStartRef.current = Date.now()
      intRef.current = setInterval(() => {
        const newElapsed = elRef.current + Math.floor((Date.now() - startRef.current) / 1000)
        setElapsed(newElapsed)
      }, 1000)
    }
    return () => clearInterval(intRef.current)
  }, [running])

  // Keyboard shortcuts
  useEffect(() => {
    if (!running) return
    const handleKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return
      if (e.key === "ArrowRight") { e.preventDefault(); advanceBlock("next") }
      else if (e.key === "ArrowLeft") { e.preventDefault(); advanceBlock("prev") }
      else if (e.key === " ") { e.preventDefault(); pauseTimer() }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [running, advanceBlock, pauseTimer])

  // Reset helper (for session reset)
  const resetTimer = useCallback(() => {
    setFinished(false)
    setElapsed(0)
    elRef.current = 0
    setCurrentBlockIdx(0)
    setBlockTimes({})
    blockStartRef.current = null
    setRunning(false)
    clearInterval(intRef.current)
  }, [])

  return {
    running, elapsed, finished, setFinished,
    currentBlockIdx, setCurrentBlockIdx,
    blockTimes, block,
    advanceBlock, jumpToBlock,
    startTimer, resumeTimer, pauseTimer, finishTimer, resetTimer,
    // Expose refs for Dashboard to use
    blockStartRef, startRef, elRef,
  }
}
