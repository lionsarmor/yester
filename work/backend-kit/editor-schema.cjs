const {sqliteTable,text,integer,index} = require("drizzle-orm/sqlite-core");
exports.memberSites=sqliteTable("member_sites",{
  slug:text("slug").primaryKey(),
  ownerId:text("owner_id").notNull(),
  creatorKey:text("creator_key").notNull(),
  title:text("title").notNull(),
  profile:text("profile").notNull(),
  theme:text("theme").notNull(),
  byline:text("byline").notNull(),
  listed:integer("listed").notNull(),
  blocksJson:text("blocks_json").notNull(),
  linksJson:text("links_json").notNull(),
  snippet:text("snippet").notNull(),
  keywordsJson:text("keywords_json").notNull(),
  updatedAt:text("updated_at").notNull()
},t=>[index("member_sites_by_owner").on(t.ownerId,t.updatedAt),index("member_sites_listed").on(t.listed,t.slug),index("member_sites_creator").on(t.creatorKey,t.listed,t.slug)]);

const {primaryKey}=require("drizzle-orm/sqlite-core");
exports.siteRevisions=sqliteTable("site_revisions",{
 id:text("id").primaryKey(),slug:text("slug").notNull(),created:text("created").notNull(),metadata:text("metadata").notNull()
},t=>[index("site_revision_history").on(t.slug,t.created)]);
exports.revisionPages=sqliteTable("revision_pages",{
 rev:text("rev").notNull(),page:text("page").notNull(),body:text("body").notNull()
},t=>[primaryKey({columns:[t.rev,t.page]})]);
exports.revisionMedia=sqliteTable("revision_media",{
 rev:text("rev").notNull(),num:integer("num").notNull(),src:text("src").notNull()
},t=>[primaryKey({columns:[t.rev,t.num]})]);
exports.siteCounters=sqliteTable("site_counters",{slug:text("slug").primaryKey(),views:integer("views").notNull()});
exports.guestEntries=sqliteTable("guest_entries",{
 id:integer("id").primaryKey({autoIncrement:true}),slug:text("slug").notNull(),name:text("name").notNull(),message:text("message").notNull(),created:text("created").notNull()
},t=>[index("guest_entries_by_site").on(t.slug,t.id)]);
exports.dailyVisits=sqliteTable("daily_visits",{
 day:text("day").notNull(), slug:text("slug").notNull(), views:integer("views").notNull()
},t=>[primaryKey({columns:[t.day,t.slug]})]);
exports.webmasters=sqliteTable("webmasters",{
 owner:text("owner").primaryKey(),handle:text("handle").notNull().unique(),joined:text("joined").notNull()
});
exports.localAccounts=sqliteTable("local_accounts",{
 owner:text("owner").primaryKey(),email:text("email").notNull().unique(),salt:text("salt").notNull(),hash:text("hash").notNull(),rounds:integer("rounds").notNull(),recovery:text("recovery")
});
exports.memberSessions=sqliteTable("member_sessions",{
 digest:text("digest").primaryKey(),owner:text("owner").notNull(),expires:integer("expires").notNull()
},t=>[index("member_sessions_owner").on(t.owner)]);
exports.loginAttempts=sqliteTable("login_attempts",{bucket:text("bucket").primaryKey(),expires:integer("expires").notNull(),attempts:integer("attempts").notNull()});
exports.editorGrants=sqliteTable("editor_grants",{
 digest:text("digest").primaryKey(),session:text("session").notNull(),slug:text("slug").notNull(),revision:text("revision").notNull(),expires:integer("expires").notNull()
},t=>[index("editor_grants_expiry").on(t.expires)]);
