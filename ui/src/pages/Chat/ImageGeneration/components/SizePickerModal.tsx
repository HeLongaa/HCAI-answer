import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { calculateImageSize, normalizeImageSize, parseRatio, type SizeTier } from '../lib/size'
import ViewportTooltip from './ViewportTooltip'

const TIERS: SizeTier[] = ['1K', '2K', '4K']
const SIZE_LIMIT_TEXT = '由于模型限制，最终输出会自动规整到合法尺寸：\n宽高均为 16 的倍数，最大边长 3840px，宽高比不超过 3:1，总像素限制为 655360-8294400。'
const RATIOS = [
  { label: '1:1', value: '1:1' },
  { label: '3:2', value: '3:2' },
  { label: '2:3', value: '2:3' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '21:9', value: '21:9' },
]

interface Props {
  currentSize: string
  onSelect: (size: string) => void
  onClose: () => void
  allowAuto?: boolean
}

type Mode = 'auto' | 'ratio' | 'resolution'

function parseSize(size: string) {
  const match = size.match(/^\s*(\d+)\s*[xX×]\s*(\d+)\s*$/)
  if (!match) return null
  return { width: match[1], height: match[2] }
}

function findPresetForSize(size: string) {
  const normalized = normalizeImageSize(size)
  for (const tier of TIERS) {
    for (const ratio of RATIOS) {
      if (calculateImageSize(tier, ratio.value) === normalized) {
        return { tier, ratio: ratio.value }
      }
    }
  }
  return null
}

export default function SizePickerModal({ currentSize, onSelect, onClose, allowAuto = true }: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const ratioSectionRef = useRef<HTMLElement>(null)
  const customRatioFieldRef = useRef<HTMLLabelElement>(null)
  const currentPreset = findPresetForSize(currentSize)
  const currentParsedSize = parseSize(currentSize)
  const [mode, setMode] = useState<Mode>(() => {
    if (!currentSize || currentSize === 'auto') return allowAuto ? 'auto' : 'ratio'
    if (currentPreset) return 'ratio'
    return 'resolution'
  })

  // Ratio mode state
  const [tier, setTier] = useState<SizeTier>(currentPreset?.tier ?? '1K')
  const [ratio, setRatio] = useState(currentPreset?.ratio ?? (allowAuto ? '1:1' : '4:3'))
  const [customRatio, setCustomRatio] = useState('16:9')

  // Resolution mode state
  const [customW, setCustomW] = useState(currentParsedSize?.width ?? '1024')
  const [customH, setCustomH] = useState(currentParsedSize?.height ?? '1024')

  const [hintVisible, setHintVisible] = useState(false)
  const hintTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (hintTimerRef.current != null) window.clearTimeout(hintTimerRef.current)
  }, [])

  useEffect(() => {
    if (mode !== 'ratio' || ratio !== 'custom') return

    const frame = window.requestAnimationFrame(() => {
      scrollContentTo(customRatioFieldRef.current)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [mode, ratio])

  const activeRatio = ratio === 'custom' ? customRatio : ratio
  const parsedCustomRatio = parseRatio(customRatio)
  const customRatioValid = ratio !== 'custom' || Boolean(parsedCustomRatio)
  const customRatioClamped = Boolean(
    ratio === 'custom' &&
    parsedCustomRatio &&
    Math.max(parsedCustomRatio.width, parsedCustomRatio.height) / Math.min(parsedCustomRatio.width, parsedCustomRatio.height) > 3,
  )

  const previewSize = useMemo(() => {
    if (mode === 'auto') return 'auto'
    
    if (mode === 'ratio') {
      const size = calculateImageSize(tier, activeRatio)
      return size ? normalizeImageSize(size) : ''
    }
    
    if (mode === 'resolution') {
      const w = parseInt(customW, 10)
      const h = parseInt(customH, 10)
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        return normalizeImageSize(`${w}x${h}`)
      }
      return ''
    }
    
    return ''
  }, [mode, tier, activeRatio, customW, customH])

  const isClamped = useMemo(() => {
    if (!previewSize || previewSize === 'auto') return false
    if (mode === 'ratio' && ratio === 'custom') return customRatioClamped
    if (mode === 'resolution') {
      const w = parseInt(customW, 10)
      const h = parseInt(customH, 10)
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        return `${w}x${h}` !== previewSize
      }
    }
    return false
  }, [mode, ratio, customRatioClamped, customW, customH, previewSize])

  const showHint = () => setHintVisible(true)
  const hideHint = () => {
    setHintVisible(false)
    clearHintTimer()
  }
  const clearHintTimer = () => {
    if (hintTimerRef.current != null) {
      window.clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
  }
  const startHintTouch = () => {
    hintTimerRef.current = window.setTimeout(() => {
      setHintVisible(true)
      hintTimerRef.current = null
    }, 450)
  }

  const applySize = () => {
    if (!previewSize) return
    onSelect(previewSize)
    onClose()
  }

  const scrollContentTo = (target: HTMLElement | null) => {
    const content = contentRef.current
    if (!content || !target) return
    const targetTop = target.offsetTop - content.offsetTop - 12
    content.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: 'smooth',
    })
  }

  const selectPresetRatio = (value: string) => {
    setRatio(value)
    window.requestAnimationFrame(() => scrollContentTo(ratioSectionRef.current))
  }

  const selectCustomRatio = () => {
    setRatio('custom')
  }

  const tabClass = (active: boolean) => `hcai-size-picker-tab ${active ? 'is-active' : ''}`
  const buttonClass = (active: boolean) => `hcai-size-picker-choice px-3 py-2 transition ${active ? 'is-active' : ''}`

  return (
    <Modal
      show
      onHide={onClose}
      centered
      dialogClassName="hcai-size-picker-modal hcai-subscription-dialog"
      contentClassName="hcai-size-picker-panel"
    >
      <Modal.Body className="hcai-size-picker-body">
          <button
            onClick={onClose}
            className="hcai-subscription-close"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="hcai-subscription-head">
            <h2>设置图像尺寸</h2>
            <p>当前：{currentSize || 'auto'}</p>
          </div>

          <div>
            <div className="hcai-size-picker-tabs">
              {allowAuto && (
                <button
                  onClick={() => setMode('auto')}
                  className={tabClass(mode === 'auto')}
                >
                  自动
                </button>
              )}
              <button
                onClick={() => setMode('ratio')}
                className={tabClass(mode === 'ratio')}
              >
                按比例
              </button>
              <button
                onClick={() => setMode('resolution')}
                className={tabClass(mode === 'resolution')}
              >
                自定义宽高
              </button>
            </div>

            <div ref={contentRef} className="hcai-size-picker-content pr-1 -mr-1">
              {mode === 'auto' && (
                <div className="flex h-full animate-fade-in items-center justify-center pt-8 pb-4 text-center">
                  <div>
                    <div className="hcai-size-picker-auto-icon mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full">
                      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h4 className="hcai-size-picker-empty-title text-sm">自动尺寸</h4>
                    <p className="hcai-size-picker-empty-copy mt-2 leading-relaxed">
                      不向模型传递具体的分辨率参数
                      <br />
                      由模型自己决定生成尺寸
                    </p>
                  </div>
                </div>
              )}

              {mode === 'ratio' && (
                <div className="space-y-5 animate-fade-in">
                  <section ref={ratioSectionRef}>
                    <div className="hcai-size-picker-section-title mb-2">基准分辨率</div>
                    <div className="grid grid-cols-3 gap-2">
                      {TIERS.map((item) => (
                        <button
                          key={item}
                          className={`${buttonClass(tier === item)} relative overflow-hidden`}
                          onClick={() => setTier(item)}
                        >
                          <span>{item}</span>
                          {item !== '1K' && (
                            <span className="hcai-size-picker-beta-badge">
                              BETA
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="hcai-size-picker-section-title mb-2">图像比例</div>
                    <div className="grid grid-cols-4 gap-2">
                      {RATIOS.map((item) => {
                        const [w, h] = item.value.split(':').map(Number)
                        const isHorizontal = w > h
                        const isSquare = w === h
                        return (
                          <button
                            key={item.value}
                            className={`${buttonClass(ratio === item.value)} flex flex-col items-center justify-center gap-1.5 !py-2.5`}
                            onClick={() => selectPresetRatio(item.value)}
                          >
                            <div className="flex h-5 w-5 items-center justify-center">
                              <div
                                className="border-[1.5px] border-current rounded-[3px] opacity-60"
                                style={{
                                  width: isHorizontal || isSquare ? '100%' : `${(w / h) * 100}%`,
                                  height: !isHorizontal || isSquare ? '100%' : `${(h / w) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs">{item.label}</span>
                          </button>
                        )
                      })}
                      <button className={`${buttonClass(ratio === 'custom')} col-span-4`} onClick={selectCustomRatio}>
                        自定义比例
                      </button>
                    </div>
                  </section>

                  {ratio === 'custom' && (
                    <label ref={customRatioFieldRef} className="block animate-fade-in scroll-mt-3">
                      <span className="hcai-size-picker-field-label mb-2 block">输入自定义比例</span>
                      <input
                        value={customRatio}
                        onChange={(e) => setCustomRatio(e.target.value)}
                        placeholder="例如 5:4 / 2.39:1"
                        className={`hcai-size-picker-input ${customRatioValid ? '' : 'is-invalid'}`}
                      />
                    </label>
                  )}
                </div>
              )}

              {mode === 'resolution' && (
                <div className="space-y-5 animate-fade-in">
                  <section>
                    <div className="hcai-size-picker-section-title mb-4">输入具体像素值</div>
                    <div className="flex items-center gap-4">
                      <label className="flex-1">
                        <span className="hcai-size-picker-field-label mb-1.5 block">宽度 (Width)</span>
                        <input
                          type="number"
                          value={customW}
                          onChange={(e) => setCustomW(e.target.value)}
                          className="hcai-size-picker-input"
                          placeholder="例如 1024"
                        />
                      </label>
                      <div className="mt-5 text-gray-300 dark:text-gray-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <label className="flex-1">
                        <span className="hcai-size-picker-field-label mb-1.5 block">高度 (Height)</span>
                        <input
                          type="number"
                          value={customH}
                          onChange={(e) => setCustomH(e.target.value)}
                          className="hcai-size-picker-input"
                          placeholder="例如 1024"
                        />
                      </label>
                    </div>
                  </section>
                  <div className="hcai-size-picker-note text-xs">
                    <div className="flex items-start gap-2">
                      <svg className="mt-[2px] h-4 w-4 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="whitespace-pre-line leading-relaxed">{SIZE_LIMIT_TEXT}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="hcai-size-picker-preview">
              <div className="hcai-size-picker-preview-label">将使用</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="hcai-size-picker-preview-value font-mono text-lg">
                  {previewSize || '尺寸无效'}
                </span>
                {isClamped && (
                  <div
                    className="relative flex items-center"
                    onMouseEnter={showHint}
                    onMouseLeave={hideHint}
                    onTouchStart={startHintTouch}
                    onTouchEnd={clearHintTimer}
                    onTouchCancel={hideHint}
                    onClick={showHint}
                  >
                    <svg className="w-5 h-5 text-yellow-500 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <ViewportTooltip visible={hintVisible} className="w-56 whitespace-pre-line text-center">
                      {SIZE_LIMIT_TEXT}
                    </ViewportTooltip>
                  </div>
                )}
              </div>
            </div>

            <div className="hcai-size-picker-actions flex">
              <button
                onClick={onClose}
                className="hcai-size-picker-cancel flex-1 px-4 py-2.5 transition"
              >
                取消
              </button>
              <button
                onClick={applySize}
                disabled={!previewSize}
                className="hcai-subscription-buy hcai-size-picker-confirm flex-1 px-4 py-2.5 transition"
              >
                确定
              </button>
            </div>
          </div>
      </Modal.Body>
    </Modal>
  )
}
