import {DocModel} from "./DocModel";
import {RanksMediator} from "./RanksMediator";
import {RanksDB} from "./namespaces/RanksDB.namespace";
import DocRelationDescriptor = RanksDB.DocRelationDescriptor;
import SaveOptions = RanksDB.SaveOptions;

export class DocCollection {
  private mediator: RanksMediator;
  private readonly  relationDesc: DocRelationDescriptor;
  private readonly models: DocModel[];
  constructor(models: any[], relationDesc: DocRelationDescriptor,  mediator: RanksMediator) {
    this.models = models;
    this.relationDesc = relationDesc;
    this.mediator = mediator;
  }

  get(index: number): DocModel {
    return this.models[index];
  }

  async add(modelOrDoc: DocModel|any, inverseRelation?:string ): Promise<DocCollection> {
    const { from, relationName } = this.relationDesc;
    return this.mediator.attachToRelation(from, relationName, modelOrDoc, inverseRelation) as Promise<DocCollection>;
  }

  remove(modelOrId: DocModel|number, inverseRelation?: string): Promise<DocCollection> {
    const { from, relationName } = this.relationDesc;
    return this.mediator.detachFromRelation(from, relationName, modelOrId, inverseRelation) as Promise<DocCollection>;
  }

  first(): DocModel {
    if (this.length) {
      return this.models[0];
    }
    return null;
  }

  last(): DocModel {
    if (this.length) {
      return this.models[this.length - 1];
    }
    return null;
  }

  async save(options: SaveOptions = { refetch: false, related: false, bulk: false}): Promise<any> {
    return this.mediator.save(this,options);
  }

  /** Public Array Member Implementations **/
  *[Symbol.iterator]() {
    for (let index = 0; index < this.models.length; index++) {
      yield this.models[index];
    }
  }

  get length(): number {
    return this.models.length;
  }

  map<U>(callback, thisArg?: any): U[] {
    return this.models.map<U>(callback, thisArg);
  }

  find(callback, thisArg?: any) {
    return this.models.find(callback, thisArg);
  }

  findIndex(callback, thisArg?: any) {
    return this.models.findIndex(callback, thisArg)
  }
}
