// One import line for every screen part:
//   import { Button, Card, Table, Modal, StatusBadge } from "@/components/ui";
//
// Everything a page needs to draw itself lives here. If a page is about to
// hand-write a button, a table, a pop-up window or a status pill, it should
// use one of these instead - that is the whole reason they exist.

export { Button, type ButtonProps } from "./Button";
export { Card, CardHeader, CardBody, StatCard } from "./Card";
export { Badge, StatusBadge, OrderStatusBadge } from "./Badge";
export { Modal } from "./Modal";
export { useDialogKeys } from "./useDialogKeys";
export { ConfirmDialog } from "./ConfirmDialog";
export { Table, type Column } from "./Table";
export { Tabs, type Tab } from "./Tabs";
export { DomainTabs, type DomainTab } from "./DomainTabs";
export { EmptyState, ErrorState, LoadingState } from "./States";
export { Money, Rate, DateText, DateTimeText } from "./Value";
export {
  BRAND,
  BRAND_PRESSED,
  BRAND_WASH,
  BRAND_DARK,
  ON_BRAND,
  ACCENT,
  ACCENT_SOFT,
  PLAIN,
  CHART,
  CHART_SERIES,
  TONE_CLASS,
  TONE_HEX,
  STATUS_TONE,
  ORDER_STATUS,
  ORDER_STATUS_ORDER,
  orderStatusLabel,
  ORDER_KIND_TONE,
  toneFor,
  statusHex,
  statusLabel,
  type Tone,
} from "./theme";
