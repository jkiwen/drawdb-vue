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
