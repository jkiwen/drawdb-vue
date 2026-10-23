import type { Component, Plugin } from "vue";

/**
 * The mock of Naive UI the test runner installs.
 *
 * The SDK renders Naive UI components, which do not run under jsdom, so
 * `scripts/naive-ui-mock.mjs` replaces every one of them with a component
 * that renders a real element and spreads the inherited attributes onto it.
 */
export const naive: Plugin;

/** The mock of one Naive UI component. */
export const NButton: Component;

/** The mock of a container of Naive UI components. */
export const NButtonGroup: Component;

/** The plugin that registers every mock on the application. */
export function createMockComponent(name: string): Component;

/** The plugin that registers a container of Naive UI components. */
export function createContainerComponent(name: string): Component;

/** The component that mocks the drag and drop of `vue-draggable-plus`. */
export const VueDraggable: Component;
