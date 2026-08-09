/**
 * Obsidian 运行时在 HTMLElement 原型上挂载的样式辅助方法。
 * 0.14.8 官方类型缺失声明，此处补齐（运行时自 1.0 起存在）。
 * 审核规则 obsidianmd/no-static-styles-assignment 要求用 setCssProps/setCssStyles 替代
 * 直接样式赋值（.style.X = 字面量 / 无优先级 setProperty）。
 */
declare interface HTMLElement {
  /** 批量设置内联 CSS；键驼峰自动转连字符（如 marginRight → margin-right），值为 null 时移除该属性 */
  setCssProps(props: Record<string, string | number | null>, options?: { important?: boolean }): void;
}
