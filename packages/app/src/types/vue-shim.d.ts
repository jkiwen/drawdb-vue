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
 * The SDK components import their stylesheet as a module (`import styles
 * from "./edit-panel.module.css"`), and this app boots them through the
 * source aliases, so the declaration has to be part of this program too.
 * Vite turns every class name into a hashed one at build time; the type
 * checker only needs the shape of the default export.
 */
declare module "*.module.css" {
  const classes: Record<string, string>;

  export default classes;
}
