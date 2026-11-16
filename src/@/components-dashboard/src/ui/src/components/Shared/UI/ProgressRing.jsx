import React from 'react'
import { useTheme } from 'styled-components'
import { ProgressRingRoot, progressRingStyle } from './progress-ring-styles'

export const ProgressRing = (props) => {
  const {
    percent,
    size,
    lineWidth,
    progressColor,
    trackColor,
    caps,
    isShowPercent,
    spin,
    transitionDuration,
    percentColor,
    fontSize,
    style,
    role,
    'aria-hidden': ariaHidden,
    'aria-label': ariaLabel,
    ...rootProps
  } = props
  const theme = useTheme()

  const halfSize = size / 2
  const radius = halfSize - lineWidth / 2
  const circleLength = radius * 2 * Math.PI
  const accessibleLabel = ariaLabel ?? (isShowPercent ? `${Math.round(percent)}%` : undefined)
  const isDecorative = accessibleLabel == null && ariaHidden == null && role == null

  return (
    <ProgressRingRoot
      {...rootProps}
      role={role ?? (isDecorative ? undefined : 'img')}
      aria-hidden={ariaHidden ?? (isDecorative ? 'true' : undefined)}
      aria-label={accessibleLabel}
      style={{
        ...style,
        ...progressRingStyle(theme, { percentColor, fontSize }),
        width: size,
        height: size
      }}
    >
      <svg
        height={size}
        width={size}
        data-spin={spin ? 'true' : undefined}
        aria-hidden='true'
        focusable='false'
        shapeRendering='geometricPrecision'
      >
        <g
          style={{
            transformOrigin: `${halfSize}px ${halfSize}px`,
            transform: 'rotate(-90deg)'
          }}
        >
          <circle
            cx={halfSize}
            cy={halfSize}
            r={radius}
            stroke={trackColor}
            strokeWidth={lineWidth}
            fill='none'
          />
          <circle
            cx={halfSize}
            cy={halfSize}
            r={radius}
            className='od-progress-ring-progress'
            style={{
              transition:
                transitionDuration > 0
                  ? `${transitionDuration}ms stroke-dashoffset`
                  : undefined,
              strokeDashoffset: circleLength * (1 - percent / 100)
            }}
            fill='none'
            strokeDasharray={circleLength}
            strokeWidth={lineWidth}
            stroke={progressColor}
            strokeLinecap={caps}
          />
        </g>
      </svg>
      {isShowPercent && (
        <div
          className='od-progress-ring-label'
        >
          {Math.round(percent)}%
        </div>
      )}
    </ProgressRingRoot>
  )
}

/*
  interface Props

  caps?: "butt" | "round";
  children?: React.ReactNode;
  lineWidth?: number;
  percent?: number;
  progressColor?: string;
  size?: number;
  spin?: boolean;
  trackColor?: string;
  transitionDuration?: number;
*/
