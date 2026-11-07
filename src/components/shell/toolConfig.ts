import {
  Highlighter,
  MousePointer2,
  PenTool,
  Square,
  Type as TypeIcon,
  type LucideIcon,
} from 'lucide-react'
import type { Tool } from '../../types/editor'

interface ToolMeta {
  label: string
  hint: string
  description: string
  icon: LucideIcon
}

export const TOOL_ORDER: Tool[] = ['select', 'text', 'highlight', 'rectangle', 'ink']

export const TOOL_META: Record<Tool, ToolMeta> = {
  select: {
    label: 'Select',
    hint: 'V',
    description: 'Select pages and annotations',
    icon: MousePointer2,
  },
  text: {
    label: 'Text',
    hint: 'T',
    description: 'Place a text annotation',
    icon: TypeIcon,
  },
  highlight: {
    label: 'Highlight',
    hint: 'H',
    description: 'Mark up an area of the page',
    icon: Highlighter,
  },
  rectangle: {
    label: 'Rectangle',
    hint: 'R',
    description: 'Draw a rectangle',
    icon: Square,
  },
  ink: {
    label: 'Ink',
    hint: 'P',
    description: 'Draw freehand with the pen',
    icon: PenTool,
  },
}
