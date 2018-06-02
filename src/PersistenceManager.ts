/**
 * There are 3 different ways that we can currently save docs
 * 1. Save only the Root Model or Collection
 * 2. Save all Related Models in addition to the Root Model or Collection one at a time
 * 3. 2. But in bulk
 *
 * We have some logic in here for updating Models ids. This should be moved to the specific cache implementation that is affects
 */

import {DocCollection} from "./DocCollection";
import {DocModel} from "./DocModel";
import {RanksMediator} from "./RanksMediator";
import {RanksDB} from "./namespaces/RanksDB.namespace";
import SaveOptions = RanksDB.SaveOptions;
import ParsedDocId = RanksDB.ParsedDocId;
import TypeSchema = RanksDB.TypeSchema;
import ISideloadedRankModels = RanksDB.ISideloadedRankModels;
import {RelationManager} from "./relations/RelationManager";
import RelationDescriptor = RanksDB.DocRelationDescriptor;

export class PersistenceManager {
  private mediator: RanksMediator;
  constructor(mediator: RanksMediator) {
    this.mediator = mediator;
  }

  public async save(options: SaveOptions, modelOrCollection: DocModel|DocCollection): Promise<DocModel|DocCollection> {
    if (options.related) {
      await (options.bulk ? this.saveAllBulk() : this.saveAllIndividually());
    } else if (modelOrCollection instanceof  DocCollection) {
      const writes: Promise<any>[] = modelOrCollection.map((model: DocModel) => this.saveModel(model));
      await Promise.all(writes);
    } else {
      await this.saveModel(modelOrCollection);
    }
    return modelOrCollection;
  }

  private async saveAllIndividually() {
    const writes: Promise<any>[] = [];
    const data: ISideloadedRankModels = this.mediator.getRanks();
    for (const type of Object.keys(data)) {
      data[type].map((model: DocModel) => writes.push(this.saveModel(model)));
    }
    await Promise.all(writes);
    return this;
  }

  private async saveModel(model: DocModel): Promise<DocModel> {
    if (!model.hasChanged()) {
      return model;
    }
    const updatedModel: DocModel = await this.mediator.db.save(model.type, model.getDoc()) as DocModel;
    const data = updatedModel.getDoc();
    model.setDoc(data);
    model.refreshOriginalDoc();
    return model;
  }

  private async saveAllBulk() {
    await  this.saveNewDocs();
    await this.saveUpdatedDocs();
    return this;
  }

  private async saveNewDocs() {
    const changedModels: DocModel[] = this.getChangedModels();
    const newDocs: any[] = changedModels.filter((model: DocModel) => model.isNew()).map((model: DocModel) => model.createDoc());
    const responses: any[] = await this.mediator.db.bulkDocs(newDocs);
    return Promise.all(responses.map((response: any, index: number) => this.handleResponse(response, index)));
  }

  private async saveUpdatedDocs() {
    const changedModels: DocModel[] = this.getChangedModels();
    const updatedDocs: any[] = changedModels.filter((model: DocModel) => !model.isNew()).map((model: DocModel) => model.createDoc());
    const responses: any[] = await this.mediator.db.bulkDocs(updatedDocs);
    return Promise.all(responses.map((response: any, index) => this.handleResponse(response, index)));
  }

  private getChangedModels(): DocModel[] {
    const models: DocModel[] = this.mediator.getFlattenedRanks() as DocModel[];
    return models.filter((model: DocModel) => model.hasChanged());
  }


  private async handleResponse(response: any, index: number) {
    if (response.error && response.name === 'conflict') {
      if (index === 0) {
        await this.mediator.initializeDocIdCache();
      }
      const newResponse = await this.retrySavingNewDoc(response);
      return this.handleResponse(newResponse, 0);
    } else if(response.ok || response.type !== undefined) {
      this.updateDocModelRev(response);
    } else {
      console.error(response);
    }
    return true;
  }

  private updateDocModelRev(response: any) {
    const model: DocModel = this.getModelFromResponse(response);
    const rev: string = response instanceof  DocModel ? (response as DocModel).getField('rev') : response.rev;
    model.setField('rev', rev);
    model.refreshOriginalDoc();
  }

  private retrySavingNewDoc(response: any) {
    const model: DocModel = this.getModelFromResponse(response);
    const newDocId = this.mediator.getNextDocId(model.type);
    this.updateParentsDocIds(model, newDocId);
    model.setField('id', newDocId);
    return this.mediator.db.save(model.type, model.getDoc(), false);
  }

  private updateParentsDocIds(model: DocModel, newDocId: number) {
    const { type, id } = model;
    const relationsToModels = this.mediator.getDependentRelations(type, id);
    for(const relationName in relationsToModels) {
      const model = relationsToModels[relationName];
      const descriptor: RelationDescriptor = this.mediator.getDocRelationDescriptor(model, relationName);
      if (descriptor.relationType === RelationManager.RELATION_TYPE_BELONGS_TO) {
        descriptor.from.setField(relationName, newDocId);
      } else if (descriptor.relationType === RelationManager.RELATION_TYPE_HAS_MANY) {
        const oldIds = model.getField(relationName);
        const indexOfOldId = oldIds.indexOf(id);
        oldIds[indexOfOldId] = newDocId;
      }
    }
  }

  private getModelFromResponse(response: any) {
    let id, type;
    if (response instanceof DocModel) {
      id = response.id;
      type = response.type;
    } else {
      const parsedDocID: ParsedDocId = this.mediator.db.parseDocID(response.id);
      const typeSchema: TypeSchema = this.mediator.getTypeSchema(parsedDocID.type);
      id = parsedDocID.id;
      type = typeSchema.plural;
    }
    return this.mediator.getDocModelByTypeAndId(type,id);
  }
}
