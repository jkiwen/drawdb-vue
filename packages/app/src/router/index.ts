import {
  createRouter,
  createWebHistory,
  type Router,
  type RouterHistory,
} from "vue-router";
import HomeView from "../views/HomeView.vue";
import EditorView from "../views/EditorView.vue";
import TemplateView from "../views/TemplateView.vue";

/** The routes of the standalone application. */
export const appRoutes = [
  { path: "/", name: "home", component: HomeView },
  { path: "/editor", name: "editor", component: EditorView },
  { path: "/editor/:id", name: "editor-diagram", component: EditorView },
  { path: "/templates", name: "templates", component: TemplateView },
  { path: "/templates/:id", name: "template", component: TemplateView },
  { path: "/:pathMatch(.*)*", name: "not-found", component: HomeView },
];

/**
 * Create the router of the application.
 *
 * The history can be given, so that a test can use the memory history
 * instead of the history of the browser.
 */
export function createAppRouter(history?: RouterHistory): Router {
  return createRouter({
    history: history ?? createWebHistory(),
    routes: appRoutes,
  });
}
