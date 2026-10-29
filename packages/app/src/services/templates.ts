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
      logical: {
        id: "l_t_users",
        name: "users",
        attributes: [
          { id: "a_f_users_id", name: "id", logicalType: { family: "integer" }, fieldId: "f_users_id" },
          { id: "a_f_users_email", name: "email", logicalType: { family: "string" }, fieldId: "f_users_email" },
          { id: "a_f_users_name", name: "name", logicalType: { family: "string" }, fieldId: "f_users_name" },
        ],
      },
      fields: [
        { id: "f_users_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", increment: true, notNull: true },
        { id: "f_users_email", name: "email", fieldType: { type: "VARCHAR", length: 255 }, fieldTypeSource: "explicit", unique: true, notNull: true },
        { id: "f_users_name", name: "name", fieldType: { type: "VARCHAR", length: 120 }, fieldTypeSource: "explicit" },
      ],
      primaryKey: { id: "pk_users", name: "PK_users", logicalName: "PK_users", columns: [{ fieldId: "f_users_id" }] },
    },
    {
      id: "t_posts",
      name: "posts",
      x: 400,
      y: 80,
      logical: {
        id: "l_t_posts",
        name: "posts",
        attributes: [
          { id: "a_f_posts_id", name: "id", logicalType: { family: "integer" }, fieldId: "f_posts_id" },
          { id: "a_f_posts_user_id", name: "user_id", logicalType: { family: "integer" }, fieldId: "f_posts_user_id" },
          { id: "a_f_posts_title", name: "title", logicalType: { family: "string" }, fieldId: "f_posts_title" },
          { id: "a_f_posts_body", name: "body", logicalType: { family: "text" }, fieldId: "f_posts_body" },
          { id: "a_f_posts_published", name: "published", logicalType: { family: "boolean" }, fieldId: "f_posts_published" },
        ],
      },
      fields: [
        { id: "f_posts_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", increment: true, notNull: true },
        { id: "f_posts_user_id", name: "user_id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", notNull: true },
        { id: "f_posts_title", name: "title", fieldType: { type: "VARCHAR", length: 200 }, fieldTypeSource: "explicit", notNull: true },
        { id: "f_posts_body", name: "body", fieldType: { type: "TEXT" }, fieldTypeSource: "explicit" },
        { id: "f_posts_published", name: "published", fieldType: { type: "BOOLEAN" }, fieldTypeSource: "explicit", default: "false" },
      ],
      primaryKey: { id: "pk_posts", name: "PK_posts", logicalName: "PK_posts", columns: [{ fieldId: "f_posts_id" }] },
    },
    {
      id: "t_comments",
      name: "comments",
      x: 400,
      y: 340,
      logical: {
        id: "l_t_comments",
        name: "comments",
        attributes: [
          { id: "a_f_comments_id", name: "id", logicalType: { family: "integer" }, fieldId: "f_comments_id" },
          { id: "a_f_comments_post_id", name: "post_id", logicalType: { family: "integer" }, fieldId: "f_comments_post_id" },
          { id: "a_f_comments_body", name: "body", logicalType: { family: "text" }, fieldId: "f_comments_body" },
        ],
      },
      fields: [
        { id: "f_comments_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", increment: true, notNull: true },
        { id: "f_comments_post_id", name: "post_id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", notNull: true },
        { id: "f_comments_body", name: "body", fieldType: { type: "TEXT" }, fieldTypeSource: "explicit", notNull: true },
      ],
      primaryKey: { id: "pk_comments", name: "PK_comments", logicalName: "PK_comments", columns: [{ fieldId: "f_comments_id" }] },
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
      logical: {
        id: "l_t_categories",
        name: "categories",
        attributes: [
          { id: "a_f_categories_id", name: "id", logicalType: { family: "integer" }, fieldId: "f_categories_id" },
          { id: "a_f_categories_name", name: "name", logicalType: { family: "string" }, fieldId: "f_categories_name" },
        ],
      },
      fields: [
        { id: "f_categories_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", increment: true, notNull: true },
        { id: "f_categories_name", name: "name", fieldType: { type: "VARCHAR", length: 120 }, fieldTypeSource: "explicit", notNull: true },
      ],
      primaryKey: { id: "pk_categories", name: "PK_categories", logicalName: "PK_categories", columns: [{ fieldId: "f_categories_id" }] },
    },
    {
      id: "t_products",
      name: "products",
      x: 400,
      y: 80,
      logical: {
        id: "l_t_products",
        name: "products",
        attributes: [
          { id: "a_f_products_id", name: "id", logicalType: { family: "integer" }, fieldId: "f_products_id" },
          { id: "a_f_products_category_id", name: "category_id", logicalType: { family: "integer" }, fieldId: "f_products_category_id" },
          { id: "a_f_products_name", name: "name", logicalType: { family: "string" }, fieldId: "f_products_name" },
          { id: "a_f_products_price", name: "price", logicalType: { family: "decimal" }, fieldId: "f_products_price" },
          { id: "a_f_products_stock", name: "stock", logicalType: { family: "integer" }, fieldId: "f_products_stock" },
        ],
      },
      fields: [
        { id: "f_products_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", increment: true, notNull: true },
        { id: "f_products_category_id", name: "category_id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", notNull: true },
        { id: "f_products_name", name: "name", fieldType: { type: "VARCHAR", length: 200 }, fieldTypeSource: "explicit", notNull: true },
        { id: "f_products_price", name: "price", fieldType: { type: "DECIMAL", precision: 10, scale: 2 }, fieldTypeSource: "explicit", notNull: true },
        { id: "f_products_stock", name: "stock", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", default: "0" },
      ],
      primaryKey: { id: "pk_products", name: "PK_products", logicalName: "PK_products", columns: [{ fieldId: "f_products_id" }] },
    },
    {
      id: "t_orders",
      name: "orders",
      x: 400,
      y: 340,
      logical: {
        id: "l_t_orders",
        name: "orders",
        attributes: [
          { id: "a_f_orders_id", name: "id", logicalType: { family: "integer" }, fieldId: "f_orders_id" },
          { id: "a_f_orders_product_id", name: "product_id", logicalType: { family: "integer" }, fieldId: "f_orders_product_id" },
          { id: "a_f_orders_quantity", name: "quantity", logicalType: { family: "integer" }, fieldId: "f_orders_quantity" },
          { id: "a_f_orders_total", name: "total", logicalType: { family: "decimal" }, fieldId: "f_orders_total" },
        ],
      },
      fields: [
        { id: "f_orders_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", increment: true, notNull: true },
        { id: "f_orders_product_id", name: "product_id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", notNull: true },
        { id: "f_orders_quantity", name: "quantity", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", default: "1", notNull: true },
        { id: "f_orders_total", name: "total", fieldType: { type: "DECIMAL", precision: 10, scale: 2 }, fieldTypeSource: "explicit", notNull: true },
      ],
      primaryKey: { id: "pk_orders", name: "PK_orders", logicalName: "PK_orders", columns: [{ fieldId: "f_orders_id" }] },
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
