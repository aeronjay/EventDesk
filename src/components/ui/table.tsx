import * as React from "react"
import { cn } from "cn"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let isDown = false
    let isGrabbing = false
    let startX = 0
    let startY = 0
    let scrollLeft = 0
    let hasDragged = false
    let grabTimeout: ReturnType<typeof setTimeout>
    let styleEl: HTMLStyleElement | null = null

    const setGrabbingCursor = () => {
      if (!styleEl) {
        styleEl = document.createElement("style")
        styleEl.innerHTML = "* { cursor: grabbing !important; user-select: none !important; -webkit-user-select: none !important; }"
        document.head.appendChild(styleEl)
        window.getSelection()?.removeAllRanges()
      }
    }

    const removeGrabbingCursor = () => {
      if (styleEl) {
        document.head.removeChild(styleEl)
        styleEl = null
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      isDown = true
      isGrabbing = false
      hasDragged = false
      startX = e.pageX - el.offsetLeft
      startY = e.pageY - el.offsetTop
      scrollLeft = el.scrollLeft

      grabTimeout = setTimeout(() => {
        if (isDown) {
          isGrabbing = true
          setGrabbingCursor()
        }
      }, 150)
    }

    const onMouseLeave = () => {
      isDown = false
      isGrabbing = false
      clearTimeout(grabTimeout)
      removeGrabbingCursor()
    }

    const onMouseUp = () => {
      isDown = false
      isGrabbing = false
      clearTimeout(grabTimeout)
      removeGrabbingCursor()
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return

      const x = e.pageX - el.offsetLeft
      const y = e.pageY - el.offsetTop

      if (!isGrabbing) {
        if (Math.abs(x - startX) > 5 || Math.abs(y - startY) > 5) {
          clearTimeout(grabTimeout)
          hasDragged = true
        }
        return
      }

      hasDragged = true
      e.preventDefault()

      const walkX = (x - startX) * 1

      el.scrollLeft = scrollLeft - walkX
    }

    const onClickCapture = (e: MouseEvent) => {
      const selection = window.getSelection()
      const hasSelection = selection && selection.toString().trim().length > 0

      if (hasDragged || hasSelection) {
        e.stopPropagation()
        e.preventDefault()
      }
    }

    el.addEventListener("mousedown", onMouseDown)
    el.addEventListener("mouseleave", onMouseLeave)
    el.addEventListener("mouseup", onMouseUp)
    el.addEventListener("mousemove", onMouseMove)
    el.addEventListener("click", onClickCapture, { capture: true })

    return () => {
      el.removeEventListener("mousedown", onMouseDown)
      el.removeEventListener("mouseleave", onMouseLeave)
      el.removeEventListener("mouseup", onMouseUp)
      el.removeEventListener("mousemove", onMouseMove)
      el.removeEventListener("click", onClickCapture, { capture: true })
      removeGrabbingCursor()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className="relative w-full h-full overflow-auto cursor-grab"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
