// Yeni kabuk (TabBarR3) — dışa açık yüzey (G11-S2).
export { TabBarR3 } from './TabBarR3';
export { TAB_BAR_R3, TAB_BAR_R3_HEIGHT, tabBarBottomOffset, tabBarContentInset } from './layout';
export {
  TabBarCollapseProvider,
  useTabBarCollapse,
  useTabBarCollapsedValue,
  useInR3Shell,
} from './scroll';
export {
  resolveShellTabs,
  shouldShowScan,
  resolveInitialShellTab,
  postAuthShellTab,
  LEGACY_TABS,
  type ShellTabDef,
  type ShellTabRoute,
  type ShellTabKind,
  type ShellFlags,
  type LegacyTabSnapshot,
} from './tabs';
