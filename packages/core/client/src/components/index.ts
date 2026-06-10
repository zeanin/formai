import React from 'react';
// Layout components
export { Page } from './layout/Page';
export type { PageProps } from './layout/Page';
export { Grid } from './layout/Grid';
export type { GridProps, GridRowProps, GridColProps } from './layout/Grid';
export { Tabs } from './layout/Tabs';
export type { TabsProps, TabItemProps } from './layout/Tabs';
export { Space } from './layout/Space';
export type { SpaceProps } from './layout/Space';
export { CardItem } from './layout/CardItem';
export type { CardItemProps } from './layout/CardItem';
export { Divider } from './layout/Divider';
export type { DividerProps } from './layout/Divider';


// Block components
export { Table } from './block/Table';
export type { TableProps, TableColumnProps, TablePaginationProps } from './block/Table';
export { Form, FormContext, useFormContext } from './block/Form';
export type { FormProps, FormContextValue } from './block/Form';
export { Details } from './block/Details';
export type { DetailsProps, DetailsFieldProps } from './block/Details';
export { FilterBlock } from './block/FilterBlock';
export type { FilterBlockProps, FilterField } from './block/FilterBlock';
export { ChartBlock } from './block/ChartBlock';
export type { ChartBlockProps } from './block/ChartBlock';


// Input components
export { Input } from './input/Input';
export type { InputProps } from './input/Input';
export { Select } from './input/Select';
export type { SelectProps, SelectOption } from './input/Select';
export { DatePicker } from './input/DatePicker';
export type { DatePickerProps } from './input/DatePicker';
export { Checkbox } from './input/Checkbox';
export type { CheckboxProps, CheckboxOption } from './input/Checkbox';
export { Radio } from './input/Radio';
export type { RadioProps, RadioOption } from './input/Radio';
export { Switch } from './input/Switch';
export type { SwitchProps } from './input/Switch';
export { Upload } from './input/Upload';
export type { UploadProps } from './input/Upload';
export { FormItem } from './input/FormItem';
export type { FormItemProps } from './input/FormItem';
export { ColorPicker } from './input/ColorPicker';
export type { ColorPickerProps } from './input/ColorPicker';
export { TimePicker } from './input/TimePicker';
export type { TimePickerProps } from './input/TimePicker';


// Action components
export { Action } from './action/Action';
export type { ActionProps } from './action/Action';
export { ActionDrawer } from './action/ActionDrawer';
export type { ActionDrawerProps } from './action/ActionDrawer';
export { ActionModal } from './action/ActionModal';
export type { ActionModalProps } from './action/ActionModal';
export { ActionLink } from './action/ActionLink';
export type { ActionLinkProps } from './action/ActionLink';

// Data components
export { AssociationField } from './data/AssociationField';
export type { AssociationFieldProps, AssociationFieldOption } from './data/AssociationField';
export { RecordPicker } from './data/RecordPicker';
export type { RecordPickerProps, RecordPickerColumn } from './data/RecordPicker';

// Navigation components
export { Menu } from './navigation/Menu';
export type { MenuProps, MenuItemProps } from './navigation/Menu';

// Platform Business components
export { AmountInput } from './input/AmountInput';
export type { AmountInputProps } from './input/AmountInput';
export { StatusBadge } from './display/StatusBadge';
export type { StatusBadgeProps, StatusPreset } from './display/StatusBadge';
export { KanbanView } from './block/KanbanView';
export type { KanbanViewProps, KanbanCard, KanbanColumn } from './block/KanbanView';
export { KnowledgeWiki } from './block/KnowledgeWiki';
export type { KnowledgeWikiProps, WikiNode } from './block/KnowledgeWiki';

// Component registration
import { registerComponent } from '@formai/schema-engine';
import { Page } from './layout/Page';
import { Grid } from './layout/Grid';
import { Tabs } from './layout/Tabs';
import { Space } from './layout/Space';
import { CardItem } from './layout/CardItem';
import { Table } from './block/Table';
import { Form } from './block/Form';
import { Details } from './block/Details';
import { FilterBlock } from './block/FilterBlock';
import { Input } from './input/Input';
import { Select } from './input/Select';
import { DatePicker } from './input/DatePicker';
import { Checkbox } from './input/Checkbox';
import { Radio } from './input/Radio';
import { Switch } from './input/Switch';
import { Upload } from './input/Upload';
import { FormItem } from './input/FormItem';
import { Action } from './action/Action';
import { ActionDrawer } from './action/ActionDrawer';
import { ActionModal } from './action/ActionModal';
import { ActionLink } from './action/ActionLink';
import { AssociationField } from './data/AssociationField';
import { RecordPicker } from './data/RecordPicker';
import { Menu } from './navigation/Menu';
import { AmountInput } from './input/AmountInput';
import { StatusBadge } from './display/StatusBadge';
import { KanbanView } from './block/KanbanView';
import { KnowledgeWiki } from './block/KnowledgeWiki';
import { Divider } from './layout/Divider';
import { ChartBlock } from './block/ChartBlock';
import { ColorPicker } from './input/ColorPicker';
import { TimePicker } from './input/TimePicker';


export function registerCoreComponents(): void {
  // Layout
  registerComponent('Page', {
    component: Page,
    category: 'layout',
    title: 'Page',
    description: 'Top-level page container with optional header',
    aiDescription: 'A full page layout with optional title, subtitle, and extra actions in the header.',
  });
  registerComponent('Grid', {
    component: Grid,
    category: 'layout',
    title: 'Grid',
    description: 'Responsive grid layout with Row and Col sub-components',
    aiDescription: 'Responsive grid layout. Use Grid.Row and Grid.Col for explicit control, or pass cols prop for automatic equal-width columns.',
  });
  registerComponent('Grid.Row', {
    component: Grid.Row,
    category: 'layout',
    title: 'Grid Row',
    description: 'Grid row container',
  });
  registerComponent('Grid.Col', {
    component: Grid.Col,
    category: 'layout',
    title: 'Grid Column',
    description: 'Grid column with span control (1-24)',
  });
  registerComponent('Grid.Column', {
    component: Grid.Col,
    category: 'layout',
    title: 'Grid Column',
    description: 'Grid column with span control (1-24)',
  });
  registerComponent('Tabs', {
    component: Tabs,
    category: 'layout',
    title: 'Tabs',
    description: 'Tab navigation container',
    aiDescription: 'Tab panel container. Pass items array or use defaultActiveKey/activeKey for control.',
  });
  registerComponent('Space', {
    component: Space,
    category: 'layout',
    title: 'Space',
    description: 'Horizontal or vertical spacing container',
    aiDescription: 'Adds consistent spacing between inline children elements.',
  });
  registerComponent('CardItem', {
    component: CardItem,
    category: 'layout',
    title: 'Card',
    description: 'Card container with optional title and extra',
    aiDescription: 'A bordered card container with optional title, extra actions, and body content.',
  });
  registerComponent('Divider', {
    component: Divider,
    category: 'layout',
    title: 'Divider',
    description: 'Horizontal divider line with optional text label',
    aiDescription: 'A separator line. Use type="horizontal" or "vertical". Can display optional label text inside.',
  });


  // Block
  registerComponent('Table', {
    component: Table,
    category: 'block',
    title: 'Table',
    description: 'Data table with sorting, pagination, and row selection',
    aiDescription: 'Renders tabular data. Pass columns and dataSource. Supports pagination, row selection, sorting, and custom cell rendering.',
  });
  registerComponent('Form', {
    component: Form,
    category: 'block',
    title: 'Form',
    description: 'Form container with layout, validation, and submit handling',
    aiDescription: 'A form container. Supports horizontal, vertical, and inline layouts. Use with FormItem and input components.',
  });
  registerComponent('Details', {
    component: Details,
    category: 'block',
    title: 'Details',
    description: 'Read-only key-value detail display',
    aiDescription: 'Displays record fields in a key-value description list. Pass fields and dataSource.',
  });
  registerComponent('FilterBlock', {
    component: FilterBlock,
    category: 'block',
    title: 'Filter Block',
    description: 'Advanced filtering form for querying data with multi-field search and reset',
    aiDescription: 'An advanced search/filtering panel. Pass collection (string) and fields list. Fields can be custom defined with title, name, and type (enum, string, date, boolean, integer, float). When searched, it automatically reloads the page Table with filters applied.',
  });
  registerComponent('ChartBlock', {
    component: ChartBlock,
    category: 'block',
    title: 'Chart Block',
    description: 'Dynamic SVG chart block displaying data metrics grouped by status or dates',
    aiDescription: 'A card-wrapped visualization dashboard chart. Pass collection, chartType ("bar" | "line" | "pie"), xField (grouping field), and yField (value field). Automatically responds to FilterBlock changes.',
  });


  // Input
  registerComponent('Input', {
    component: Input,
    category: 'input',
    title: 'Input',
    description: 'Text input (single-line or multiline textarea)',
    aiDescription: 'Text input field. Set multiline=true for textarea. Supports readPretty for display-only mode.',
  });
  registerComponent('Select', {
    component: Select,
    category: 'input',
    title: 'Select',
    description: 'Dropdown select with search support',
    aiDescription: 'Dropdown selector. Pass options array. Set multiple=true for multi-select. Supports readPretty mode.',
  });
  registerComponent('DatePicker', {
    component: DatePicker,
    category: 'input',
    title: 'DatePicker',
    description: 'Date or datetime picker',
    aiDescription: 'Date picker. Set showTime=true for datetime. Set range=true for date range selection.',
  });
  registerComponent('Checkbox', {
    component: Checkbox,
    category: 'input',
    title: 'Checkbox',
    description: 'Single checkbox or checkbox group',
    aiDescription: 'Single checkbox or checkbox group. Pass options array for group mode.',
  });
  registerComponent('Radio', {
    component: Radio,
    category: 'input',
    title: 'Radio',
    description: 'Radio button group',
    aiDescription: 'Radio button group. Pass options array. Set buttonStyle=true for button-style radio.',
  });
  registerComponent('Switch', {
    component: Switch,
    category: 'input',
    title: 'Switch',
    description: 'Boolean toggle switch',
    aiDescription: 'On/off toggle switch. Supports checkedChildren and unCheckedChildren labels.',
  });
  registerComponent('Upload', {
    component: Upload,
    category: 'input',
    title: 'Upload',
    description: 'File upload with list display',
    aiDescription: 'File upload component. Supports text, picture, and picture-card list types. Set multiple=true for multiple files.',
  });
  registerComponent('FormItem', {
    component: FormItem,
    category: 'input',
    title: 'FormItem',
    description: 'Form field wrapper with label and validation',
    aiDescription: 'Wraps an input inside a form field with label, required indicator, and validation message display.',
  });
  registerComponent('ColorPicker', {
    component: ColorPicker,
    category: 'input',
    title: 'ColorPicker',
    description: 'Color selection picker input',
    aiDescription: 'Select colors from a premium palette or picker. Supports readPretty showing a colored swatch pill with hex text.',
  });
  registerComponent('TimePicker', {
    component: TimePicker,
    category: 'input',
    title: 'TimePicker',
    description: 'Time or time duration selector input',
    aiDescription: 'Select time in HH:mm:ss format. Supports custom format and step increments.',
  });


  // Action
  registerComponent('Action', {
    component: Action,
    category: 'action',
    title: 'Action',
    description: 'Button with optional confirm dialog',
    aiDescription: 'A button that triggers actions. Set confirmTitle for a confirm popup. Set action="destroy" and collection for bulk deletion. Set action="export" and collection for exporting table data to CSV (auto-applies active filter). Set action="import" and collection to show a csv import modal with polling progress and error logs.',
  });
  registerComponent('ActionDrawer', {
    component: ActionDrawer,
    category: 'action',
    title: 'ActionDrawer',
    description: 'Button that opens a slide-in drawer',
    aiDescription: 'A button that opens a Drawer panel. Put content inside to render in the drawer.',
  });
  registerComponent('ActionModal', {
    component: ActionModal,
    category: 'action',
    title: 'ActionModal',
    description: 'Button that opens a modal dialog',
    aiDescription: 'A button that opens a Modal dialog. Supports onOk callback and custom footer.',
  });
  registerComponent('ActionLink', {
    component: ActionLink,
    category: 'action',
    title: 'ActionLink',
    description: 'Link-styled action',
    aiDescription: 'Renders as a hyperlink. Supports href for navigation or onClick for in-page actions.',
  });

  // Data
  registerComponent('AssociationField', {
    component: AssociationField,
    category: 'display',
    title: 'AssociationField',
    description: 'Select related records from another collection',
    aiDescription: 'Loads options from a collection and renders as a searchable dropdown. Supports multiple selection.',
  });
  registerComponent('RecordPicker', {
    component: RecordPicker,
    category: 'display',
    title: 'RecordPicker',
    description: 'Modal-based record picker for associations',
    aiDescription: 'Opens a modal with a searchable table to pick one or more records from a collection.',
  });

  // Navigation
  registerComponent('Menu', {
    component: Menu,
    category: 'navigation',
    title: 'Menu',
    description: 'Side or top navigation menu',
    aiDescription: 'Navigation menu. Supports inline, vertical, and horizontal modes. Pass items array with optional nested children.',
  });

  // ERP / Business components
  registerComponent('AmountInput', {
    component: AmountInput as React.ComponentType,
    category: 'input',
    title: 'AmountInput',
    description: 'Multi-currency monetary amount input with formatting',
    aiDescription: 'Currency-aware numeric input. Supports readPretty for display mode. Pass currency prop for fixed currency or onCurrencyChange for a currency selector dropdown.',
  });
  registerComponent('StatusBadge', {
    component: StatusBadge as React.ComponentType,
    category: 'display',
    title: 'StatusBadge',
    description: 'Colored tag badge for status fields',
    aiDescription: 'Renders a status field as a colored Tag (active=green, inactive=grey, pending=blue, cancelled/error=red, draft=orange). Set dot=true for a dot indicator. Pass optionMap for custom status colors.',
  });
  registerComponent('KanbanView', {
    component: KanbanView as React.ComponentType,
    category: 'block',
    title: 'KanbanView',
    description: 'Drag-and-drop Kanban board grouped by a status field',
    aiDescription: 'Kanban board that groups records into swimlane columns. Pass columns (key, title, color, limit) and cards (id, title, columnKey). Supports drag-and-drop reordering and WIP limits per column.',
  });
  registerComponent('KnowledgeWiki', {
    component: KnowledgeWiki as React.ComponentType,
    category: 'block',
    title: 'KnowledgeWiki',
    description: 'Obsidian-style wiki workspace with dynamic Markdown linking and an interactive force-directed relationship graph.',
    aiDescription: 'Obsidian-style local-first wiki workspace. Takes collection (string) prop representing the memory_nodes collection. Automatically lists linked entities and displays backlinks and a dynamic relationship graph.',
  });
}
