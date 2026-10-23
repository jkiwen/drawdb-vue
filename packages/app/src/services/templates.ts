import type { Diagram } from "@drawdb/core";

/**
 * A starter diagram of the standalone application.
 *
 * A template carries a diagram without an id: the application gives the
 * diagram an id and stores it when the user opens it in the editor.
 */
export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  diagram: Diagram;
}

const blog: Diagram = {
  database: "generic",
  title: "Blog",
  sqlHeader: "",
  tables: [
    {
      id: "t_users",
      name: "users",
      x: 80,
      y: 80,
      fields: [
        { id: "f_users_id", name: "id", type: "INTEGER", primary: true, increment: true, notNull: true },
        { id: "f_users_email", name: "email", type: "VARCHAR", size: 255, unique: true, notNull: true },
        { id: "f_users_name", name: "name", type: "VARCHAR", size: 120 },
      ],
    },
    {
      id: "t_posts",
      name: "posts",
      x: 400,
      y: 80,
      fields: [
        { id: "f_posts_id", name: "id", type: "INTEGER", primary: true, increment: true, notNull: true },
        { id: "f_posts_user_id", name: "user_id", type: "INTEGER", notNull: true },
        { id: "f_posts_title", name: "title", type: "VARCHAR", size: 200, notNull: true },
        { id: "f_posts_body", name: "body", type: "TEXT" },
        { id: "f_posts_published", name: "published", type: "BOOLEAN", default: "false" },
      ],
    },
    {
      id: "t_comments",
      name: "comments",
      x: 400,
      y: 340,
      fields: [
        { id: "f_comments_id", name: "id", type: "INTEGER", primary: true, increment: true, notNull: true },
        { id: "f_comments_post_id", name: "post_id", type: "INTEGER", notNull: true },
        { id: "f_comments_body", name: "body", type: "TEXT", notNull: true },
      ],
    },
  ],
  relationships: [
    {
      id: "r_posts_users",
      startTableId: "t_posts",
      startFieldId: "f_posts_user_id",
      endTableId: "t_users",
      endFieldId: "f_users_id",
      name: "fk_posts_user_id_users",
      cardinality: "many_to_one",
    },
    {
      id: "r_comments_posts",
      startTableId: "t_comments",
      startFieldId: "f_comments_post_id",
      endTableId: "t_posts",
      endFieldId: "f_posts_id",
      name: "fk_comments_post_id_posts",
      cardinality: "many_to_one",
    },
  ],
  notes: [],
  subjectAreas: [],
  types: [],
  enums: [],
  views: [],
  metadata: {},
};

const store: Diagram = {
  database: "generic",
  title: "Store",
  sqlHeader: "",
  tables: [
    {
      id: "t_categories",
      name: "categories",
      x: 80,
      y: 80,
      fields: [
        { id: "f_categories_id", name: "id", type: "INTEGER", primary: true, increment: true, notNull: true },
        { id: "f_categories_name", name: "name", type: "VARCHAR", size: 120, notNull: true },
      ],
    },
    {
      id: "t_products",
      name: "products",
      x: 400,
      y: 80,
      fields: [
        { id: "f_products_id", name: "id", type: "INTEGER", primary: true, increment: true, notNull: true },
        { id: "f_products_category_id", name: "category_id", type: "INTEGER", notNull: true },
        { id: "f_products_name", name: "name", type: "VARCHAR", size: 200, notNull: true },
        { id: "f_products_price", name: "price", type: "DECIMAL", size: "10,2", notNull: true },
        { id: "f_products_stock", name: "stock", type: "INTEGER", default: "0" },
      ],
    },
    {
      id: "t_orders",
      name: "orders",
      x: 400,
      y: 340,
      fields: [
        { id: "f_orders_id", name: "id", type: "INTEGER", primary: true, increment: true, notNull: true },
        { id: "f_orders_product_id", name: "product_id", type: "INTEGER", notNull: true },
        { id: "f_orders_quantity", name: "quantity", type: "INTEGER", default: "1", notNull: true },
        { id: "f_orders_total", name: "total", type: "DECIMAL", size: "10,2", notNull: true },
      ],
    },
  ],
  relationships: [
    {
      id: "r_products_categories",
      startTableId: "t_products",
      startFieldId: "f_products_category_id",
      endTableId: "t_categories",
      endFieldId: "f_categories_id",
      name: "fk_products_category_id_categories",
      cardinality: "many_to_one",
    },
    {
      id: "r_orders_products",
      startTableId: "t_orders",
      startFieldId: "f_orders_product_id",
      endTableId: "t_products",
      endFieldId: "f_products_id",
      name: "fk_orders_product_id_products",
      cardinality: "many_to_one",
    },
  ],
  notes: [],
  subjectAreas: [],
  types: [],
  enums: [],
  views: [],
  metadata: {},
};

export const appTemplates: AppTemplate[] = [
  {
    id: "blog",
    name: "Blog",
    description: "Users, posts and comments.",
    diagram: blog,
  },
  {
    id: "store",
    name: "Store",
    description: "Categories, products and orders.",
    diagram: store,
  },
];

/** Return a template by its id. */
export function findTemplate(id: string): AppTemplate | undefined {
  return appTemplates.find((template) => template.id === id);
}
