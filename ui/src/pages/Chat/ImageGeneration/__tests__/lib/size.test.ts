import { describe, expect, it } from 'vitest'
import {
  calculateImageSize,
  getClosestImageSizeOption,
  normalizeImageDimensionsToSize,
} from '@/pages/Chat/ImageGeneration/lib/size'

describe('calculateImageSize', () => {
  it('uses common 16:9 display resolutions for the built-in tiers', () => {
    expect(calculateImageSize('1K', '16:9')).toBe('1280x720')
    expect(calculateImageSize('2K', '16:9')).toBe('2560x1440')
    expect(calculateImageSize('4K', '16:9')).toBe('3840x2160')
  })

  it('uses matching portrait presets for common ratios', () => {
    expect(calculateImageSize('2K', '9:16')).toBe('1440x2560')
    expect(calculateImageSize('2K', '2:3')).toBe('1440x2160')
    expect(calculateImageSize('2K', '3:4')).toBe('1536x2048')
  })

  it('falls back to budget-based sizing for custom ratios', () => {
    expect(calculateImageSize('2K', '5:4')).toBe('2288x1824')
  })

  it('normalizes uploaded reference image dimensions to legal sizes', () => {
    expect(normalizeImageDimensionsToSize(100, 100)).toBe('816x816')
    expect(normalizeImageDimensionsToSize(4000, 1000)).toBe('2880x960')
  })

  it('chooses the closest legal fixed model size for reference images', () => {
    const options = [
      { label: '方图', value: '1024x1024', aspect_ratio: '1:1', tier: '1K' },
      { label: '横屏', value: '1536x1024', aspect_ratio: '3:2', tier: '1K' },
      { label: '横屏 2K', value: '2160x1440', aspect_ratio: '3:2', tier: '2K' },
      { label: '竖屏', value: '1024x1536', aspect_ratio: '2:3', tier: '1K' },
    ]

    expect(getClosestImageSizeOption('1400x920', options)?.value).toBe(
      '1536x1024',
    )
    expect(getClosestImageSizeOption('2400x1600', options)?.value).toBe(
      '2160x1440',
    )
  })
})
