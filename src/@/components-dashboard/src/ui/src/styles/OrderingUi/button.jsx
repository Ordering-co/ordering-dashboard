// Generated from the locked Ordering.co registry; run pnpm ui:sync.
import React from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva } from 'class-variance-authority'

import { cn } from './utils'

const buttonVariants = cva(
  "mia:group/button mia:relative mia:inline-flex mia:shrink-0 mia:items-center mia:justify-center mia:rounded-md mia:border mia:border-transparent mia:bg-clip-padding mia:text-[13px] mia:font-medium mia:whitespace-nowrap mia:transition-colors mia:outline-none mia:select-none mia:after:absolute mia:after:-inset-1.5 mia:after:content-[''] mia:focus-visible:border-ring mia:active:not-aria-[haspopup]:translate-y-px mia:disabled:pointer-events-none mia:disabled:opacity-50 mia:aria-invalid:border-destructive mia:dark:aria-invalid:border-destructive/50 mia:[&_svg]:pointer-events-none mia:[&_svg]:shrink-0 mia:[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'mia:bg-primary mia:text-primary-foreground mia:hover:bg-[var(--od-action-hover)]',
        outline:
          'mia:border-border mia:bg-background mia:hover:bg-muted mia:hover:text-foreground mia:aria-expanded:bg-muted mia:aria-expanded:text-foreground mia:dark:border-input mia:dark:bg-input/30 mia:dark:hover:bg-input/50',
        secondary:
          'mia:bg-secondary mia:text-secondary-foreground mia:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] mia:aria-expanded:bg-secondary mia:aria-expanded:text-secondary-foreground',
        ghost:
          'mia:hover:bg-muted mia:hover:text-foreground mia:aria-expanded:bg-muted mia:aria-expanded:text-foreground mia:dark:hover:bg-muted/50',
        destructive:
          'mia:bg-destructive/10 mia:text-destructive mia:hover:bg-destructive/20 mia:focus-visible:border-destructive/40 mia:dark:bg-destructive/20 mia:dark:hover:bg-destructive/30',
        link: 'mia:text-action-foreground mia:underline-offset-4 mia:hover:underline'
      },
      size: {
        default:
          'mia:h-8 mia:gap-1.5 mia:px-2.5 mia:has-data-[icon=inline-end]:pr-2 mia:has-data-[icon=inline-start]:pl-2',
        xs: "mia:h-7 mia:gap-1 mia:rounded-sm mia:px-2 mia:text-1 mia:in-data-[slot=button-group]:rounded-md mia:has-data-[icon=inline-end]:pr-1.5 mia:has-data-[icon=inline-start]:pl-1.5 mia:[&_svg:not([class*='size-'])]:size-3",
        sm: 'mia:h-8 mia:gap-1.5 mia:px-2.5 mia:in-data-[slot=button-group]:rounded-md mia:has-data-[icon=inline-end]:pr-2 mia:has-data-[icon=inline-start]:pl-2',
        lg: 'mia:h-9 mia:gap-1.5 mia:px-2.5 mia:has-data-[icon=inline-end]:pr-2 mia:has-data-[icon=inline-start]:pl-2',
        icon: 'mia:size-8',
        'icon-xs':
          "mia:size-7 mia:rounded-sm mia:in-data-[slot=button-group]:rounded-md mia:[&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'mia:size-8 mia:in-data-[slot=button-group]:rounded-md',
        'icon-lg': 'mia:size-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

function Button ({
  className,
  variant = 'default',
  size = 'default',
  ...props
}) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
