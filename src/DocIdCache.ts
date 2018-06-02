import {RanksDB} from "./namespaces/RanksDB.namespace";
import TypeSchema = RanksDB.TypeSchema;
import {Database} from "./Database";
import MaxDocIdCache = RanksDB.MaxDocIdCache;

export class DocIdCache {
  private db: Database;
  private maxDocIdCache: MaxDocIdCache = {};

  constructor(db: Database) {
    this.db = db;
  }

  public initializeDocIdCache(): Promise<any> {
    return Promise.all(this.db.schema.getTypeSchemas().map((schema) => this.setDocId(schema)));
  }

  private async setDocId(schema: TypeSchema): Promise<any> {
    const results = await this.db.allDocs({
      endkey: schema.singular,
      startkey: `${schema.singular}\ufff0`,
      limit: 1,
      descending: true
    });
    if (results.rows.length) {
      const newDocId = this.db.parseDocID(results.rows[0].id).id;
      const currentDocId = this.getCurrentDocId(schema.plural);
      this.maxDocIdCache[schema.plural] = newDocId > currentDocId ? newDocId : currentDocId;
    } else {
      this.maxDocIdCache[schema.plural] = 0;
    }
    return true;
  }

  public getNextDocId(type: string): number {
    this.checkCacheForDocType(type);
    this.maxDocIdCache[type] = ++this.maxDocIdCache[type];
    return this.maxDocIdCache[type];
  }

  private getCurrentDocId(type: string) {
    this.checkCacheForDocType(type);
    return this.maxDocIdCache[type];
  }

  private checkCacheForDocType(type: string) {
    if(this.db.schema.getTypeSchemas()[type]) {
      throw new Error(`schema ${type} does not exist.`);
    }
    if (this.maxDocIdCache[type] === undefined) {
      this.maxDocIdCache[type] = 0;
    }
  }
}
