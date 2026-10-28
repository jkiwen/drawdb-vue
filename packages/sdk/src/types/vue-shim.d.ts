/**
 * Type declaration for the single file components.
 *
 * `vue-tsc` understands `.vue` files, but the plain `tsc` used by the
 * workspace type check does not, so the components are declared as generic
 * Vue components here.
 */
declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    unknown
  >;

  export default component;
}

/**
 * Type declaration for the CSS modules.
 *
 * The components import their stylesheet as a module (`import styles from
 * "./edit-panel.module.css"`), and Vite turns every class name into a
 * hashed one at build time. The type checker only needs to know that the
 * default export maps a class name of the stylesheet to the name the
 * browser receives.
 */
declare module "*.module.css" {
  const classes: Record<string, string>;

  export default classes;
}
