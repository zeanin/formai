import { Sequelize, DataTypes, ModelStatic, Model } from 'sequelize';

/**
 * Defines the meta-tables that store collection and field definitions.
 * These are the "system tables" that describe all user-defined tables.
 */
export function defineMetaCollections(sequelize: Sequelize): {
  CollectionModel: ModelStatic<Model>;
  FieldModel: ModelStatic<Model>;
} {
  // Return cached models if already defined on this sequelize instance
  if (sequelize.isDefined('collections') && sequelize.isDefined('fields')) {
    return {
      CollectionModel: sequelize.model('collections'),
      FieldModel: sequelize.model('fields'),
    };
  }
  /**
   * collections: stores collection (table) definitions
   */
  const CollectionModel = sequelize.define(
    'collections',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
        comment: 'Unique collection name (used as table name)',
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Human-readable display title',
      },
      options: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Full CollectionOptions as JSON (excluding name/title)',
      },
    },
    {
      tableName: 'collections_meta',
      timestamps: true,
      comment: 'System table: stores all user-defined collection definitions',
    },
  );

  /**
   * fields: stores field definitions per collection
   */
  const FieldModel = sequelize.define(
    'fields',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      collectionName: {
        type: DataTypes.STRING(128),
        allowNull: false,
        comment: 'References collections.name',
      },
      name: {
        type: DataTypes.STRING(128),
        allowNull: false,
        comment: 'Field name',
      },
      type: {
        type: DataTypes.STRING(64),
        allowNull: false,
        comment: 'Field type (string, integer, belongsTo, etc.)',
      },
      options: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Full FieldOptions as JSON',
      },
      sort: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: 'Display/definition order',
      },
    },
    {
      tableName: 'fields_meta',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['collectionName', 'name'],
          name: 'uq_fields_meta_collection_name',
        },
      ],
      comment: 'System table: stores all user-defined field definitions',
    },
  );

  // Association: a collection has many fields
  CollectionModel.hasMany(FieldModel, {
    foreignKey: 'collectionName',
    sourceKey: 'name',
    as: 'fields',
  });
  FieldModel.belongsTo(CollectionModel, {
    foreignKey: 'collectionName',
    targetKey: 'name',
    as: 'collection',
  });

  return { CollectionModel, FieldModel };
}
