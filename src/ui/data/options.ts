import type { OptionSetId } from '../../shared/properties';

export interface Option {
  value: string;
  label: string;
}

const blendMode: Option[] = [
  { value: 'PASS_THROUGH', label: 'Pass through' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'DARKEN', label: 'Darken' },
  { value: 'MULTIPLY', label: 'Multiply' },
  { value: 'COLOR_BURN', label: 'Color Burn' },
  { value: 'LIGHTEN', label: 'Lighten' },
  { value: 'SCREEN', label: 'Screen' },
  { value: 'COLOR_DODGE', label: 'Color Dodge' },
  { value: 'OVERLAY', label: 'Overlay' },
  { value: 'SOFT_LIGHT', label: 'Soft Light' },
  { value: 'HARD_LIGHT', label: 'Hard Light' },
  { value: 'DIFFERENCE', label: 'Difference' },
  { value: 'EXCLUSION', label: 'Exclusion' },
  { value: 'HUE', label: 'Hue' },
  { value: 'SATURATION', label: 'Saturation' },
  { value: 'COLOR', label: 'Color' },
  { value: 'LUMINOSITY', label: 'Luminosity' },
];

export const OPTION_SETS: Record<OptionSetId, Option[]> = {
  blendMode,
  strokeAlign: [
    { value: 'CENTER', label: 'center' },
    { value: 'INSIDE', label: 'inside' },
    { value: 'OUTSIDE', label: 'outside' },
  ],
  textAlignHorizontal: [
    { value: 'LEFT', label: 'left' },
    { value: 'CENTER', label: 'center' },
    { value: 'RIGHT', label: 'right' },
    { value: 'JUSTIFIED', label: 'justified' },
  ],
  textAlignVertical: [
    { value: 'TOP', label: 'top' },
    { value: 'CENTER', label: 'center' },
    { value: 'BOTTOM', label: 'bottom' },
  ],
  textDecoration: [
    { value: 'NONE', label: 'none' },
    { value: 'UNDERLINE', label: 'underline' },
    { value: 'STRIKETHROUGH', label: 'strikethrough' },
  ],
  autoLayoutPosition: [
    { value: 'MIN', label: 'min' },
    { value: 'MAX', label: 'max' },
    { value: 'CENTER', label: 'center' },
    { value: 'SPACE_BETWEEN', label: 'space-between' },
  ],
  autoLayoutDirection: [
    { value: 'HORIZONTAL', label: 'horizontal' },
    { value: 'VERTICAL', label: 'vertical' },
  ],
  interactionTrigger: [
    { value: 'ON_CLICK', label: 'on click' },
    { value: 'ON_DRAG', label: 'on drag' },
    { value: 'ON_HOVER', label: 'while hovering' },
    { value: 'ON_PRESS', label: 'on press' },
    { value: 'ON_KEY_DOWN', label: 'key/gamepad' },
    { value: 'MOUSE_ENTER', label: 'mouse enter' },
    { value: 'MOUSE_LEAVE', label: 'mouse leave' },
    { value: 'MOUSE_DOWN', label: 'mouse down' },
    { value: 'MOUSE_UP', label: 'mouse up' },
    { value: 'AFTER_TIMEOUT', label: 'after delay' },
    { value: 'ON_MEDIA_HIT', label: 'when video hits' },
    { value: 'ON_MEDIA_END', label: 'when video ends' },
  ],
  interactionAction: [
    { value: 'NAVIGATE', label: 'navigate to' },
    { value: 'CHANGE_TO', label: 'change to' },
    { value: 'BACK', label: 'back' },
    { value: 'SCROLL_TO', label: 'scroll to' },
    { value: 'URL', label: 'open link' },
    { value: 'SET_VARIABLE', label: 'set variable' },
    { value: 'SET_VARIABLE_MODE', label: 'set variable mode' },
    { value: 'CONDITIONAL', label: 'conditional' },
    { value: 'OVERLAY', label: 'open overlay' },
    { value: 'SWAP', label: 'swap overlay' },
    { value: 'CLOSE', label: 'close overlay' },
    { value: 'TOGGLE_PLAY_PAUSE', label: 'toggle play/pause video' },
    { value: 'PLAY', label: 'play video' },
    { value: 'PAUSE', label: 'pause video' },
    { value: 'TOGGLE_MUTE_UNMUTE', label: 'toggle mute/unmute video' },
    { value: 'MUTE', label: 'mute video' },
    { value: 'UNMUTE', label: 'unmute video' },
    { value: 'SKIP_TO', label: 'set to specific time' },
    { value: 'SKIP_FORWARD', label: 'jump forward' },
    { value: 'SKIP_BACKWARD', label: 'jump backward' },
  ],
};

export function optionsHtml(options: Option[]): string {
  return options
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join('');
}
