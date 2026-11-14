import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Model, ObjectionAdapter, sqlite, type Knex } from '@navette-js/database';
import { TextEntry } from '@navette-js/infolists';
import { type Schema } from '@navette-js/schemas';
import { IconColumn, TextColumn, TextInputColumn, type Table } from '@navette-js/tables';
import { ExportAction, ExportColumn, Exporter, Panel, Resource, type User } from '../src/index.ts';
import { actingAs, livewire, setCurrentPanel, TestAction } from '../src/testing.ts';

class Author extends Model { static tableName = 'authors'; }
class Comment extends Model { static tableName = 'comments'; }
class Article extends Model {
    static tableName = 'articles';
    static get relationMappings() {
        return {
            author: { relation: Model.BelongsToOneRelation, modelClass: Author, join: { from: 'articles.author_id', to: 'authors.id' } },
            comments: { relation: Model.HasManyRelation, modelClass: Comment, join: { from: 'articles.id', to: 'comments.article_id' } },
        };
    }
}
let db: Knex;

class ArticleExporter extends Exporter {
    static getColumns(): ExportColumn[] {
        return [
            ExportColumn.make('title'),
            ExportColumn.make('author.name'),
            ExportColumn.make('comments.body'),
            ExportColumn.make('comments_count').counts('comments'),
            ExportColumn.make('comments_exists').exists('comments'),
            ExportColumn.make('comments_sum_rating').sum('comments', 'rating'),
            ExportColumn.make('comments_avg_rating').avg('comments', 'rating'),
            ExportColumn.make('comments_min_rating').min('comments', 'rating'),
            ExportColumn.make('comments_max_rating').max('comments', 'rating'),
        ];
    }
}
class ArticleResource extends Resource {
    static slug = 'articles';
    static modelLabel = 'article';
    static hasViewPage = true;
    static adapter = new ObjectionAdapter(Article);
    static table(table: Table): Table {
        return table.columns([
            TextColumn.make('title').searchable(),
            TextColumn.make('author.name').label('Author').searchable().sortable(),
            TextColumn.make('comments_count').counts('comments').sortable(),
            IconColumn.make('comments_exists').exists('comments').boolean(),
            TextInputColumn.make('author.email'),
        ]).headerActions([ExportAction.make().exporter(ArticleExporter)]);
    }
    static infolist(schema: Schema): Schema {
        return schema.components([
            TextEntry.make('title'),
            TextEntry.make('author.name'),
            TextEntry.make('comments.body').listWithLineBreaks(),
            TextEntry.make('comments_count').counts('comments'),
            TextEntry.make('comments_avg_rating').avg('comments', 'rating'),
            TextEntry.make('comments_sum_rating').sum('comments', 'rating'),
            TextEntry.make('comments_min_rating').min('comments', 'rating'),
            TextEntry.make('comments_max_rating').max('comments', 'rating'),
        ]);
    }
}
const user: User = { id: 1, name: 'Ada', email: 'ada@example.test' };
const panel = Panel.make().id('relationships').key('relationships-key').auth({ find: async () => user } as any).resources([ArticleResource]);
const pages = ArticleResource.getPages() as Record<string, any>;

before(async () => {
    db = sqlite(':memory:');
    Model.knex(db);
    await db.schema.createTable('authors', (t) => { t.increments('id'); t.string('name'); t.string('email'); });
    await db.schema.createTable('articles', (t) => { t.increments('id'); t.string('title'); t.integer('author_id'); });
    await db.schema.createTable('comments', (t) => { t.increments('id'); t.integer('article_id'); t.string('body'); t.integer('rating'); });
    await db('authors').insert([{ name: 'Grace Hopper', email: 'grace@example.test' }, { name: 'Alan Turing', email: 'alan@example.test' }]);
    await db('articles').insert([{ title: 'Compilers', author_id: 1 }, { title: 'Machines', author_id: 2 }, { title: 'Anonymous', author_id: null }]);
    await db('comments').insert([{ article_id: 1, body: 'Brilliant', rating: 5 }, { article_id: 1, body: 'Clear', rating: 3 }, { article_id: 2, body: 'Deep', rating: 4 }]);
    setCurrentPanel(panel);
    actingAs(user);
});
after(() => db.destroy());

test('list page: relationship columns and aggregates, sorted and searched through the relationship', async () => {
    await livewire(pages.index).assertSee(['Grace Hopper', 'Alan Turing'])
        .assertTableColumnStateSet('author.name', 'Grace Hopper', 1)
        .assertTableColumnStateSet('comments_count', 2, 1)
        .assertTableColumnStateSet('comments_exists', false, 3)
        .assertCanSeeTableRecords([2], true)
        .sortTable('author.name').assertCanSeeTableRecords([3, 2, 1], true)
        .sortTable('comments_count', 'desc').assertCanSeeTableRecords([1, 2, 3], true)
        .searchTable('turing').assertCanSeeTableRecords([2]).assertCanNotSeeTableRecords([1, 3]);
});

test('list page: an editable relationship column saves the related record', async () => {
    const tester = livewire(pages.index);
    await tester.call('updateTableColumnState', 'author.email', '2', 'turing@example.test');
    assert.equal((await db('authors').where('id', 2).first()).email, 'turing@example.test');
});

test('view page: relationship entries are loaded on demand, and so are aggregates', async () => {
    await livewire(pages.view, { record: '1' }).assertSee(['Grace Hopper', 'Brilliant', 'Clear', '4', '8']);
    await livewire(pages.view, { record: '3' }).assertSee('Anonymous').assertDontSee('Grace Hopper');
});

test('export: relationship columns are eager-loaded and aggregates selected', async () => {
    const tester = livewire(pages.index);
    await tester.callAction(TestAction.make('export').table(), { columns: ArticleExporter.getColumns().map((column) => column.name) }).assertNotified('Export completed');
    const csv = tester.getDownloads().find((file) => file.name.endsWith('.csv'))!.content.toString('utf8').replace(/^﻿/, '');
    const lines = csv.trim().split('\r\n');
    assert.equal(lines.length, 4);
    assert.ok(lines[1].startsWith('Compilers,Grace Hopper,'), lines[1]);
    assert.ok(lines[1].includes('Brilliant') && lines[1].includes('Clear'), lines[1]);
    assert.ok(/,2,(true|1),8,4,3,5$/.test(lines[1]), lines[1]);
    assert.ok(/^Anonymous,,,0,(false|0),,,,$/.test(lines[3]), lines[3]);
});
