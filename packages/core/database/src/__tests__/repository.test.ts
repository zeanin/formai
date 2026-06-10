import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Op } from 'sequelize';
import { Repository } from '../repository';

// ---------------------------------------------------------------------------
// Minimal model mock — only the parts Repository.buildWhere depends on
// ---------------------------------------------------------------------------
function makeMockModel() {
  return {
    rawAttributes: {
      id: { primaryKey: true },
      name: {},
      age: {},
    },
    findAll: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    findByPk: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    findAndCountAll: vi.fn().mockResolvedValue({ rows: [], count: 0 }),
    create: vi.fn().mockResolvedValue({ toJSON: () => ({}) }),
    bulkCreate: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue([0, []]),
    destroy: vi.fn().mockResolvedValue(0),
  } as any;
}

describe('Repository.buildWhere', () => {
  let repo: Repository;

  beforeEach(() => {
    repo = new Repository(makeMockModel(), {});
  });

  // -- basic cases -----------------------------------------------------------

  it('returns empty object for undefined filter', () => {
    expect(repo.buildWhere(undefined)).toEqual({});
  });

  it('returns empty object for empty filter', () => {
    expect(repo.buildWhere({})).toEqual({});
  });

  it('maps plain value to equality', () => {
    const where = repo.buildWhere({ name: 'Alice' });
    expect(where).toEqual({ name: 'Alice' });
  });

  it('maps null value to null (IS NULL shorthand)', () => {
    const where = repo.buildWhere({ deletedAt: null });
    expect(where).toEqual({ deletedAt: null });
  });

  // -- comparison operators --------------------------------------------------

  it('maps $eq', () => {
    const where = repo.buildWhere({ age: { $eq: 25 } });
    expect(where).toEqual({ age: { [Op.eq]: 25 } });
  });

  it('maps $ne', () => {
    const where = repo.buildWhere({ age: { $ne: 0 } });
    expect(where).toEqual({ age: { [Op.ne]: 0 } });
  });

  it('maps $gt', () => {
    const where = repo.buildWhere({ age: { $gt: 18 } });
    expect(where).toEqual({ age: { [Op.gt]: 18 } });
  });

  it('maps $gte', () => {
    const where = repo.buildWhere({ age: { $gte: 18 } });
    expect(where).toEqual({ age: { [Op.gte]: 18 } });
  });

  it('maps $lt', () => {
    const where = repo.buildWhere({ age: { $lt: 65 } });
    expect(where).toEqual({ age: { [Op.lt]: 65 } });
  });

  it('maps $lte', () => {
    const where = repo.buildWhere({ age: { $lte: 65 } });
    expect(where).toEqual({ age: { [Op.lte]: 65 } });
  });

  // -- string operators ------------------------------------------------------

  it('maps $like', () => {
    const where = repo.buildWhere({ name: { $like: '%alice%' } });
    expect(where).toEqual({ name: { [Op.like]: '%alice%' } });
  });

  it('maps $notLike', () => {
    const where = repo.buildWhere({ name: { $notLike: '%bot%' } });
    expect(where).toEqual({ name: { [Op.notLike]: '%bot%' } });
  });

  it('maps $iLike (case-insensitive)', () => {
    const where = repo.buildWhere({ name: { $iLike: '%alice%' } });
    expect(where).toEqual({ name: { [Op.iLike]: '%alice%' } });
  });

  // -- set operators ---------------------------------------------------------

  it('maps $in', () => {
    const where = repo.buildWhere({ status: { $in: ['active', 'pending'] } });
    expect(where).toEqual({ status: { [Op.in]: ['active', 'pending'] } });
  });

  it('maps $notIn', () => {
    const where = repo.buildWhere({ status: { $notIn: ['deleted'] } });
    expect(where).toEqual({ status: { [Op.notIn]: ['deleted'] } });
  });

  // -- range operators -------------------------------------------------------

  it('maps $between', () => {
    const where = repo.buildWhere({ age: { $between: [18, 65] } });
    expect(where).toEqual({ age: { [Op.between]: [18, 65] } });
  });

  it('maps $notBetween', () => {
    const where = repo.buildWhere({ age: { $notBetween: [0, 5] } });
    expect(where).toEqual({ age: { [Op.notBetween]: [0, 5] } });
  });

  // -- null operators --------------------------------------------------------

  it('maps $is null', () => {
    const where = repo.buildWhere({ deletedAt: { $is: null } });
    expect(where).toEqual({ deletedAt: { [Op.is]: null } });
  });

  it('maps $isNot null', () => {
    const where = repo.buildWhere({ deletedAt: { $isNot: null } });
    expect(where).toEqual({ deletedAt: { [Op.not]: null } });
  });

  // -- logical operators -----------------------------------------------------

  it('maps $and array', () => {
    const where = repo.buildWhere({
      $and: [{ age: { $gte: 18 } }, { age: { $lte: 65 } }],
    });
    expect(where).toEqual({
      [Op.and]: [{ age: { [Op.gte]: 18 } }, { age: { [Op.lte]: 65 } }],
    });
  });

  it('maps $or array', () => {
    const where = repo.buildWhere({
      $or: [{ name: 'Alice' }, { name: 'Bob' }],
    });
    expect(where).toEqual({
      [Op.or]: [{ name: 'Alice' }, { name: 'Bob' }],
    });
  });

  it('combines multiple top-level field conditions', () => {
    const where = repo.buildWhere({ name: 'Alice', age: { $gte: 18 } });
    expect(where).toEqual({
      name: 'Alice',
      age: { [Op.gte]: 18 },
    });
  });

  // -- dot-notation (association path) --------------------------------------

  it('converts dot-notation field to $assoc.field$ syntax', () => {
    const where = repo.buildWhere({ 'profile.city': 'Tokyo' });
    expect(where).toEqual({ '$profile.city$': 'Tokyo' });
  });

  it('converts dot-notation with operator', () => {
    const where = repo.buildWhere({ 'profile.age': { $gt: 20 } });
    expect(where).toEqual({ '$profile.age$': { [Op.gt]: 20 } });
  });

  // -- edge cases ------------------------------------------------------------

  it('ignores undefined values in filter', () => {
    const where = repo.buildWhere({ name: undefined, age: 30 });
    expect(where).toEqual({ age: 30 });
  });

  it('handles nested $and + $or', () => {
    const where = repo.buildWhere({
      $or: [
        { $and: [{ age: { $gte: 18 } }, { age: { $lte: 25 } }] },
        { name: 'Admin' },
      ],
    });
    expect(where).toEqual({
      [Op.or]: [
        {
          [Op.and]: [{ age: { [Op.gte]: 18 } }, { age: { [Op.lte]: 25 } }],
        },
        { name: 'Admin' },
      ],
    });
  });
});
