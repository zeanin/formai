/**
 * Example schemas for A2UI few-shot / RAG prompting.
 * These are referenced by the engine's system prompt to guide the LLM
 * toward generating well-structured Formily ISchema output.
 */
import type { ISchema } from '@formai/shared';

/** Example: CRUD table page with action bar */
export const CRUD_TABLE_EXAMPLE: ISchema = {
  type: 'void',
  'x-uid': 'page1',
  'x-component': 'Page',
  'x-component-props': { title: 'Users Management' },
  properties: {
    actionBar: {
      type: 'void',
      'x-uid': 'actionBar1',
      'x-component': 'Space',
      properties: {
        createDrawer: {
          type: 'void',
          'x-uid': 'createDrawer1',
          'x-component': 'ActionDrawer',
          'x-component-props': { triggerText: 'Add New', triggerType: 'primary', drawerTitle: 'Add New User' },
          properties: {
            createForm: {
              type: 'object',
              'x-uid': 'createForm1',
              'x-component': 'Form',
              'x-component-props': { collection: 'users', layout: 'vertical' },
              properties: {
                username: {
                  type: 'string',
                  'x-uid': 'fieldUsername',
                  title: 'Username',
                  'x-decorator': 'FormItem',
                  'x-component': 'Input',
                  'x-validator': [{ required: true, message: 'Username is required' }],
                },
                email: {
                  type: 'string',
                  'x-uid': 'fieldEmail',
                  title: 'Email',
                  'x-decorator': 'FormItem',
                  'x-component': 'Input',
                  'x-validator': [{ required: true, message: 'Email is required' }],
                },
                actions: {
                  type: 'void',
                  'x-uid': 'formActions1',
                  'x-component': 'Space',
                  properties: {
                    submit: {
                      type: 'void',
                      'x-uid': 'actionSubmit1',
                      'x-component': 'Action',
                      'x-component-props': { title: 'Submit', type: 'primary', htmlType: 'submit' },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          type: 'void',
          'x-uid': 'actionDelete1',
          'x-component': 'Action',
          'x-component-props': {
            title: 'Delete',
            danger: true,
            action: 'destroy',
            collection: 'users',
            confirmTitle: 'Are you sure you want to delete selected users?',
          },
        },
      },
    },
    table: {
      type: 'array',
      'x-uid': 'table1',
      'x-component': 'Table',
      'x-decorator': 'CardItem',
      'x-component-props': {
        collection: 'users',
        columns: [
          { title: 'Username', dataIndex: 'username', key: 'username' },
          { title: 'Email', dataIndex: 'email', key: 'email' },
          { title: 'Status', dataIndex: 'status', key: 'status', render: 'StatusBadge' },
        ],
        pagination: { pageSize: 20 },
        rowSelection: true,
      },
    },
  },
};

/** Example: Form page with common field types */
export const FORM_EXAMPLE: ISchema = {
  type: 'object',
  'x-uid': 'formPage1',
  'x-component': 'Page',
  'x-component-props': { title: 'Create User' },
  properties: {
    form: {
      type: 'object',
      'x-uid': 'form1',
      'x-component': 'Form',
      'x-component-props': { layout: 'vertical' },
      properties: {
        username: {
          type: 'string',
          'x-uid': 'fieldUsername',
          title: 'Username',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-validator': [{ required: true, message: 'Username is required' }],
        },
        email: {
          type: 'string',
          'x-uid': 'fieldEmail',
          title: 'Email',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-component-props': { type: 'email' },
          'x-validator': [{ required: true, format: 'email' }],
        },
        role: {
          type: 'string',
          'x-uid': 'fieldRole',
          title: 'Role',
          'x-decorator': 'FormItem',
          'x-component': 'Select',
          'x-component-props': {
            options: [
              { label: 'Admin', value: 'admin' },
              { label: 'User', value: 'user' },
              { label: 'Guest', value: 'guest' },
            ],
          },
        },
        actions: {
          type: 'void',
          'x-uid': 'formActions1',
          'x-component': 'Space',
          properties: {
            submit: {
              type: 'void',
              'x-uid': 'actionSubmit1',
              'x-component': 'Action',
              'x-component-props': { title: 'Submit', type: 'primary', htmlType: 'submit' },
            },
            cancel: {
              type: 'void',
              'x-uid': 'actionCancel1',
              'x-component': 'Action',
              'x-component-props': { title: 'Cancel' },
            },
          },
        },
      },
    },
  },
};

/** Example: Detail / card view page */
export const DETAIL_EXAMPLE: ISchema = {
  type: 'void',
  'x-uid': 'detailPage1',
  'x-component': 'Page',
  'x-component-props': { title: 'User Detail' },
  properties: {
    detail: {
      type: 'void',
      'x-uid': 'detail1',
      'x-component': 'Descriptions',
      'x-decorator': 'CardItem',
      'x-component-props': { column: 2, bordered: true },
      properties: {
        username: {
          type: 'string',
          'x-uid': 'detailUsername',
          title: 'Username',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-read-only': true,
        },
        email: {
          type: 'string',
          'x-uid': 'detailEmail',
          title: 'Email',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-read-only': true,
        },
        status: {
          type: 'string',
          'x-uid': 'detailStatus',
          title: 'Status',
          'x-decorator': 'FormItem',
          'x-component': 'Tag',
          'x-read-only': true,
        },
      },
    },
    actions: {
      type: 'void',
      'x-uid': 'detailActions1',
      'x-component': 'Space',
      properties: {
        edit: {
          type: 'void',
          'x-uid': 'actionEdit1',
          'x-component': 'Action',
          'x-component-props': { title: 'Edit', type: 'primary' },
        },
        back: {
          type: 'void',
          'x-uid': 'actionBack1',
          'x-component': 'Action',
          'x-component-props': { title: 'Back' },
        },
      },
    },
  },
};

/** Example: Dashboard with multiple card blocks */
export const DASHBOARD_EXAMPLE: ISchema = {
  type: 'void',
  'x-uid': 'dashboard1',
  'x-component': 'Page',
  'x-component-props': { title: 'Dashboard' },
  properties: {
    grid: {
      type: 'void',
      'x-uid': 'grid1',
      'x-component': 'Grid',
      properties: {
        col1: {
          type: 'void',
          'x-uid': 'gridCol1',
          'x-component': 'Grid.Column',
          'x-component-props': { span: 12 },
          properties: {
            statCard: {
              type: 'void',
              'x-uid': 'statCard1',
              'x-component': 'CardItem',
              'x-component-props': { title: 'Total Users' },
              properties: {
                value: {
                  type: 'number',
                  'x-uid': 'statValue1',
                  'x-component': 'Statistic',
                  'x-component-props': { value: 1250, suffix: 'users' },
                },
              },
            },
          },
        },
        col2: {
          type: 'void',
          'x-uid': 'gridCol2',
          'x-component': 'Grid.Column',
          'x-component-props': { span: 12 },
          properties: {
            statCard2: {
              type: 'void',
              'x-uid': 'statCard2',
              'x-component': 'CardItem',
              'x-component-props': { title: 'Active Orders' },
              properties: {
                value: {
                  type: 'number',
                  'x-uid': 'statValue2',
                  'x-component': 'Statistic',
                  'x-component-props': { value: 340, suffix: 'orders' },
                },
              },
            },
          },
        },
      },
    },
  },
};

/** All examples aggregated for easy iteration / import */
export const ALL_EXAMPLES: Array<{ name: string; schema: ISchema; description: string }> = [
  {
    name: 'CRUD Table',
    schema: CRUD_TABLE_EXAMPLE,
    description: 'Table with action bar for managing records',
  },
  {
    name: 'Form',
    schema: FORM_EXAMPLE,
    description: 'Form for creating or editing records with validation',
  },
  {
    name: 'Detail',
    schema: DETAIL_EXAMPLE,
    description: 'Read-only detail view of a single record',
  },
  {
    name: 'Dashboard',
    schema: DASHBOARD_EXAMPLE,
    description: 'Dashboard with multiple card blocks in a grid layout',
  },
];
