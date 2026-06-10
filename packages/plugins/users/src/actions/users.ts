import { Context, Next } from 'koa';
import { hashPassword } from '@formai/auth';

/**
 * Register a new user. Hashes the password before storing.
 */
export async function register(ctx: Context, next: Next): Promise<void> {
  const repo = (ctx as any).app.db.getRepository('users');
  const { values } = (ctx as any).action.params;

  if (!values?.username || !values?.password) {
    ctx.status = 400;
    ctx.body = { errors: [{ message: 'Username and password are required', code: 'VALIDATION_ERROR' }] };
    return;
  }

  // Check if username already exists
  const existing = await repo.findOne({ filter: { username: values.username } });
  if (existing) {
    ctx.status = 409;
    ctx.body = { errors: [{ message: 'Username already exists', code: 'CONFLICT' }] };
    return;
  }

  // Check email uniqueness if provided
  if (values.email) {
    const existingEmail = await repo.findOne({ filter: { email: values.email } });
    if (existingEmail) {
      ctx.status = 409;
      ctx.body = { errors: [{ message: 'Email already exists', code: 'CONFLICT' }] };
      return;
    }
  }

  // Hash the password
  const hashedPassword = await hashPassword(values.password);

  // Create the user (exclude password from whitelist — it's handled separately)
  const record = await repo.create({
    values: {
      username: values.username,
      email: values.email || null,
      phone: values.phone || null,
      nickname: values.nickname || values.username,
      password: hashedPassword,
      status: values.status || 'active',
    },
    blacklist: ['password'], // Don't return password in response
  });

  // Remove password from response
  const { password: _, ...safeRecord } = record as any;
  ctx.status = 201;
  ctx.body = { data: safeRecord };
  await next();
}

/**
 * Get the current authenticated user's profile.
 */
export async function profile(ctx: Context, next: Next): Promise<void> {
  const currentUser = (ctx as any).state?.currentUser;

  if (!currentUser) {
    ctx.status = 401;
    ctx.body = { errors: [{ message: 'Authentication required', code: 'UNAUTHORIZED' }] };
    return;
  }

  // Fetch fresh user data
  const repo = (ctx as any).app.db.getRepository('users');
  const user = await repo.findById(currentUser.id);

  if (!user) {
    ctx.status = 404;
    ctx.body = { errors: [{ message: 'User not found', code: 'NOT_FOUND' }] };
    return;
  }

  // Remove password from response
  const { password: _, ...safeUser } = user as any;
  ctx.body = { data: safeUser };
  await next();
}

/**
 * Update the current user's profile.
 */
export async function updateProfile(ctx: Context, next: Next): Promise<void> {
  const currentUser = (ctx as any).state?.currentUser;
  const { values } = (ctx as any).action.params;

  if (!currentUser) {
    ctx.status = 401;
    ctx.body = { errors: [{ message: 'Authentication required', code: 'UNAUTHORIZED' }] };
    return;
  }

  const repo = (ctx as any).app.db.getRepository('users');

  // Only allow updating safe fields
  const safeValues: Record<string, any> = {};
  if (values?.nickname !== undefined) safeValues.nickname = values.nickname;
  if (values?.email !== undefined) safeValues.email = values.email;
  if (values?.phone !== undefined) safeValues.phone = values.phone;

  // If password change requested, hash the new password
  if (values?.password) {
    safeValues.password = await hashPassword(values.password);
  }

  const updated = await repo.update({
    filterByTk: currentUser.id,
    values: safeValues,
    blacklist: ['password'],
  });

  const safeResults = (updated as any[]).map(({ password: _, ...rest }: any) => rest);
  ctx.body = { data: safeResults };
  await next();
}
