// Blog posts: form, infolist, table, comments, and List / Create / Edit / View pages.
import { Action, ActionGroup } from '@navette-js/actions';
import { Model, ObjectionAdapter, type DataAdapter } from '@navette-js/database';
import { DatePicker, FileUpload, MentionProvider, RICH_EDITOR_TOOLS, RichContentCustomBlock, RichEditor, Select, TagsInput, TextInput, Toggle, type FileUploadEntry } from '@navette-js/forms';
import { e } from '@navette-js/support';
import { IconEntry, ImageEntry, TextEntry } from '@navette-js/infolists';
import { CreateAction, DeleteAction, DeleteBulkAction, EditAction, EditRecord, ManageRelatedRecords, Notification, Resource, ViewAction, ViewRecord } from '@navette-js/panels';
import { Flex, Grid, Group, Section, type Schema } from '@navette-js/schemas';
import { Filter, IconColumn, ImageColumn, TextColumn, type Table } from '@navette-js/tables';
import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { Author, PostCategory } from './BlogResources.ts';

export const POST_TYPE = 'App\\Models\\Blog\\Post';
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const cheeky = () => { Notification.make().warning().title("Now, now, don't be cheeky, leave some records for others to play with!").send(); };
const slugify = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const shortDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));

export class Post extends Model {
    static tableName = 'posts';
    id!: number;
    author_id!: number | null;
    post_category_id!: number | null;
    title!: string;
    slug!: string;
    content!: string | null;
    published_at!: string | null;
    created_at!: string;
    updated_at!: string;
    // Computed by the list query.
    author_name?: string | null;
    category_name?: string | null;
    image_id?: number | null;
    image_name?: string | null;
    image_file?: string | null;
    // Relations loaded by find().
    tags?: string[];
    image?: string[];
    $beforeInsert(): void { this.created_at = this.updated_at = now(); }
    $beforeUpdate(): void { this.updated_at = now(); }
}
/** Whether `published_at` is set and in the past. */
export const isPublished = (post: Pick<Post, 'published_at'>) => Boolean(post.published_at) && new Date(`${String(post.published_at).replace(' ', 'T').slice(0, 19)}Z`).getTime() <= Date.now();

const knex = () => Post.knex();
const tagNames: string[] = [];
const image = (column: string) => knex()('media').select(column)
    .where('media.model_type', POST_TYPE).whereRaw('media.model_id = posts.id').where('media.collection_name', 'post-images')
    .orderBy('media.order_column').orderBy('media.id').limit(1);
const options = (model: typeof Author | typeof PostCategory) => ({
    search: async (search: string): Promise<[string, string][]> => (await knex()(model.tableName).whereRaw('lower(name) like ?', [`%${search.toLowerCase().replace(/[%_\\]/g, '')}%`]).orderBy('name').limit(50).select('id', 'name')).map((row: any) => [String(row.id), row.name]),
    label: async (value: string): Promise<string | null> => (/^\d+$/.test(value) ? ((await knex()(model.tableName).where({ id: Number(value) }).first('name')) as any)?.name ?? null : null),
});

/** A "call to action" button users insert in a post: a label and a link, configured in a modal. */
export class CallToActionBlock extends RichContentCustomBlock {
    static getId() { return 'callToAction'; }
    static getLabel() { return 'Call to action'; }
    static getIcon() { return 'o-cursor-arrow-rays'; }
    static configureEditorAction(action: Action) {
        return action.schema([
            TextInput.make('label').required().maxLength(60),
            TextInput.make('url').label('URL').required().url(),
        ]);
    }
    static getPreviewLabel(config: Record<string, unknown>) { return `Call to action: ${String(config.label ?? '')}`; }
    static toPreviewHtml(config: Record<string, unknown>) { return `<p><strong>${e(config.label)}</strong> → ${e(config.url)}</p>`; }
    static toHtml(config: Record<string, unknown>) {
        const url = String(config.url ?? '');
        return /^https?:\/\//.test(url) ? `<p><a class="cta" href="${e(url)}">${e(config.label)}</a></p>` : null;
    }
}
/**
 * Editor of a post's content: text colors, a call-to-action block, an author merge tag and author mentions
 * (left out for screenshot comparisons, which use the default toolbar).
 */
const postContentEditor = (name: string) => {
    const editor = RichEditor.make(name).required();
    if (process.env.NAVETTE_NO_THEMES) return editor;
    const authors = options(Author);
    return editor
        .toolbarButtons([...RICH_EDITOR_TOOLS, ['textColor', 'customBlocks', 'mergeTags']])
        .customBlocks([CallToActionBlock])
        .mergeTags({ author: 'Author name', published_at: 'Publishing date' })
        .mentions([MentionProvider.make('@').getSearchResultsUsing(async (search) => Object.fromEntries(await authors.search(search))).getLabelsUsing(async (ids) => Object.fromEntries((await Promise.all(ids.map(async (id) => [id, await authors.label(id)]))).filter(([, label]) => label)))])
        .resizableImages();
};

/** Posts: tags and image are read and saved with the post. */
class Posts extends ObjectionAdapter<Post> {
    constructor() {
        super(Post, {
            modify: (query) => {
                query.select(
                    'posts.*',
                    knex()('authors').select('authors.name').whereRaw('authors.id = posts.author_id').as('author_name'),
                    knex()('post_categories').select('post_categories.name').whereRaw('post_categories.id = posts.post_category_id').as('category_name'),
                    image('media.id').as('image_id'), image('media.name').as('image_name'), image('media.file_name').as('image_file'),
                );
            },
        });
    }
    private mediaOf(key: string | number) { return knex()('media').where({ model_type: POST_TYPE, model_id: key, collection_name: 'post-images' }).orderBy('order_column').orderBy('id'); }
    async find(key: string | number): Promise<Post | null> {
        const post = await super.find(key);
        if (!post) return null;
        post.image = (await this.mediaOf(key)).slice(0, 1).map((media: any) => media.uuid);
        post.tags = (await knex()('tags').join('taggables', 'taggables.tag_id', 'tags.id').where({ 'taggables.taggable_type': POST_TYPE, 'taggables.taggable_id': key }).orderBy('tags.order_column').select('tags.name'))
            .map((row: any) => { try { return String(JSON.parse(row.name).en ?? ''); } catch { return ''; } }).filter(Boolean);
        return post;
    }
    /** Replaces the post's tags; unknown tags are created. */
    private async syncTags(key: string | number, tags: unknown): Promise<void> {
        if (!Array.isArray(tags)) return;
        const names = [...new Set(tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim().slice(0, 100)).filter(Boolean))].slice(0, 50);
        const ids: number[] = [];
        for (const name of names) {
            const existing = await knex()('tags').whereRaw("json_extract(name, '$.en') = ?", [name]).whereNull('type').first('id');
            if (existing) { ids.push(existing.id); continue; }
            const order = Number(((await knex()('tags').max({ m: 'order_column' }).first()) as any)?.m ?? 0) + 1;
            const [id] = await knex()('tags').insert({ name: JSON.stringify({ en: name }), slug: JSON.stringify({ en: slugify(name) }), type: null, order_column: order, created_at: now(), updated_at: now() });
            ids.push(id);
        }
        await knex()('taggables').where({ taggable_type: POST_TYPE, taggable_id: key }).delete();
        await PostResource.loadTagNames();
        if (ids.length) await knex()('taggables').insert(ids.map((id) => ({ tag_id: id, taggable_type: POST_TYPE, taggable_id: key })));
    }
    /** Post image: a single media item. Limitation: the thumbnail is a copy of the image, not resized. */
    private async syncImage(key: string | number, entries: unknown): Promise<void> {
        if (!Array.isArray(entries)) return;
        const existing: any[] = await this.mediaOf(key);
        const entry = (entries as FileUploadEntry[])[0];
        const keep = entry && 'key' in entry ? entry.key : null;
        for (const media of existing) {
            if (media.uuid === keep) continue;
            await knex()('media').where({ id: media.id }).delete();
            // Only files in the app's upload folder are deleted; those shipped with the demo database stay.
            if (PostResource.mediaRoot) rmSync(path.join(PostResource.mediaRoot, String(Number(media.id))), { recursive: true, force: true });
        }
        const root = PostResource.mediaRoot;
        if (!entry || 'key' in entry || !root || entry.file.type !== 'image/jpeg') return;
        const name = randomUUID();
        const [id] = await knex()('media').insert({
            model_type: POST_TYPE, model_id: key, uuid: randomUUID(), collection_name: 'post-images', name, file_name: `${name}.jpg`, mime_type: 'image/jpeg',
            disk: 'public', conversions_disk: 'public', size: entry.file.size, manipulations: '[]', custom_properties: '[]', generated_conversions: '{"thumb":true}',
            responsive_images: '[]', order_column: 1, created_at: now(), updated_at: now(),
        });
        mkdirSync(path.join(root, String(id), 'conversions'), { recursive: true });
        copyFileSync(entry.file.path, path.join(root, String(id), `${name}.jpg`));
        copyFileSync(entry.file.path, path.join(root, String(id), 'conversions', `${name}-thumb.jpg`));
    }
    private columns(data: Record<string, unknown>): Record<string, unknown> { const { tags, image: _image, author_name, category_name, image_id, image_name, image_file, ...columns } = data; return columns; }
    async create(data: Record<string, unknown>): Promise<Post> {
        const post = await super.create(this.columns(data));
        await this.syncTags(post.id, data.tags);
        await this.syncImage(post.id, data.image);
        return post;
    }
    async update(key: string | number, data: Record<string, unknown>): Promise<Post> {
        const post = await super.update(key, this.columns(data));
        if ('tags' in data) await this.syncTags(key, data.tags);
        if ('image' in data) await this.syncImage(key, data.image);
        return post;
    }
}

const publish = async (record: Post, publishedAt: string | null) => { await PostResource.adapter.update(record.id, { published_at: publishedAt }); record.published_at = publishedAt; };

class EditPost extends EditRecord {
    getTitle(): string { return String(this._record?.title ?? ''); }
    getHeaderActions(): Action[] { return [ViewAction.make(), DeleteAction.make()]; }
}
class ViewPost extends ViewRecord {
    getTitle(): string { return String(this._record?.title ?? ''); }
    getHeaderActions(): Action[] {
        return [
            Action.make('quick_publish').icon('m-rocket-launch').color('success').keyBindings(['mod+shift+p'])
                .visible(({ record }) => !isPublished(record as Post))
                .action(async ({ record }) => { await publish(record as Post, now()); Notification.make().success().title('Post published').send(); }),
            Action.make('unpublish').icon('m-x-circle').color('warning')
                .visible(({ record }) => isPublished(record as Post))
                .action(async ({ record }) => { await publish(record as Post, null); Notification.make().warning().title('Post unpublished').send(); }),
            this.editAction(),
        ];
    }
}

// ------------------------------------------------------------------ post comments
export class Comment extends Model {
    static tableName = 'comments';
    id!: number;
    customer_id!: number | null;
    commentable_type!: string;
    commentable_id!: number;
    title!: string | null;
    content!: string | null;
    is_visible!: number | boolean;
    created_at!: string;
    updated_at!: string;
    customer_name?: string | null;
    $beforeInsert(): void { this.created_at = this.updated_at = now(); }
    $beforeUpdate(): void { this.updated_at = now(); }
    $formatDatabaseJson(json: Record<string, any>): Record<string, any> {
        const out = super.$formatDatabaseJson(json);
        delete out.customer_name;
        if (typeof out.is_visible === 'boolean') out.is_visible = out.is_visible ? 1 : 0;
        return out;
    }
}
/** Comments of a post: reads are limited to the post, and any comment created here is attached to it, whatever data is received. */
class PostComments extends ObjectionAdapter<Comment> {
    private post: number;
    constructor(post: string) {
        super(Comment, {
            modify: (query) => {
                query.where({ 'comments.commentable_type': POST_TYPE, 'comments.commentable_id': Number(post) })
                    .select('comments.*', knex()('customers').select('customers.name').whereRaw('customers.id = comments.customer_id').as('customer_name'));
            },
        });
        this.post = Number(post);
    }
    create(data: Record<string, unknown>): Promise<Comment> { return super.create({ ...data, commentable_type: POST_TYPE, commentable_id: this.post }); }
    update(key: string | number, data: Record<string, unknown>): Promise<Comment> { const { commentable_type, commentable_id, ...columns } = data; return super.update(key, columns); }
}
const customers = {
    search: async (search: string): Promise<[string, string][]> => (await knex()('customers').whereNull('deleted_at').whereRaw('lower(name) like ?', [`%${search.toLowerCase().replace(/[%_\\]/g, '')}%`]).orderBy('name').limit(50).select('id', 'name')).map((row: any) => [String(row.id), row.name]),
    label: async (value: string): Promise<string | null> => (/^\d+$/.test(value) ? ((await knex()('customers').where({ id: Number(value) }).first('name')) as any)?.name ?? null : null),
};

export class ManagePostComments extends ManageRelatedRecords {
    static relationship = 'comments';
    static modelLabel = 'comment';
    static recordTitleAttribute = 'title';
    static navigationIcon = 'o-chat-bubble-left-ellipsis';
    static adapterFor(ownerKey: string): DataAdapter { return new PostComments(ownerKey); }
    static form(schema: Schema): Schema {
        return schema.columns(1).components([
            TextInput.make('title').required(),
            Select.make('customer_id').label('Customer').searchable().required().getSearchResultsUsing(customers.search).getOptionLabelUsing(customers.label),
            Toggle.make('is_visible').label('Public visibility').default(true),
            RichEditor.make('content').required(),
        ]);
    }
    static infolist(schema: Schema): Schema {
        return schema.columns(1).components([
            TextEntry.make('title').placeholder('Untitled'),
            TextEntry.make('customer.name').label('Customer').placeholder('No customer'),
            IconEntry.make('is_visible').label('Public visibility').boolean(),
            TextEntry.make('content').markdown().placeholder('No content'),
        ]);
    }
    static table(table: Table): Table {
        return (table as Table<Comment>)
            .columns([
                TextColumn.make<Comment>('title').searchable().sortable(),
                TextColumn.make<Comment>('customer.name').getStateUsing(({ record }) => record.customer_name ?? null).searchable({ column: 'customer_name' }).sortable({ column: 'customer_name' }),
                IconColumn.make<Comment>('is_visible').label('Public visibility').boolean().sortable(),
            ])
            .defaultSort('created_at', 'desc')
            .recordAction('view')
            .headerActions([CreateAction.make()])
            .recordActions([ViewAction.make(), EditAction.make(), DeleteAction.make().action(cheeky)])
            .groupedBulkActions([DeleteBulkAction.make().action(cheeky)]) as Table;
    }
}

export class PostResource extends Resource {
    static slug = 'blog/posts';
    static modelLabel = 'post';
    static navigationIcon = 'o-document-text';
    static navigationGroup = 'Blog';
    static navigationSort = 0;
    static recordTitleAttribute = 'title';
    static globalSearchSort = 3;
    static globallySearchableAttributes = ['title', 'slug', 'author_name', 'category_name'];
    static getGlobalSearchResultDetails(record: Post): Record<string, unknown> { return { Author: record.author_name, Category: record.category_name }; }
    static hasViewPage = true;
    static pages = { edit: EditPost, view: ViewPost };
    static relatedPages = { comments: ManagePostComments };
    static recordSubNavigation = ['view', 'edit', 'comments'];
    static subNavigationPosition = 'top' as const;
    static adapter = new Posts();
    /** Public media folder (served under /storage), set by the server. */
    static mediaRoot: string | null = null;

    /** Existing tags offered as suggestions (refreshed by the server at startup and after each save). */
    static async loadTagNames(): Promise<void> {
        tagNames.splice(0, tagNames.length, ...(await knex()('tags').whereNull('type').orderBy('order_column').select('name')).map((row: any) => { try { return String(JSON.parse(row.name).en ?? ''); } catch { return ''; } }).filter(Boolean));
    }

    static form(schema: Schema): Schema {
        const authors = options(Author);
        const categories = options(PostCategory);
        return schema.components([
            Section.make().columns(2).schema([
                TextInput.make('title').required().live({ onBlur: true }).maxLength(255)
                    .afterStateUpdated(({ operation, state, set }) => { if (operation === 'create') set('slug', slugify(String(state ?? ''))); }),
                TextInput.make('slug').disabled().dehydrated().required().maxLength(255).unique({ ignoreRecord: true }),
                postContentEditor('content').columnSpan('full'),
                Select.make('author_id').label('Author').searchable().required().getSearchResultsUsing(authors.search).getOptionLabelUsing(authors.label),
                Select.make('post_category_id').label('Post category').searchable().required().getSearchResultsUsing(categories.search).getOptionLabelUsing(categories.label),
                DatePicker.make('published_at').label('Publishing date'),
                TagsInput.make('tags').suggestions(tagNames),
            ]),
            // Loaded when it enters the viewport (not for screenshot comparisons).
            Section.make('Image').collapsible().lazyLoaded(!process.env.NAVETTE_NO_THEMES).schema([
                FileUpload.make('image').hiddenLabel().acceptedFileTypes(['image/jpeg']).storeFiles(false)
                    .getUploadedFileUsing(async (uuid) => {
                        const media = await knex()('media').where({ uuid, model_type: POST_TYPE }).first();
                        return media ? { name: media.file_name, size: Number(media.size), type: media.mime_type, url: `/storage/${Number(media.id)}/${encodeURIComponent(media.file_name)}` } : null;
                    }),
            ]),
        ]);
    }

    static infolist(schema: Schema): Schema {
        return schema.components([
            Section.make().schema([Flex.make([
                Grid.make(2).schema([
                    Group.make([
                        TextEntry.make('title'),
                        TextEntry.make('slug').copyable(),
                        TextEntry.make('published_at').label('Publishing date').badge().date().color('success').placeholder('Not published'),
                    ]),
                    Group.make([
                        TextEntry.make('author.name').label('Author').placeholder('No author'),
                        TextEntry.make('postCategory.name').label('Category').state(({ record }) => (record as Post).category_name ?? null).placeholder('Uncategorized'),
                        TextEntry.make('tags').badge(),
                    ]),
                ]),
                ImageEntry.make('image').hiddenLabel().grow(false)
                    .state(({ record }) => ((record as Post).image_id ? `/storage/${Number((record as Post).image_id)}/${encodeURIComponent(String((record as Post).image_file))}` : null)),
            ]).from('lg')]),
            Section.make('Content').collapsible().schema([
                TextEntry.make('content').prose().markdown().hiddenLabel(),
            ]),
        ]);
    }

    static table(table: Table<Post>): Table<Post> {
        return table
            .columns([
                ImageColumn.make<Post>('image')
                    .getStateUsing(({ record }) => (record.image_id ? `/storage/${Number(record.image_id)}/conversions/${encodeURIComponent(String(record.image_name))}-thumb.jpg` : null))
                    .alt((record) => `View ${record.title}`),
                TextColumn.make<Post>('title').searchable().sortable().weight('medium'),
                TextColumn.make<Post>('slug').searchable().sortable().copyable().toggleable(true, { isToggledHiddenByDefault: true }),
                TextColumn.make<Post>('author.name').getStateUsing(({ record }) => record.author_name ?? null).searchable({ column: 'author_name' }).sortable({ column: 'author_name' }).toggleable(),
                TextColumn.make<Post>('status').badge().getStateUsing(({ record }) => (isPublished(record) ? 'Published' : 'Draft')).color((record) => (isPublished(record) ? 'success' : 'primary')),
                TextColumn.make<Post>('postCategory.name').getStateUsing(({ record }) => record.category_name ?? null).searchable({ column: 'category_name' }).sortable({ column: 'category_name' }).toggleable(true, { isToggledHiddenByDefault: true }),
                TextColumn.make<Post>('published_at').label('Publishing date').date().sortable(),
            ])
            .filters([
                Filter.make('published_at')
                    .schema([
                        DatePicker.make('published_from').placeholder(`Dec 18, ${new Date().getUTCFullYear() - 1}`),
                        DatePicker.make('published_until').placeholder(new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date())),
                    ])
                    .query((query, data) => {
                        if (isDate(data.published_from)) query.whereRaw('date(??) >= ?', ['published_at', data.published_from]);
                        if (isDate(data.published_until)) query.whereRaw('date(??) <= ?', ['published_at', data.published_until]);
                    })
                    .indicateUsing((data) => ({
                        ...(isDate(data.published_from) ? { published_from: `Published from ${shortDate(data.published_from)}` } : {}),
                        ...(isDate(data.published_until) ? { published_until: `Published until ${shortDate(data.published_until)}` } : {}),
                    })),
            ])
            .defaultSort('published_at', 'desc')
            .recordActions([
                ActionGroup.make([
                    Action.make('toggle_publish')
                        .icon(({ record }) => (isPublished(record as Post) ? 'm-x-circle' : 'm-rocket-launch'))
                        .label(({ record }) => (isPublished(record as Post) ? 'Unpublish' : 'Publish'))
                        .color(({ record }) => (isPublished(record as Post) ? 'warning' : 'success'))
                        .action(async ({ record }) => {
                            await publish(record as Post, isPublished(record as Post) ? null : now());
                            Notification.make().success().title((record as Post).published_at ? 'Post published' : 'Post unpublished').send();
                        }),
                    ViewAction.make(),
                    Action.make('edit').label('Edit').icon('m-pencil-square').color('primary').url(({ record }) => PostResource.getUrl('edit', (record as Post).id)),
                    DeleteAction.make().action(cheeky),
                ]),
            ])
            .groupedBulkActions([DeleteBulkAction.make().action(cheeky)]);
    }
}
