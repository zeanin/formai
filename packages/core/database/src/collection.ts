import {
  ModelStatic,
  Model,
  DataTypes,
  ModelAttributes,
  ModelOptions,
  IndexesOptions,
} from 'sequelize';
import { CollectionOptions, FieldOptions, RelationType } from '@formai/shared';
import { Repository } from './repository';

const RELATION_TYPES: Set<string> = new Set<RelationType>([
  'belongsTo',
  'hasOne',
  'hasMany',
  'belongsToMany',
]);

export class Collection {
  name: string;
  options: CollectionOptions;
  model!: ModelStatic<Model>;
  private db: any; // Database reference
  private fields: Map<string, FieldOptions> = new Map();
  private _repository?: Repository<any>;

  constructor(options: CollectionOptions, db: any) {
    this.name = options.name;
    this.options = options;
    this.db = db;

    // Index fields
    for (const field of options.fields ?? []) {
      this.fields.set(field.name, field);
    }

    this.model = this.buildModel();
  }

  // ---------------------------------------------------------------------------
  // Model building
  // ---------------------------------------------------------------------------

  private buildModel(): ModelStatic<Model> {
    const attributes: ModelAttributes = {};

    for (const field of this.options.fields ?? []) {
      // Skip relation fields — handled in setupRelations()
      if (RELATION_TYPES.has(field.type as string)) continue;

      const colDef: any = {
        ...Collection.mapFieldType(field),
      };

      if (field.primaryKey !== undefined) colDef.primaryKey = field.primaryKey;
      if (field.autoIncrement !== undefined)
        colDef.autoIncrement = field.autoIncrement;
      if (field.allowNull !== undefined) colDef.allowNull = field.allowNull;
      if (field.unique !== undefined) colDef.unique = field.unique;
      if (field.comment !== undefined) colDef.comment = field.comment;
      if (field.defaultValue !== undefined) {
        // Map string sentinel 'UUIDV4' to Sequelize's DataTypes.UUIDV4
        colDef.defaultValue = field.defaultValue === 'UUIDV4' ? DataTypes.UUIDV4 : field.defaultValue;
      }

      attributes[field.name] = colDef;
    }

    // Default primary key if none specified
    if (!Object.values(attributes).some((a: any) => a.primaryKey)) {
      attributes['id'] = {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      };
    }

    const indexes: IndexesOptions[] = [];

    // Field-level index hints
    for (const field of this.options.fields ?? []) {
      if (field.index && !RELATION_TYPES.has(field.type as string)) {
        indexes.push({ fields: [field.name] });
      }
    }

    // Collection-level index definitions
    for (const idx of this.options.indexes ?? []) {
      const entry: IndexesOptions = {
        fields: idx.fields,
        unique: idx.unique,
        name: idx.name,
      };
      if (idx.type) (entry as any).using = idx.type;
      indexes.push(entry);
    }

    const modelOptions: ModelOptions = {
      tableName: this.options.tableName ?? this.options.name,
      timestamps: this.options.timestamps !== false, // default true
      paranoid: this.options.paranoid ?? false,
      comment: this.options.comment,
      indexes,
      underscored: false,
    };

    return this.db.sequelize.define(this.options.name, attributes, modelOptions);
  }

  // ---------------------------------------------------------------------------
  // Field type mapping
  // ---------------------------------------------------------------------------

  static mapFieldType(field: FieldOptions): { type: any; defaultValue?: any } {
    switch (field.type) {
      case 'string':
        return { type: DataTypes.STRING(field.length ?? 255) };

      case 'text':
        return { type: DataTypes.TEXT };

      case 'integer':
        return { type: DataTypes.INTEGER };

      case 'float':
        return { type: DataTypes.FLOAT };

      case 'double':
        return { type: DataTypes.DOUBLE };

      case 'decimal':
        return {
          type: DataTypes.DECIMAL(field.precision ?? 10, field.scale ?? 2),
        };

      case 'boolean':
        return { type: DataTypes.BOOLEAN };

      case 'date':
      case 'datetime':
        return { type: DataTypes.DATE };

      case 'json':
      case 'jsonb':
        return { type: DataTypes.JSONB };

      case 'uuid':
        return {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
        };

      case 'array':
        return { type: DataTypes.ARRAY(DataTypes.STRING) };

      case 'password':
        // Stored as VARCHAR; hashing handled by PasswordFieldHandler hooks
        return { type: DataTypes.STRING(255) };

      case 'enum':
        return { type: DataTypes.ENUM(...(field.values ?? [])) };

      case 'virtual':
        return { type: DataTypes.VIRTUAL };

      default:
        // Fallback for unknown types
        return { type: DataTypes.STRING(255) };
    }
  }

  // ---------------------------------------------------------------------------
  // Field management
  // ---------------------------------------------------------------------------

  getField(name: string): FieldOptions | undefined {
    return this.fields.get(name);
  }

  getFields(): FieldOptions[] {
    return Array.from(this.fields.values());
  }

  hasField(name: string): boolean {
    return this.fields.has(name);
  }

  addField(field: FieldOptions): void {
    this.fields.set(field.name, field);
    // Re-build model to include new field (or use model.rawAttributes mutation)
    this.model = this.buildModel();
    this._repository = undefined;
  }

  removeField(name: string): void {
    this.fields.delete(name);
    this.model = this.buildModel();
    this._repository = undefined;
  }

  // ---------------------------------------------------------------------------
  // Relations
  // ---------------------------------------------------------------------------

  /**
   * Must be called after ALL collections have been defined so that target
   * models are available when setting up associations.
   */
  setupRelations(): void {
    for (const field of this.options.fields ?? []) {
      if (!RELATION_TYPES.has(field.type as string)) continue;

      const targetCollection = this.db.getCollection(field.target!);
      if (!targetCollection) {
        console.warn(
          `[Collection] setupRelations: target collection "${field.target}" not found for field "${this.name}.${field.name}"`,
        );
        continue;
      }

      const targetModel = targetCollection.model;
      let asName = field.name;
      let fkName = field.foreignKey;
      if (fkName === 'id' && field.type === 'belongsTo') {
        fkName = undefined;
      }

      if (field.type === 'belongsTo') {
        // Resolve naming collision when foreignKey name and association alias are the same.
        // E.g. field name is 'customer_id' and we want it to map to foreignKey 'customer_id' and association alias 'customer'.
        fkName = fkName || (field.name.endsWith('_id') ? field.name : `${field.name}_id`);
        if (asName === fkName) {
          asName = asName.replace(/_id$/, '');
        }
      }

      // Skip duplicate associations (e.g. if setupRelations() is called multiple times on startup)
      if (this.model.associations[asName]) {
        continue;
      }

      const assocOptions: any = {
        as: asName,
        foreignKey: fkName,
        onDelete: field.onDelete,
        onUpdate: field.onUpdate,
      };

      switch (field.type as RelationType) {
        case 'belongsTo':
          if (field.targetKey) assocOptions.targetKey = field.targetKey;
          this.model.belongsTo(targetModel, assocOptions);
          break;

        case 'hasOne':
          if (field.sourceKey) assocOptions.sourceKey = field.sourceKey;
          this.model.hasOne(targetModel, assocOptions);
          break;

        case 'hasMany':
          if (field.sourceKey) assocOptions.sourceKey = field.sourceKey;
          this.model.hasMany(targetModel, assocOptions);
          break;

        case 'belongsToMany': {
          if (!field.through) {
            console.warn(
              `[Collection] belongsToMany "${this.name}.${field.name}" missing "through" option`,
            );
            break;
          }
          assocOptions.through = field.through;
          if (field.sourceKey) assocOptions.sourceKey = field.sourceKey;
          if (field.targetKey) assocOptions.targetKey = field.targetKey;
          this.model.belongsToMany(targetModel, assocOptions);
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Repository accessor
  // ---------------------------------------------------------------------------

  get repository(): Repository<any> {
    if (!this._repository) {
      this._repository = new Repository(this.model, this);
    }
    return this._repository;
  }

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------

  async sync(options?: { force?: boolean; alter?: boolean; transaction?: any }): Promise<void> {
    await this.model.sync({
      force: options?.force ?? false,
      alter: options?.alter ?? false,
      ...(options?.transaction ? { transaction: options.transaction } : {}),
    });
  }
}
