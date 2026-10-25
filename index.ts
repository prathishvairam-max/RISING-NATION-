import { router, json, error, auth, db, secrets, storage } from '@appdeploy/sdk';
type Actor = { userId: string; email?: string; name?: string; scope: string };
const tables: Record<string, string> = {
  cards: 'rn_cards',
  discord: 'rn_cards',
  minecraft: 'rn_cards',
  bots: 'rn_cards',
  apps: 'rn_pages',
  websites: 'rn_pages',
  offers: 'rn_offers',
  events: 'rn_events',
  announcements: 'rn_announcements',
  services: 'rn_services',
  staff: 'rn_staff',
  videos: 'rn_videos',
  pages: 'rn_pages',
  posts: 'rn_posts',
  'project-inquiries': 'rn_project_inquiries',
  'staff-applications': 'rn_staff_applications',
};
const str = (v: unknown, n = 4000) =>
  typeof v === 'string' ? v.trim().slice(0, n) : '';
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const who = async (e: any): Promise<Actor | null> => auth.getUser(e);
async function profile(a: Actor) {
  const [u] = await db.get<any>('rn_users', [a.userId], { consistent: true });
  if (u) return u;
  const [id] = await db.tx.add('rn_users', [
    {
      id: a.userId,
      userId: a.userId,
      name: a.name || 'Member',
      email: a.email || '',
      role: 'member',
      permissions: [],
      suspended: false,
    },
  ]);
  if (id)
    return {
      userId: a.userId,
      role: 'member',
      permissions: [],
      suspended: false,
    };
  const [v] = await db.get<any>('rn_users', [a.userId], { consistent: true });
  return v;
}
async function info(a: Actor) {
  const u = await profile(a);
  if (!u || u.suspended)
    return { user: u, role: 'none', permissions: [] as string[] };
  const [o] = await db.get<any>('rn_owner', ['primary'], { consistent: true });
  if (o?.userId === a.userId)
    return { user: u, role: 'owner', permissions: ['*'] };
  return {
    user: u,
    role: u.role === 'staff' ? 'staff' : 'member',
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
  };
}
async function can(a: Actor, p: string) {
  const x = await info(a);
  return (
    x.role === 'owner' ||
    (x.role === 'staff' &&
      (x.permissions.includes('*') || x.permissions.includes(p)))
  );
}
async function list(k: string, limit = 50) {
  const t = tables[k];
  if (!t) throw new Error('Unknown collection');
  const r = await db.list<any>(t, { limit });
  const visible = r.items.filter(
    x => !['draft', 'archived', 'hidden'].includes(x.status)
  );
  return Promise.all(visible.map(async (item: any) => {
    if (!item.imagePath) return item;
    try {
      const [asset] = await storage.url([item.imagePath]);
      return { ...item, image: asset?.url || item.image || '' };
    } catch { return item; }
  }));
}
async function audit(a: Actor, action: string, detail: string) {
  try {
    await db.add('rn_audit_logs', [
      {
        actorId: a.userId,
        actorName: a.name || a.email || 'Account',
        action,
        detail: detail.slice(0, 200),
        createdAt: new Date().toISOString(),
      },
    ]);
  } catch {}
}
const routes: Record<string, any[]> = {
  'POST /api/upload-image': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in required.', 401);
      if ((await info(a)).role !== 'owner') return error('Owner permission required.', 403);
      const b = obj(ctx.body);
      const data = str(b.data, 7_000_000);
      const contentType = str(b.contentType, 80).toLowerCase();
      const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
      if (!allowed.includes(contentType)) return error('Use PNG, JPG, WEBP, or GIF images.', 400);
      if (!data || data.length > 6_500_000) return error('Image is too large. Please use an image under about 4 MB.', 413);
      const comma = data.indexOf(',');
      const clean = data.startsWith('data:') && comma >= 0 ? data.slice(comma + 1) : data;
      if (!/^[A-Za-z0-9+/=]+$/.test(clean)) return error('Invalid image data.', 400);
      const ext = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
      const path = 'community-images/' + a.userId.replace(/[^a-zA-Z0-9-]/g, '') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const [ok] = await storage.write([{ path, content: clean, contentType }]);
      if (!ok) return error('Image upload failed. Try a smaller image.', 500);
      const [asset] = await storage.url([path]);
      await audit(a, 'image.upload', path);
      return json({ path, url: asset?.url || '' }, 201);
    },
  ],
  'POST /api/metrics/view': [
    async (ctx: any) => {
      const b = obj(ctx.body);
      const page = str(b.page, 100) || 'home';
      const [id] = await db.add('rn_page_views', [{ page, createdAt: new Date().toISOString() }]);
      return json({ recorded: Boolean(id) }, id ? 201 : 500);
    },
  ],
  'GET /api/_healthcheck': [
    async () => json({ ok: true, service: 'rising-nation' }),
  ],
  'GET /api/public': [
    async () => {
      const [storedSettings] = await db.get<any>('rn_settings', ['site']);
      const settings: Record<string, any> = { ...(storedSettings || {}) };
      for (const key of Object.keys(settings)) {
        if (key.endsWith('Image') && typeof settings[key] === 'string' && settings[key].startsWith('community-images/')) {
          try { const [asset] = await storage.url([settings[key]]); settings[key] = asset?.url || ''; } catch { settings[key] = ''; }
        }
      }
      const content: Record<string, unknown> = {};
      for (const k of [
        'cards',
        'offers',
        'events',
        'announcements',
        'services',
        'staff',
        'videos',
        'pages',
        'posts',
        'discord', 'minecraft', 'bots', 'apps', 'websites',
      ]) {
        try {
          content[k] = await list(k, k === 'posts' ? 40 : 50);
        } catch {
          content[k] = [];
        }
      }
      return json({ settings: settings || {}, content });
    },
  ],
  'GET /api/me': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in is required.', 401);
      const x = await info(a);
      if (x.role === 'none') return error('Account suspended.', 403);
      return json({
        user: {
          userId: a.userId,
          name: a.name || x.user?.name || 'Member',
          email: a.email,
        },
        role: x.role,
        permissions: x.permissions,
      });
    },
  ],
  'POST /api/owner/claim': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in before owner setup.', 401);
      const code = str(obj(ctx.body).code, 300);
      if (code.length < 8) return error('Enter the owner setup code.', 400);
      const names = await secrets.listSecretNames();
      if (!names.includes('OWNER_SETUP_CODE'))
        return error(
          'Owner setup is not configured in encrypted AppDeploy secrets.',
          503
        );
      if (code !== (await secrets.readSecret('OWNER_SETUP_CODE')))
        return error('Owner setup code is invalid.', 403);
      const [old] = await db.get<any>('rn_owner', ['primary'], {
        consistent: true,
      });
      if (old && old.userId !== a.userId)
        return error('Owner has already been claimed.', 409);
      if (!old) {
        const [id] = await db.tx.add('rn_owner', [
          {
            id: 'primary',
            userId: a.userId,
            claimedAt: new Date().toISOString(),
          },
        ]);
        if (!id) {
          const [race] = await db.get<any>('rn_owner', ['primary'], {
            consistent: true,
          });
          if (race?.userId !== a.userId)
            return error('Owner has already been claimed.', 409);
        }
      }
      await audit(a, 'owner.claim', 'Owner access activated');
      return json({ role: 'owner', claimed: true });
    },
  ],
  'PUT /api/settings': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in required.', 401);
      if ((await info(a)).role !== 'owner')
        return error('Owner permission required.', 403);
      const b = obj(ctx.body),
        allowed = [
          'name',
          'tagline',
          'description',
          'heroBadge',
          'footer',
          'minecraftName',
          'minecraftIp',
          'minecraftPort',
          'minecraftEdition',
          'minecraftVersion',
          'minecraftStatus',
          'minecraftDescription',
          'minecraftInstructions',
          'minecraftRules',
          'discordUrl',
          'youtubeUrl',
          'youtubeName',
          'youtubeDescription',
          'heroImage', 'minecraftImage', 'discordImage', 'youtubeImage',
          'offersImage', 'servicesImage', 'eventsImage', 'announcementsImage',
          'communityImage', 'staffImage', 'botsImage', 'appsImage', 'websitesImage',
        ];
      const patch: Record<string, unknown> = {};
      for (const k of allowed)
        if (b[k] !== undefined) {
          const v = str(
            b[k],
            [
              'description',
              'minecraftDescription',
              'minecraftInstructions',
              'minecraftRules',
            ].includes(k)
              ? 4000
              : 500
          );
          if (
            ['discordUrl', 'youtubeUrl'].includes(k) &&
            v &&
            !/^https:\/\//i.test(v)
          )
            return error('External links must use HTTPS.', 400);
          if (
            k === 'minecraftStatus' &&
            !['ONLINE', 'OFFLINE', 'MAINTENANCE', 'UNKNOWN'].includes(
              v.toUpperCase()
            )
          )
            return error('Invalid manual server status.', 400);
          patch[k] = k === 'minecraftStatus' ? v.toUpperCase() : v;
        }
      if (!Object.keys(patch).length)
        return error('No supported settings supplied.', 400);
      const [old] = await db.get<any>('rn_settings', ['site'], {
        consistent: true,
      });
      const record = {
        ...(old || {}),
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      if (old) {
        const [ok] = await db.tx.update(
          'rn_settings',
          [{ id: 'site', record }],
          { patch: false }
        );
        if (!ok) return error('Settings could not be saved.', 500);
      } else {
        const [id] = await db.tx.add('rn_settings', [
          { id: 'site', ...record },
        ]);
        if (!id) return error('Settings could not be initialized.', 500);
      }
      await audit(a, 'settings.update', Object.keys(patch).join(','));
      return json({ saved: true, settings: record });
    },
  ],
  'POST /api/private/project-inquiries': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in to submit a private inquiry.', 401);
      const b = obj(ctx.body),
        title = str(b.title, 180),
        description = str(b.description, 5000);
      if (!title || !description)
        return error('Project title and description are required.', 400);
      const [id] = await db.add('rn_project_inquiries', [
        {
          title,
          description,
          budget: str(b.budget, 100),
          deadline: str(b.deadline, 120),
          contact: str(b.contact, 300),
          ownerId: a.userId,
          status: 'new',
          createdAt: new Date().toISOString(),
        },
      ]);
      return id
        ? json({ id, status: 'received' }, 201)
        : error('Could not save inquiry.', 500);
    },
  ],
  'POST /api/private/staff-applications': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in to submit an application.', 401);
      const b = obj(ctx.body);
      if (!str(b.displayName, 120) || !str(b.experience, 5000))
        return error('Display name and experience are required.', 400);
      const [id] = await db.add('rn_staff_applications', [
        {
          displayName: str(b.displayName, 120),
          preferredRole: str(b.preferredRole, 120),
          experience: str(b.experience, 5000),
          availability: str(b.availability, 500),
          portfolio: str(b.portfolio, 1000),
          ownerId: a.userId,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ]);
      return id
        ? json({ id, status: 'received' }, 201)
        : error('Could not save application.', 500);
    },
  ],
  'GET /api/private/:collection': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in required.', 401);
      const k = ctx.params.collection;
      if (!['project-inquiries', 'staff-applications'].includes(k))
        return error('Unknown collection.', 404);
      if (!(await can(a, 'review_private_submissions')))
        return error('Permission denied.', 403);
      return json(
        (
          await db.list<any>(
            k === 'project-inquiries'
              ? 'rn_project_inquiries'
              : 'rn_staff_applications',
            { limit: 60 }
          )
        ).items
      );
    },
  ],
  'GET /api/staff/permissions': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in required.', 401);
      if (!(await can(a, 'manage_staff')))
        return error('Permission denied.', 403);
      return json(
        (await db.list<any>('rn_users', { limit: 100 })).items.map(
          ({ userId, name, email, role, permissions, suspended }) => ({
            userId,
            name,
            email,
            role,
            permissions,
            suspended,
          })
        )
      );
    },
  ],
  'PUT /api/staff/permissions/:userId': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in required.', 401);
      if ((await info(a)).role !== 'owner')
        return error('Owner permission required.', 403);
      if (ctx.params.userId === a.userId)
        return error('Self-role changes are disabled.', 400);
      const b = obj(ctx.body),
        role = b.role === 'staff' ? 'staff' : 'member',
        valid = [
          'moderate_posts',
          'moderate_comments',
          'review_private_submissions',
          'publish_content',
          'edit_content',
          'manage_offers',
          'manage_staff_profiles',
          'view_moderation_logs',
          'manage_reports',
          'create_events',
        ];
      const permissions = Array.isArray(b.permissions)
        ? b.permissions.filter(
            (p: unknown) => typeof p === 'string' && valid.includes(p)
          )
        : [];
      const [target] = await db.get<any>('rn_users', [ctx.params.userId], {
        consistent: true,
      });
      if (!target)
        return error(
          'Member must sign in once before access can be managed.',
          404
        );
      const [ok] = await db.tx.update(
        'rn_users',
        [
          {
            id: ctx.params.userId,
            record: { role, permissions, suspended: Boolean(b.suspended) },
            if: { userId: ctx.params.userId },
          },
        ],
        { patch: true }
      );
      if (!ok) return error('Permissions could not be saved.', 409);
      await audit(a, 'staff.permissions', ctx.params.userId);
      return json({ updated: true, role, permissions });
    },
  ],
  'GET /api/owner/dashboard': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in required.', 401);
      if ((await info(a)).role !== 'owner') return error('Owner permission required.', 403);
      const [users, views, requests] = await Promise.all([
        db.list<any>('rn_users', { limit: 1000 }),
        db.list<any>('rn_page_views', { limit: 1000 }),
        db.list<any>('rn_purchase_requests', { limit: 1000 }),
      ]);
      const staffCount = users.items.filter((u: any) => u.role === 'staff' && !u.suspended).length;
      const pending = requests.items.filter((r: any) => r.status === 'pending').length;
      return json({ users: users.items.length, staff: staffCount, pageViews: views.items.length, pending });
    },
  ],
  'GET /api/purchase-requests/mine': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in required.', 401);
      const all = await db.list<any>('rn_purchase_requests', { limit: 1000 });
      return json(all.items.filter((r: any) => r.buyerId === a.userId));
    },
  ],
  'GET /api/purchase-requests': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in required.', 401);
      if (!(await can(a, 'manage_offers'))) return error('Permission denied.', 403);
      return json((await db.list<any>('rn_purchase_requests', { limit: 1000 })).items);
    },
  ],
  'POST /api/purchase-requests': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in to submit a purchase request.', 401);
      const b = obj(ctx.body), gameId = str(b.gameId, 200);
      if (!gameId) return error('Choose a game first.', 400);
      const [game] = await db.get<any>('rn_offers', [gameId], { consistent: true });
      if (!game || ['draft', 'archived', 'hidden'].includes(game.status)) return error('This game offer is no longer available.', 404);
      const [id] = await db.add('rn_purchase_requests', [{
        buyerId: a.userId, username: a.name || 'Member', buyerEmail: a.email || '',
        gameId, gameName: str(game.title, 180) || 'Game', priceAtRequest: str(game.price, 80),
        status: 'pending', instructions: '', createdAt: new Date().toISOString(),
      }]);
      if (!id) return error('Could not save purchase request.', 500);
      await audit(a, 'purchase.request', gameId);
      return json({ id, status: 'pending' }, 201);
    },
  ],
  'PUT /api/purchase-requests/:id': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in required.', 401);
      if (!(await can(a, 'manage_offers'))) return error('Permission denied.', 403);
      const b = obj(ctx.body), status = str(b.status, 20).toLowerCase();
      if (!['approved', 'rejected'].includes(status)) return error('Status must be approved or rejected.', 400);
      const [old] = await db.get<any>('rn_purchase_requests', [ctx.params.id], { consistent: true });
      if (!old) return error('Purchase request not found.', 404);
      const record = { ...old, status, instructions: str(b.instructions, 3000), reviewedAt: new Date().toISOString(), reviewedBy: a.userId };
      const [ok] = await db.tx.update('rn_purchase_requests', [{ id: ctx.params.id, record, if: { id: ctx.params.id } }], { patch: false });
      if (!ok) return error('Could not update purchase request.', 409);
      await audit(a, 'purchase.' + status, ctx.params.id);
      return json({ updated: true, status, instructions: record.instructions });
    },
  ],
  'GET /api/audit': [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in required.', 401);
      if (!(await can(a, 'view_moderation_logs')))
        return error('Permission denied.', 403);
      return json((await db.list<any>('rn_audit_logs', { limit: 50 })).items);
    },
  ],
};
for (const k of Object.keys(tables)) {
  routes['GET /api/content/' + k] = [async () => json(await list(k))];
  routes['POST /api/content/' + k] = [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in required.', 401);
      if (!(await can(a, 'publish_content')))
        return error('Permission denied.', 403);
      const b = obj(ctx.body),
        title = str(b.title || b.name, 180),
        message = str(b.message || b.description, 5000);
      if (!title && !message)
        return error('A title or message is required.', 400);
      const record = {
        title: title || 'Community post',
        message,
        description: message,
        category: str(b.category, 80),
        image: str(b.image, 1000),
        imagePath: str(b.imagePath, 300),
        url: str(b.url, 1000),
        status: 'published',
        authorId: a.userId,
        authorName: a.name || 'Member',
        createdAt: new Date().toISOString(),
        price: str(b.price, 80),
        compareAtPrice: str(b.compareAtPrice, 80),
        offerBadge: str(b.offerBadge, 80),
        date: str(b.date, 100),
        target: str(b.target, 80),
        icon: str(b.icon, 60),
        badge: str(b.badge, 60),
      };
      const [id] = await db.add(tables[k], [record]);
      if (!id) return error('Could not save item.', 500);
      await audit(a, 'content.create', k);
      return json({ id, ...record }, 201);
    },
  ];
  routes['PUT /api/content/' + k + '/:id'] = [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in required.', 401);
      if (!(await can(a, k === 'offers' ? 'manage_offers' : 'edit_content')) && (await info(a)).role !== 'owner') return error('Permission denied.', 403);
      const [old] = await db.get<any>(tables[k], [ctx.params.id], { consistent: true });
      if (!old) return error('Item not found.', 404);
      const b = obj(ctx.body);
      const record = { ...old };
      for (const field of ['title','message','description','category','image','imagePath','url','price','compareAtPrice','offerBadge','date','target','icon','badge']) {
        if (b[field] !== undefined) record[field] = str(b[field], field === 'message' || field === 'description' ? 5000 : 1000);
      }
      if (record.url && !/^https:\/\//i.test(record.url)) return error('External links must use HTTPS.', 400);
      if (record.image && /^https?:\/\//i.test(record.image) && !/^https:\/\//i.test(record.image)) return error('Image links must use HTTPS.', 400);
      record.updatedAt = new Date().toISOString();
      const [ok] = await db.tx.update(tables[k], [{ id: ctx.params.id, record, if: { id: ctx.params.id } }], { patch: false });
      if (!ok) return error('Item could not be updated.', 409);
      await audit(a, 'content.update', k);
      return json({ updated: true, item: record });
    },
  ];
  routes['DELETE /api/content/' + k + '/:id'] = [
    async (ctx: any) => {
      const a = await who(ctx.event);
      if (!a) return error('Sign in required.', 401);
      if (!(await can(a, k === 'posts' ? 'moderate_posts' : 'publish_content')))
        return error('Permission denied.', 403);
      const [ok] = await db.delete(tables[k], [ctx.params.id]);
      if (!ok) return error('Item not found.', 404);
      await audit(a, 'content.delete', k);
      return json({ deleted: true });
    },
  ];
}
export const handler = router(routes);
