export interface FilterOperators {
  $eq?: any;
  $ne?: any;
  $gt?: any;
  $gte?: any;
  $lt?: any;
  $lte?: any;
  $like?: string;
  $notLike?: string;
  $iLike?: string;
  $in?: any[];
  $notIn?: any[];
  $between?: [any, any];
  $notBetween?: [any, any];
  $is?: null;
  $isNot?: null;
  $contains?: any;
  $contained?: any;
  $overlap?: any[];
  $exists?: boolean;
  $empty?: boolean;
  $dateOn?: string;
  $dateBefore?: string;
  $dateAfter?: string;
}

export type FilterValue = any | FilterOperators;

export interface Filter {
  $and?: Filter[];
  $or?: Filter[];
  [field: string]: FilterValue | Filter[] | undefined;
}

export interface FindOptions {
  filter?: Filter;
  fields?: string[];
  except?: string[];
  appends?: string[];
  sort?: string[];
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
}

export interface CreateOptions {
  values: Record<string, any>;
  whitelist?: string[];
  blacklist?: string[];
  /** Sequelize transaction to participate in. */
  transaction?: any;
}

export interface UpdateOptions {
  filter?: Filter;
  filterByTk?: any;
  values: Record<string, any>;
  whitelist?: string[];
  blacklist?: string[];
  /** Sequelize transaction to participate in. */
  transaction?: any;
}

export interface DestroyOptions {
  filter?: Filter;
  filterByTk?: any;
  /** Sequelize transaction to participate in. */
  transaction?: any;
}
