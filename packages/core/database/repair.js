const { Client } = require('pg');

const slugify = (text) => {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50);
};

const generateFormFields = (fields, collectionName) => {
  const properties = {};
  if (fields && fields.length > 0) {
    fields.forEach((f) => {
      if (f.name !== 'id' && f.name !== 'createdAt' && f.name !== 'updatedAt') {
        const nameLower = f.name.toLowerCase();
        let widget = 'Input';
        let widgetProps = {};

        if (f.type === 'float' || f.type === 'integer' || nameLower.includes('amount') || nameLower.includes('price')) {
          widget = 'AmountInput';
          widgetProps = { precision: 2, currency: 'CNY' };
        } else if (f.type === 'date' || f.type === 'datetime' || nameLower.includes('date') || nameLower.includes('at')) {
          widget = 'DatePicker';
          if (f.type === 'datetime' || nameLower.includes('time')) {
            widgetProps = { showTime: true };
          }
        } else if (nameLower.includes('status') || nameLower.includes('state')) {
          widget = 'Select';
          widgetProps = {
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Pending', value: 'pending' },
              { label: 'Draft', value: 'draft' },
              { label: 'Inactive', value: 'inactive' },
            ]
          };
        } else if (f.type === 'boolean') {
          widget = 'Switch';
        }

        properties[f.name] = {
          type: f.type === 'integer' || f.type === 'float' ? 'number' : f.type === 'boolean' ? 'boolean' : 'string',
          'x-uid': `field_${f.name}_${Math.random().toString(36).slice(2, 6)}`,
          title: f.title || f.name,
          'x-decorator': 'FormItem',
          'x-component': widget,
          'x-component-props': widgetProps,
        };
      }
    });
  } else {
    properties['name'] = {
      type: 'string',
      'x-uid': `field_name_${Math.random().toString(36).slice(2, 6)}`,
      title: 'Name',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
    };
  }

  // Add submit action
  properties['actions'] = {
    type: 'void',
    'x-uid': `formActions_${Math.random().toString(36).slice(2, 6)}`,
    'x-component': 'Space',
    style: { marginTop: 24, display: 'flex', justifyContent: 'flex-end' },
    properties: {
      submit: {
        type: 'void',
        'x-uid': `actionSubmit_${Math.random().toString(36).slice(2, 6)}`,
        'x-component': 'Action',
        'x-component-props': { title: 'Submit', type: 'primary', htmlType: 'submit' },
      },
    },
  };

  return properties;
};

const generateDefaultPageSchema = (title, collectionName, fields) => {
  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
  ];

  if (fields && fields.length > 0) {
    fields.forEach((f) => {
      if (f.name !== 'id') {
        const colProps = {
          title: f.title || f.name,
          dataIndex: f.name,
          key: f.name,
        };
        const nameLower = f.name.toLowerCase();
        if (f.type === 'float' || f.type === 'integer' || nameLower.includes('amount') || nameLower.includes('price')) {
          colProps.render = 'Amount';
        } else if (f.type === 'date' || f.type === 'datetime' || nameLower.includes('date') || nameLower.includes('at')) {
          colProps.render = 'DateTime';
        } else if (nameLower.includes('status') || nameLower.includes('state')) {
          colProps.render = 'Badge';
        }
        columns.push(colProps);
      }
    });
  } else {
    columns.push({ title: 'Name', dataIndex: 'name', key: 'name' });
  }

  columns.push({ title: 'Created At', dataIndex: 'createdAt', key: 'createdAt' });

  return {
    type: 'void',
    'x-uid': `page_${slugify(title)}_${Math.random().toString(36).slice(2, 6)}`,
    'x-component': 'Page',
    'x-component-props': { title },
    properties: {
      grid: {
        type: 'void',
        'x-uid': `grid_${slugify(title)}`,
        'x-component': 'Grid',
        properties: {
          col1: {
            type: 'void',
            'x-uid': `gridCol_${slugify(title)}_1`,
            'x-component': 'Grid.Column',
            'x-component-props': { span: 24 },
            properties: {
              tableCard: {
                type: 'void',
                'x-uid': `card_${slugify(title)}`,
                'x-component': 'CardItem',
                'x-component-props': { title: `${title} List` },
                properties: collectionName ? {
                  actionBar: {
                    type: 'void',
                    'x-uid': `actionBar_${slugify(title)}`,
                    'x-component': 'Space',
                    style: { marginBottom: 16 },
                    properties: {
                      create: {
                        type: 'void',
                        'x-uid': `actionCreate_${slugify(title)}`,
                        'x-component': 'ActionDrawer',
                        'x-component-props': { 
                          title: 'Add New', 
                          triggerType: 'primary',
                          drawerTitle: `Create ${title}`,
                          width: 520,
                        },
                        properties: {
                          form: {
                            type: 'object',
                            'x-uid': `form_${slugify(title)}`,
                            'x-component': 'Form',
                            'x-component-props': {
                              collection: collectionName,
                              layout: 'vertical',
                            },
                            properties: generateFormFields(fields, collectionName),
                          },
                        },
                      },
                      delete: {
                        type: 'void',
                        'x-uid': `actionDelete_${slugify(title)}`,
                        'x-component': 'Action',
                        'x-component-props': { 
                          title: 'Delete', 
                          danger: true,
                          confirmTitle: 'Are you sure you want to delete selected records?',
                        },
                      },
                    },
                  },
                  table: {
                    type: 'array',
                    'x-uid': `table_${slugify(title)}`,
                    'x-component': 'Table',
                    'x-component-props': {
                      collection: collectionName,
                      rowKey: 'id',
                      columns,
                    },
                  },
                } : {
                  empty: {
                    type: 'void',
                    'x-component': 'Empty',
                    'x-component-props': { description: 'This page is ready for custom content!' },
                  }
                },
              },
            },
          },
        },
      },
    },
  };
};

const semanticMap = {
  '采购': ['purchase', 'supplier', 'procure'],
  '销售': ['sale', 'customer', 'customer_id'],
  '库存': ['inventory', 'product', 'warehouse', 'stock'],
  '物流': ['shipping', 'logistics', 'delivery', 'transport'],
  '财务': ['financial', 'account', 'journal', 'billing', 'invoice'],
};

async function main() {
  const client = new Client({
    connectionString: 'postgresql://landaa@localhost:5432/formai'
  });

  await client.connect();
  console.log('Connected to formai DB successfully using native pg.');

  // 1. Fetch collections metadata
  const { rows: collections } = await client.query('SELECT * FROM collections_meta WHERE "appId" = \'erp\';');
  // 2. Fetch fields metadata
  const { rows: fields } = await client.query('SELECT * FROM fields_meta;');
  // 3. Fetch ui_schemas for erp
  const { rows: uiSchemas } = await client.query('SELECT * FROM ui_schemas WHERE "appId" = \'erp\';');

  console.log(`Fetched ${collections.length} collections and ${uiSchemas.length} UI schemas.`);

  // Group fields by collectionName
  const fieldsByCollection = {};
  fields.forEach(f => {
    if (!fieldsByCollection[f.collectionName]) {
      fieldsByCollection[f.collectionName] = [];
    }
    fieldsByCollection[f.collectionName].push({
      name: f.name,
      type: f.type,
      title: f.options?.title || f.name
    });
  });

  // Re-match and update each ui_schema
  for (const uiSchema of uiSchemas) {
    const pageTitle = uiSchema.title;
    if (pageTitle === '仪表盘' || pageTitle === '系统设置') {
      console.log(`Skipping static page: ${pageTitle}`);
      continue;
    }

    // Find the best matching collection
    let matchedCol = collections[0]?.name;
    let matchedColFields = fieldsByCollection[matchedCol] || [];
    let bestScore = -1;

    for (const bCol of collections) {
      const titleLower = pageTitle.toLowerCase();
      const bColTitleLower = (bCol.title || '').toLowerCase();
      const bColNameLower = (bCol.name || '').toLowerCase();
      const rawNameLower = bCol.name.replace('app_erp_', '').toLowerCase();

      let score = 0;
      if (titleLower === bColTitleLower) {
        score += 1000;
      }
      if (titleLower.includes(bColTitleLower) || bColTitleLower.includes(titleLower)) {
        score += 500;
      }
      if (titleLower.includes(bColNameLower) || bColNameLower.includes(titleLower)) {
        score += 200;
      }
      if (titleLower.includes(rawNameLower) || rawNameLower.includes(titleLower)) {
        score += 100;
      }

      // Check character overlap
      const cleanTitle = titleLower.replace(/管理|列表|查询|页面|app/gi, '');
      const cleanBColTitle = bColTitleLower.replace(/管理|列表|查询|页面|app/gi, '');
      if (cleanTitle && cleanBColTitle) {
        const overlapCount = [...cleanTitle].filter(char => cleanBColTitle.includes(char)).length;
        if (overlapCount > 0) {
          score += overlapCount * 50;
        }
      }

      // Apply English-Chinese semantic map bonuses
      for (const [cnTerm, enTerms] of Object.entries(semanticMap)) {
        if (pageTitle.includes(cnTerm)) {
          enTerms.forEach(enTerm => {
            if (bColNameLower.includes(enTerm) || bColTitleLower.includes(enTerm)) {
              if (rawNameLower.includes('order') || rawNameLower.includes('transaction') || rawNameLower.includes('document') || rawNameLower.includes('entry')) {
                score += 1500; // High priority for transactions/documents
              } else if (rawNameLower === `${enTerm}s` || rawNameLower === enTerm || rawNameLower.includes(enTerm)) {
                score += 800;
              } else {
                score += 300;
              }
            }
          });
        }
      }

      if (score > bestScore) {
        bestScore = score;
        matchedCol = bCol.name;
        matchedColFields = fieldsByCollection[bCol.name] || [];
      }
    }

    console.log(`Matching Page "${pageTitle}" -> Table "${matchedCol}" (Score: ${bestScore}) with ${matchedColFields.length} custom columns.`);

    const newSchema = generateDefaultPageSchema(pageTitle, matchedCol, matchedColFields);
    
    // Update using native PostgreSQL $1, $2 placeholders
    await client.query(
      'UPDATE ui_schemas SET schema = $1, "updatedAt" = NOW() WHERE uid = $2;',
      [JSON.stringify(newSchema), uiSchema.uid]
    );
    console.log(`Successfully updated ui_schema row for "${pageTitle}".`);
  }

  await client.end();
  console.log('Database repair completed successfully.');
}

main().catch(console.error);
